import { parse } from 'node-html-parser';

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

const getInfoFromTrackElement = (element) => {
  const [track, info] = element.querySelectorAll('a[href^="/Info/"] > div > :last-child > div > div');
  const [artist, title] = track.childNodes.map((node) => node.rawText.trim());
  const [key, bpm, camelot, popularity] = info.childNodes.map((node) => node.querySelector('p:first-child').rawText.trim());
  const spotifyLink = element.querySelector('a[aria-label="Spotify"]').getAttribute('href');
  return {artist, title, key, bpm, camelot, popularity, spotifyLink};
};

export const fetchTrackInfo = async ({command, page, presence, searchTerm, isExplicitSearch = false}) => {
  if (presence) {
    const {details: title, state: artists, syncId: trackId} = presence;
    const trackText = `**${title}** by ${artists.replaceAll(';', ',')}`;
    switch (command) {
      case 'fm':
      case 'np':
      case 's': {
        return `[${trackText}](${`https://open.spotify.com/track/${trackId}`})`;
      }

      case 'fxfm':
      case 'fxnp':
      case 'fxs': {
        return `[${trackText}](${`https://play.spotify.com/track/${trackId}`})`;
      }
    }
  }

  const sanitizedSearchTerm = searchTerm.replace(/[;&|()]/g, '');

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

  const {artist, title, bpm, key, camelot, popularity, spotifyLink} = getInfoFromTrackElement(specificTrack ?? data[0]);
  const trackText = `**${title}** by ${artist}`;
  switch (command) {
    case 'fm':
    case 's': {
      return `[${trackText}](${spotifyLink})`;
    }

    case 'fxfm':
    case 'fxs': {
      return `[${trackText}](${spotifyLink.replace('open.spotify.com', 'play.spotify.com')})`;
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
}
