import fetch from 'node-fetch';

export const getTunebatSong = async (message, command, searchTerm) => {
  const res = await fetch(`https://api.tunebat.com/api/tracks/search?term=${searchTerm.join('%20')}`);
  const json = await res.json();

  const track = json.data.items[0];

  if (!track) {
    await message.reply('No results found.');
    return;
  }

  const {b: bpm, k: key, c: camelot, d: duration, p: popularity} = track;
  const trackText = `**${track.n}** by ${track.as.join(', ')}`;

  switch (command) {
    case 'bpm': {
      await message.reply(`${trackText} has **${bpm} BPM**.`);
      break;
    }

    case 'key': {
      await message.reply(`${trackText} is using **${key}** (${camelot}).`);
      break;
    }

    case 'duration': {
      const length = duration / 1000;
      const minutes = Math.floor(length / 60);
      const seconds = Math.floor(length % 60);
      await message.reply(`${trackText} lasts **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**.`);
      break;
    }

    case 'info': {
      const length = duration / 1000;
      const minutes = Math.floor(length / 60);
      const seconds = Math.floor(length % 60);
      await message.reply(`${trackText} has **${bpm} BPM**, is **${key}** (${camelot}), and lasts **${minutes}:${seconds < 10 ? '0' : ''}${seconds}**.`);
      break;
    }

    case 'pop': {
      await message.reply(`${trackText} has a popularity score of **${popularity}%** on Spotify.`);
      break;
    }

    default:
      break;
  }
};
