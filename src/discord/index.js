import { getLocalFileTrackInfo } from '../local/index.js';
import { getNowPlayingPrefix } from '../utils.js';

export const getServerUser = async (message, user) => await message.guild.members.fetch(user.id);

export const getSpotifyPresence = async (user, presence, isSelfAsk) => {
  const currentTrack = presence?.activities?.find((activity) => activity.name === 'Spotify');
  const prefix = getNowPlayingPrefix(isSelfAsk, user.id);
  if (!currentTrack) return prefix + 'No track currently playing.';

  const {details: title, state: artists} = currentTrack;

  // That's a local file, so we don't want to search for it but only send the name
  if (!artists) return await getLocalFileTrackInfo(prefix, title);

  return currentTrack;
};
