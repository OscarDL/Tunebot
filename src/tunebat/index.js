import { parse } from 'node-html-parser';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin({
  enabledEvasions: [
    'chrome.runtime',
    'iframe.contentWindow',
    'media.codecs',
    'navigator.languages',
    'navigator.permissions',
    'navigator.plugins',
    'navigator.webdriver',
    'sourceurl',
    'user-agent-override'
  ]
}));

const cleanWordsFromTrackName = (trackName) => {
  let wordsToRemove = ['feat.', 'feat', 'ft.', 'ft', 'with', 'w/'];
  wordsToRemove.map((word) => wordsToRemove.push(`(${word}`, `[${word}`));

  const words = trackName.toLowerCase().split(' ');

  // find the index of the word to remove
  const index = words.findIndex((word) => wordsToRemove.includes(word));
  if (index === -1) return words.join(' ');

  // remove the word at index, the character prior and everything up until the opposite corresponding character
  const word = words[index];

  switch (word[0]) {
    case '(':
      // remove what's inside the parentheses
      const closingP = words.findIndex((word) => word.endsWith(')'));
      return [words.slice(0, index).join(' '), words.slice(closingP + 1).join(' ')].join(' ').trim();
    case '[':
      // remove what's inside the brackets
      const closingB = words.findIndex((word) => word.endsWith(']'));
      return [words.slice(0, index).join(' '), words.slice(closingB + 1).join(' ')].join(' ').trim();
    default:
      const closing = words.findIndex((word) => word === '-');
      const suffix = words.slice(closing).join(' '); // If there's a dash for a remix, keep it
      return [words.slice(0, index).join(' '), closing > -1 ? ` ${suffix}` : ''].join(' ').trim();
  }
};

// export const getTunebatTrack = async (command, searchTerm, isExplicitSearch = false) => {
//   const attemptSearch = async () => {
//     const sanitizedSearchTerm = searchTerm.replace(/[;&|()]/g, '');
//     const res = await fetch(`https://api.tunebat.com/api/tracks/search?term=${sanitizedSearchTerm}`);

//     switch (res.status) {
//       case 200:
//         break;
//       case 429:
//         throw new Error('Rate limit exceeded. Please try again later.');
//       default:
//         throw new Error('Could not fetch data. Tunebat may be having issues.');
//     }

//     const json = await res.json();

//     if (!json.data.items[0]) {
//       console.log('failed Tunebat search at', new Date().toLocaleString().split(' ')[1]);
//       console.log(json);
//     }

//     const search = searchTerm.toLowerCase();
//     if (search.includes('|')) {
//       const [one, two] = search.split('|').map((term) => term.trim());
//       const getTrackName = isExplicitSearch ? cleanWordsFromTrackName : String;

//       return json.data.items.find((track) => (
//         track.as.map((a) => a.toLowerCase()).includes(one) && getTrackName(track.n).toLowerCase() === two ||
//         track.as.map((a) => a.toLowerCase()).includes(two) && getTrackName(track.n).toLowerCase() === one
//       ));
//     } else {
//       return json.data.items[0];
//     }
//   };

//   let track;
//   try {
//     track = await attemptSearch();
//   } catch (error) {
//     console.log(error);
//     return error;
//   }

//   if (!track) {
//     // attempt a second search one second after because for some reason
//     // sometimes the tunebat api returns nothing even when there is a match
//     await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3 seconds
//     track = await attemptSearch();
//     if (!track) return 'No results found, but Tunebat is probably just a bitch.';
//   }

//   const {b: bpm, k: key, c: camelot, d: duration, l: label, p: popularity, rd: date, id} = track;
//   const trackText = `**${track.n}** by ${track.as.join(', ')}`;
//   const length = duration / 1000;
//   const minutes = Math.floor(length / 60);
//   const seconds = Math.floor(length % 60);

//   switch (command) {
//     case 's':
//     case 'spotify': {
//       return `[${trackText}](https://open.spotify.com/track/${id})`;
//     }

//     case 'fxs': {
//       return `[${trackText}](https://play.spotify.com/track/${id})`;
//     }

//     case 'fm':
//     case 'np': {
//       return `[${trackText}](https://open.spotify.com/track/${id}) is currently playing.`;
//     }

//     case 'bpm': {
//       return `[${trackText}](<https://open.spotify.com/track/${id}>) is **${bpm} BPM**.`;
//     }

//     case 'key': {
//       return `[${trackText}](<https://open.spotify.com/track/${id}>) is written in **${key}** (${camelot}).`;
//     }

//     case 'duration': {
//       return `[${trackText}](<https://open.spotify.com/track/${id}>) lasts **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**.`;
//     }

//     case 'pop': {
//       return `[${trackText}](<https://open.spotify.com/track/${id}>) has a popularity score of **${popularity}%** on Spotify.`;
//     }

//     case 'info': {
//       return (
//         `[${trackText}](https://open.spotify.com/track/${id})\n` +
//         `BPM: **${bpm}**\n` +
//         `Key: **${key}** (${camelot})\n` +
//         `Duration: **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**\n` +
//         `Popularity: **${popularity}%** \n`
//       );
//     }

//     default:
//       break;
//   }
// };

const getInfoFromTrackElement = (element) => {
  const [track, info] = element.querySelectorAll('a[href^="/Info/"] > div > :last-child > div > div');
  const [artist, title] = track.childNodes.map((node) => node.rawText.trim());
  const [key, bpm, camelot, popularity] = info.childNodes.map((node) => node.querySelector('p:first-child').rawText.trim());
  const spotifyLink = element.querySelector('a[aria-label="Spotify"]').getAttribute('href');
  return {artist, title, key, bpm, camelot, popularity, spotifyLink};
};

export const getTunebatTrack = async (command, searchTerm, isExplicitSearch = false) => {
  let browser;
  const sanitizedSearchTerm = searchTerm.replace(/[;&|()]/g, '');

  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br', // Important for Cloudflare
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
    });

    // Navigate first to homepage to establish trust
    await page.goto('https://tunebat.com', { waitUntil: 'networkidle2' });

    page.setDefaultNavigationTimeout(60000); // 60 seconds
    page.setDefaultTimeout(60000); // For other operations like waitForSelector

    // Wait for Cloudflare challenge to complete if any
    while (true) {
      const content = await page.content();
      if (!content.includes('Just a moment...')) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Find the search input field and enter the search term
    await page.waitForSelector('input[aria-label="Song search field"]');
    await page.type('input[aria-label="Song search field"]', sanitizedSearchTerm);
    await page.keyboard.press('Enter');

    // Wait for search results to load
    await page.waitForSelector('body main > div:only-child'); // Wait for the loading spinner to disappear

    let specificTrack;
    const search = searchTerm.toLowerCase();
    const content = await page.content();
    const data = parse(content).querySelectorAll('body main form + div > :not(:first-child)');

    if (search.includes('|')) {
      const [one, two] = search.split('|').map((term) => term.trim());
      const getTrackName = isExplicitSearch ? cleanWordsFromTrackName : String;

      specificTrack = data.find((track) => {
        const info = getInfoFromTrackElement(track);
        return (
          info.artist.split(', ').map((a) => a.toLowerCase()).includes(one) && getTrackName(info.title).toLowerCase() === two ||
          info.artist.split(', ').map((a) => a.toLowerCase()).includes(two) && getTrackName(info.title).toLowerCase() === one
        );
      });
    }

    const track = getInfoFromTrackElement(specificTrack ?? data[0]);
    const {artist, title, bpm, key, camelot, popularity, spotifyLink} = track;
    const trackText = `**${title}** by ${artist}`;

    switch (command) {
      case 's':
      case 'spotify': {
        return `[${trackText}](${spotifyLink})`;
      }

      case 'fxs': {
        return `[${trackText}](${spotifyLink.replace('open.spotify.com', 'play.spotify.com')})`;
      }

      case 'fm':
      case 'np': {
        return `[${trackText}](${spotifyLink}) is currently playing.`;
      }

      case 'bpm': {
        return `[${trackText}](${spotifyLink}) is **${bpm} BPM**.`;
      }

      case 'key': {
        return `[${trackText}](${spotifyLink}) is written in **${key}** (${camelot}).`;
      }

      case 'pop': {
        return `[${trackText}](${spotifyLink}) has a popularity score of **${popularity}%** on Spotify.`;
      }

      case 'info': {
        return (
          `[${trackText}](${spotifyLink})\n` +
          `BPM: **${bpm}**\n` +
          `Key: **${key}** (${camelot})\n` +
          `Popularity: **${popularity}%** \n`
        );
      }
    }
  } catch (error) {
    console.error('Error during operation:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
