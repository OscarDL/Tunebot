import fetch from 'node-fetch';

export const getTunebatSong = async (command, searchTerm) => {
  const sanitizedSearchTerm = searchTerm.map((term) => term.replace(/[;&]/g, ''));
  const res = await fetch(`https://api.tunebat.com/api/tracks/search?term=${sanitizedSearchTerm.join('%20')}`);
  const json = await res.json();

  const track = json.data.items[0];

  if (!track) {
    return 'No results found.';
  }

  const {b: bpm, k: key, c: camelot, d: duration, p: popularity} = track;
  const trackText = `**${track.n}** by ${track.as.join(', ')}`;

  switch (command) {
    case 'bpm': {
      return `${trackText} has **${bpm} BPM**.`;
    }

    case 'key': {
      return `${trackText} is using **${key}** (${camelot}).`;
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
      return `${trackText} has **${bpm} BPM**, is **${key}** (${camelot}), and lasts **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**.`;
    }

    case 'pop': {
      return `${trackText} has a popularity score of **${popularity}%** on Spotify.`;
    }

    default:
      break;
  }
};
