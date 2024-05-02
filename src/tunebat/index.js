import fetch from 'node-fetch';

export const getTunebatTrack = async (command, searchTerm, spotifyTrackName) => {
  const attemptSearch = async () => {
    const sanitizedSearchTerm = searchTerm.map((term) => term.replace(/[;&|()]/g, ''));
    const res = await fetch(`https://api.tunebat.com/api/tracks/search?term=${sanitizedSearchTerm.join('%20')}`);
    const json = await res.json();

    const search = searchTerm.join(' ').toLowerCase();
    if (search.includes('|')) {
      const [one, two] = search.toLowerCase().split('|').map((term) => term.trim());
      return json.data.items.find((track) => (
        track.as.map((a) => a.toLowerCase()).includes(one) && track.n.toLowerCase() === two ||
        track.as.map((a) => a.toLowerCase()).includes(two) && track.n.toLowerCase() === one
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
    console.log(error)
    return 'Could not fetch data. Tunebat may be having issues.';
  }

  if (!track) {
    // attempt a second search, because for some reason sometimes
    // the tunebat api returns nothing even when there is a match
    track = await attemptSearch();
    console.warn('Second search:');
    console.warn(track);
    if (!track) return 'No results found.';
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
