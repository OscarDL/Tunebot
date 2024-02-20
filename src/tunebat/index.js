import fetch from 'node-fetch';

export const getTunebatTrack = async (command, searchTerm, spotifyTrackName) => {
  const attemptSearch = async () => {
    const sanitizedSearchTerm = searchTerm.map((term) => term.replace(/[;&()]/g, ''));
    const res = await fetch(`https://api.tunebat.com/api/tracks/search?term=${sanitizedSearchTerm.join('%20')}`);
    const json = await res.json();

    const match = json.data.items.find((track) => track.n === spotifyTrackName);
    return match ?? json.data.items[0];
  };

  let track = await attemptSearch();

  if (!track) {
    // attempt a second time because sometimes tunebat api returns nothing once
    track = await attemptSearch();
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

    case 'np': {
      return `[${trackText}](https://open.spotify.com/track/${id}) is currently playing.`;
    }

    case 'bpm': {
      return `${trackText} is **${bpm} BPM**.`;
    }

    case 'key': {
      return `${trackText} is written in **${key}** (${camelot}).`;
    }

    case 'duration': {
      return `${trackText} lasts **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**.`;
    }

    case 'pop': {
      return `${trackText} has a popularity score of **${popularity}%** on Spotify.`;
    }

    // case 'release': {
    //   return `${trackText} was released on **${releaseDate}**${labelName}.`;
    // }

    case 'info': {
      return (
        `${trackText}:\n` +
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
