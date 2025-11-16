import { isUserSavedAsLastfmUser } from '../lastfm/utils.js';
import { getLocalFileTrackInfo } from '../local/index.js';

/**
 * @param { import('discord.js').Message } message
 * @param { import('discord.js').User } user
 * @returns { Promise<import('discord.js').GuildMember> }
 */
export const getServerUser = async (message, user) => await message.guild.members.fetch(user.id);

/**
 * @param { import('discord.js').PresenceData | null | undefined } presence
 * @returns { boolean }
 */
export const isUserListeningToSpotify = (presence) => {
  return presence?.activities?.some((activity) => activity.name === 'Spotify');
};

/**
 * @param { import('discord.js').User } user
 * @param { import('discord.js').PresenceData | null | undefined } presence
 * @param { boolean } isSelfAsk
 * @returns { Promise<import('discord.js').Activity & { prefix: string } | string> }
 */
export const getSpotifyPresence = async (user, presence, isSelfAsk = false) => {
  const currentTrack = presence?.activities?.find((activity) => activity.name === 'Spotify');
  const prefix = isSelfAsk ? '' : `**<@${user.id}>**: `;

  if (!currentTrack) {
    const lastfmHint = `\n${prefix ? 'They' : 'You'} can fallback commands to last.fm by linking ${prefix ? 'their' : 'your'} account with the \`setlastfm\` command.`;
    return prefix + 'No track currently playing.' + (!isUserSavedAsLastfmUser(user.id) ? lastfmHint : '');
  }

  const {details: title, state: artists} = currentTrack;

  // That's a local file, so we don't want to search for it but only send the name
  if (!artists) return await getLocalFileTrackInfo(prefix, title);

  return { ...currentTrack, prefix };
};
