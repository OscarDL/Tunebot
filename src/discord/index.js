import { isUserSavedAsLastfmUser } from '../lastfm/utils.js';
import { getLocalFileTrackInfo } from '../local/index.js';

export const getServerUser = async (message, user) => await message.guild.members.fetch(user.id);

export const isUserListeningToSpotify = (presence) => {
  return presence?.activities?.some((activity) => activity.name === 'Spotify');
};

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
