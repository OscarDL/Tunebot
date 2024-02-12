import fetch from 'node-fetch';

export const getTunebatTrack = async (command, searchTerm) => {
  const sanitizedSearchTerm = searchTerm.map((term) => term.replace(/[;&()]/g, ''));
  const res = await fetch(`https://api.tunebat.com/api/tracks/search?term=${sanitizedSearchTerm.join('%20')}`);
  const json = await res.json();

  const track = json.data.items[0];

  if (!track) {
    console.warn(searchTerm);
    console.warn(`https://api.tunebat.com/api/tracks/search?term=${sanitizedSearchTerm.join('%20')}`);
    console.warn(track);
    return 'No results found.';
  }

  const {b: bpm, k: key, c: camelot, d: duration, p: popularity, id} = track;
  const trackText = `**${track.n}** by ${track.as.join(', ')}`;

  switch (command) {
    case 's':
    case 'np': {
      return `https://open.spotify.com/track/${id}`;
    }

    case 'bpm': {
      return `${trackText} is **${bpm} BPM**.`;
    }

    case 'key': {
      return `${trackText} is written in **${key}** (${camelot}).`;
    }

    case 'duration': {
      const length = duration / 1000;
      const minutes = Math.floor(length / 60);
      const seconds = Math.floor(length % 60);
      return `${trackText} lasts **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**.`;
    }

    case 'info': {
      const length = duration / 1000;
      const minutes = Math.floor(length / 60);
      const seconds = Math.floor(length % 60);
      return `${trackText} is **${bpm} BPM**, is written in **${key}** (${camelot}), and lasts **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**.`;
    }

    case 'pop': {
      return `${trackText} has a popularity score of **${popularity}%** on Spotify.`;
    }

    default:
      break;
  }
};
