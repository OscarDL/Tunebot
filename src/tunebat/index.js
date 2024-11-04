import fetch from 'node-fetch';

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

export const getTunebatTrack = async (command, searchTerm, spotifyTrackName) => {
  const attemptSearch = async () => {
    const sanitizedSearchTerm = searchTerm.filter(Boolean).map((term) => term.replace(/[;&|()]/g, ''));
    const res = await fetch(`https://api.tunebat.com/api/tracks/search?term=${sanitizedSearchTerm.join(' ')}`);

    switch (res.status) {
      case 200:
        break;
      case 429:
        throw new Error('Rate limit exceeded. Please try again later.');
      default:
        throw new Error('Could not fetch data. Tunebat may be having issues.');
    }

    const json = await res.json();

    if (!json.data.items[0]) {
      console.log('failed Tunebat search at', new Date().toLocaleString().split(' ')[1]);
      console.log(json);
    }

    const search = searchTerm.join(' ').toLowerCase();
    if (search.includes('|')) {
      const [one, two] = search.toLowerCase().split('|').map((term) => term.trim());

      return json.data.items.find((track) => (
        track.as.map((a) => a.toLowerCase()).includes(one) && cleanWordsFromTrackName(track.n).toLowerCase() === two ||
        track.as.map((a) => a.toLowerCase()).includes(two) && cleanWordsFromTrackName(track.n).toLowerCase() === one
      ));
    } else if (spotifyTrackName) {
      return json.data.items.find((track) => track.n === spotifyTrackName);
    } else {
      return json.data.items[0];
    }
  };

  let track;
  try {
    track = await attemptSearch();
  } catch (error) {
    console.log(error);
    return error;
  }

  if (!track) {
    // attempt a second search one second after because for some reason
    // sometimes the tunebat api returns nothing even when there is a match
    await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3 seconds
    track = await attemptSearch();
    if (!track) return 'No results found, but Tunebat is probably just a bitch.';
  }

  const {b: bpm, k: key, c: camelot, d: duration, l: label, p: popularity, rd: date, id} = track;
  const trackText = `**${track.n}** by ${track.as.join(', ')}`;
  const length = duration / 1000;
  const minutes = Math.floor(length / 60);
  const seconds = Math.floor(length % 60);
  // const releaseDate = new Intl.DateTimeFormat('en-US', {dateStyle: 'long'}).format(new Date(date));
  // const labelName = label ? ` on ${label}` : '';

  switch (command) {
    case 's':
    case 'spotify': {
      return `[${trackText}](https://open.spotify.com/track/${id})`;
    }

    case 'fm':
    case 'np': {
      return `[${trackText}](https://open.spotify.com/track/${id}) is currently playing.`;
    }

    case 'bpm': {
      return `[${trackText}](<https://open.spotify.com/track/${id}>) is **${bpm} BPM**.`;
    }

    case 'key': {
      return `[${trackText}](<https://open.spotify.com/track/${id}>) is written in **${key}** (${camelot}).`;
    }

    case 'duration': {
      return `[${trackText}](<https://open.spotify.com/track/${id}>) lasts **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**.`;
    }

    case 'pop': {
      return `[${trackText}](<https://open.spotify.com/track/${id}>) has a popularity score of **${popularity}%** on Spotify.`;
    }

    // case 'release': {
    //   return `${trackText} was released on **${releaseDate}**${labelName}.`;
    // }

    case 'info': {
      return (
        `[${trackText}](https://open.spotify.com/track/${id})\n` +
        `BPM: **${bpm}**\n` +
        `Key: **${key}** (${camelot})\n` +
        `Duration: **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**\n` +
        `Popularity: **${popularity}%** \n`// +
        // `Release: **${releaseDate}**${labelName}`
      );
    }

    default:
      break;
  }
};
