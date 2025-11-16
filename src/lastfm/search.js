import { generateMd5HashSig } from './auth.js';
import users from './users.json' with { type: 'json' };
import { LASTFM_API_URL } from './utils.js';

/**
 * @param { import('discord.js').Message } message
 * @param { string } userId
 * @returns { Promise<string> }
 */
export const searchLastfmTrack = async (userId) => {
  try {
    const user = users.find((u) => u.discordId === userId);
    if (!user || !user.lastfm || !user.lastfm.username) {
      throw new Error('User has not connected their Last.fm with the `setlastfm` command.');
    }

    const url = `${LASTFM_API_URL}?api_key=${process.env.LASTFM_API_KEY}&method=user.getrecenttracks&user=${encodeURIComponent(user.lastfm.username)}&limit=1`;
    const res = await fetch(`${url}&api_sig=${generateMd5HashSig(url)}&format=json`);
    const data = await res.json();

    if (data.error) {
      throw new Error(data.message || 'An unknown error occurred.');
    }
    if (data.recenttracks.track.length === 0) {
      throw new Error('No recent tracks found on Last.fm.');
    }

    const track = data.recenttracks.track[0];
    return `${track.artist['#text']} | ${track.name}`;
  } catch (error) {
    throw new Error(error.message || 'An unknown error occurred.');
  }
};
