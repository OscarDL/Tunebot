import { MessageFlags } from 'discord.js';
import { generateMd5HashSig } from './auth.js';
import users from './users.json' with { type: 'json' };
import { LASTFM_API_URL } from './utils.js';

/**
 * @param { Object } message - Discord message object
 * @param { string } userId - user ID
 * @returns { Promise<Object | null> }
 */
export const searchLastfmTrack = async (message, userId) => {
  try {
    const user = users.find((u) => u.discordId === userId);
    if (!user || !user.lastfm || !user.lastfm.username) return null;

    const url = `${LASTFM_API_URL}?api_key=${process.env.LASTFM_API_KEY}&method=user.getrecenttracks&user=${encodeURIComponent(user.lastfm.username)}&limit=1`;
    const res = await fetch(`${url}&api_sig=${generateMd5HashSig(url)}&format=json`);
    const data = await res.json();

    if (data.error) throw new Error(data.message || 'An unknown error occurred.');
    if (data.recenttracks.track.length === 0) return null;

    const track = data.recenttracks.track[0];
    return `${track.artist['#text']} | ${track.name}`;
  } catch (error) {
    console.error(error);
    return await message.reply({
      flags: [MessageFlags.SuppressNotifications],
      content: error.message || 'An unknown error occurred.',
    });
  }
};
