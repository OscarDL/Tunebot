import { MessageFlags } from 'discord.js';
import { getServerUser, getSpotifyPresence, isUserListeningToSpotify } from '../discord/index.js';
import { searchLastfmTrack } from '../lastfm/search.js';
import { isUserSavedAsLastfmUser } from '../lastfm/utils.js';
import { getSpotifyTrack, searchSpotifyTrack } from './search.js';
import {
  checkMaxRequests,
  getEmbeddedTrackLink,
  isCommandSelfAsk,
  isCommandSpecificSongRequest,
  isCommandUserRequest,
} from '../utils.js';

const getTrackMessage = ({presence, spotify, userId}) => {
  if (spotify) {
    const {name: title, artists, id: trackId} = spotify;
    return getEmbeddedTrackLink({title, artists, trackId}, userId);
  }

  if (typeof presence === 'string') return presence;
  const {details: title, state: artists, syncId: trackId} = presence;
  return getEmbeddedTrackLink({title, artists: artists.split('; '), trackId}, userId);
};

export const handleCommandWithSpotify = async (message, command, args) => {
  const shouldFallbackToLastfm = (userId, presence) =>
    isUserSavedAsLastfmUser(userId) && !isUserListeningToSpotify(presence);

  try {
    const tracks = [];
    const isSelfAsk = isCommandSelfAsk(message, args);
    const isUserRequest = isCommandUserRequest(args);
    const isSpecificSongRequest = isCommandSpecificSongRequest(args);

    if (isSelfAsk) {
      const {user, presence} = message.member;

      if (shouldFallbackToLastfm(user.id, presence)) {
        tracks.push({
          spotify: await searchSpotifyTrack(
            await searchLastfmTrack(user.id),
          ),
        });
      } else {
        tracks.push({
          presence: await getSpotifyPresence(user, presence, true),
        });
      }
    }

    else if (isUserRequest) {
      const {mentions} = message;
      const filteredMentions = mentions.users.filter((user) => user.id !== mentions.repliedUser?.id);

      if (filteredMentions.size === 0) return;

      await checkMaxRequests(message, command, filteredMentions.size, false);
      const users = await Promise.all(
        filteredMentions.map((mention) => getServerUser(message, mention)),
      );

      for (const {user, presence} of users) {
        const userId = user.id;
        if (shouldFallbackToLastfm(userId, presence)) {
          const spotify = await searchSpotifyTrack(
            await searchLastfmTrack(userId),
          );
          tracks.push({ spotify, userId });
        } else {
          tracks.push({
            presence: await getSpotifyPresence(user, presence),
            userId,
          });
        }
      }
    }

    else if (isSpecificSongRequest) {
      const requests = args.join(' ').split(', ');
      if (await checkMaxRequests(message, command, requests.length, true)) return;

      for (const request of requests) {
        tracks.push({
          spotify: await searchSpotifyTrack(request),
        });
      }
    }

    const filteredTracks = tracks.filter((track) => track.presence ?? track.spotify ?? track.lastfm);

    switch (command) {
      case 's':
      case 'np':
      case 'fm':
        // return await message.reply({
        //   flags: [MessageFlags.SuppressNotifications],
        //   content: filteredTracks.map(getTrackMessage).join('\n'),
        // });

      case 'fxs':
      case 'fxnp':
      case 'fxfm': {
        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: filteredTracks.map(getTrackMessage).join('\n')
            .replaceAll('https://open.spotify.com', 'https://play.spotify.com')
        });
      }

      case 'cover': {
        if (filteredTracks.some((track) => typeof track === 'string')) {
          return await message.reply({
            flags: [MessageFlags.SuppressNotifications],
            content: 'You can only request the cover of a track that isLastfmUser currently playing and not a local file.',
          });
        }

        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: filteredTracks[0]?.presence?.assets?.largeImage?.replace('spotify:', 'https://i.scdn.co/image/')
            ?? filteredTracks[0]?.spotify?.cover
            ?? filteredTracks[0]?.lastfm?.image,
        });
      }

      case 'duration':
      case 'pop': {
        if (filteredTracks.some((track) => typeof track === 'string')) {
          return await message.reply({
            flags: [MessageFlags.SuppressNotifications],
            content: `You can only request the ${command === 'duration' ? 'duration' : 'popularity'} of a track that isLastfmUser currently playing and not a local file.`,
          });
        }

        const spotifyTracks = JSON.parse(JSON.stringify(tracks));
        for (const trackIndex in tracks) {
          if (tracks[trackIndex].presence) {
            spotifyTracks[trackIndex].spotify =
              await getSpotifyTrack(tracks[trackIndex].presence.syncId);
          }
        }

        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: spotifyTracks.map((track) => track.spotify).map((track) => (
            `${getEmbeddedTrackLink(track)} ${command === 'duration'
              ? `lasts ${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')} minutes.`
              : `has a popularity score of **${track.popularity}%** on Spotify.`
            }`
          )).join('\n'),
        });
      }
    }
  } catch (error) {
    console.error(error);
    return await message.reply({
      flags: [MessageFlags.SuppressNotifications],
      content: error.message || 'An unknown error occurred.',
    });
  }
};
