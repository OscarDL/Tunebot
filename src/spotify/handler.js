import { MessageFlags } from 'discord.js';
import { getServerUser, getSpotifyPresence, isUserListeningToSpotify } from '../discord/index.js';
import { searchLastfmTrack } from '../lastfm/search.js';
import { isUserSavedAsLastfmUser } from '../lastfm/utils.js';
import { getSpotifyTrack, getSpotifyTrackAudioFeatures, searchSpotifyTrack } from './search.js';
import {
  checkMaxRequests,
  getEmbeddedTrackLink,
  isCommandSelfAsk,
  isCommandSpecificSongRequest,
  isCommandUserRequest,
} from '../utils.js';
import { getPitchClassNotation, getTrackDuration } from './utils.js';

/**
 * @param { Object } param0
 * @param { string | undefined } param0.presence
 * @param { Record<string, any> | undefined } param0.spotify
 * @param { string | undefined } param0.userId
 * @returns { string }
 */
const getTrackMessage = ({presence, spotify, userId}) => {
  if (spotify) {
    const {name: title, artists, id: trackId} = spotify;
    return getEmbeddedTrackLink({title, artists, trackId}, userId);
  }

  if (typeof presence === 'string') return presence;
  const {details: title, state: artists, syncId: trackId} = presence;
  return getEmbeddedTrackLink({title, artists: artists.split('; '), trackId}, userId);
};

/**
 * @param { import('discord.js').Message } message
 * @param { string } command
 * @param { Array<string> } args
 * @returns { Promise<void> }
 */
export const handleCommandWithSpotify = async (message, command, args) => {
  const shouldFallbackToLastfm = (userId, presence) =>
    isUserSavedAsLastfmUser(userId) && !isUserListeningToSpotify(presence);

  try {
    /**
     * @type { Array<{
     *   presence?: Record<string, any> | string;
     *   spotify?: Record<string, any>;
     *   userId?: string;
     * }>}
     */
    const tracks = [];
    const isSelfAsk = isCommandSelfAsk(message, args);
    const isUserRequest = isCommandUserRequest(args);
    const isSpecificSongRequest = isCommandSpecificSongRequest(args);

    if (isSelfAsk) {
      const {user, presence} = message.member;

      if (shouldFallbackToLastfm(user.id, presence)) {
        console.log(await searchLastfmTrack(user.id));
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
      if (await checkMaxRequests(message, command, filteredMentions.size, false)) return;

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

    const filteredTracks = tracks.filter((track) => track.presence ?? track.spotify);

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
            content: 'You can only request the cover of a track currently playing that is not a local file.',
          });
        }

        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: filteredTracks[0]?.presence?.assets?.largeImage?.replace('spotify:', 'https://i.scdn.co/image/')
            ?? filteredTracks[0]?.spotify?.cover,
        });
      }

      case 'duration':
      case 'pop': {
        if (filteredTracks.some((track) => typeof track === 'string')) {
          return await message.reply({
            flags: [MessageFlags.SuppressNotifications],
            content: `You can only request the ${command === 'duration' ? 'duration' : 'popularity'} of a track currently playing that is not a local file.`,
          });
        }

        await addMissingSpotifyTracksFromPresences(filteredTracks);

        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: filteredTracks.map((track) => track.spotify).map((track) => (
            `${getEmbeddedTrackLink(track)} ${command === 'duration'
              ? `lasts ${getTrackDuration(track.duration_ms)}`
              : `has a popularity score of **${track.popularity}%** on Spotify.`
            }`
          )).join('\n'),
        });
      }

      case 'bpm': {
        const tracksWithAudioFeatures = await getTracksWithAudioFeatures(message, filteredTracks, 'BPM');

        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: tracksWithAudioFeatures.map((track) => (
            track.features
              ? `${getEmbeddedTrackLink(track.spotify)} has a BPM of **${Math.round(track.features.tempo)}**.`
              : `Could not get audio features for ${getEmbeddedTrackLink(track.spotify)}.`
          )).join('\n'),
        });
      }

      case 'key': {
        const tracksWithAudioFeatures = await getTracksWithAudioFeatures(message, filteredTracks, 'key');

        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: tracksWithAudioFeatures.map((track) => (
            track.features
              ? `${getEmbeddedTrackLink(track.spotify)} is written in **${getPitchClassNotation(track.features.key)}**.`
              : `Could not get audio features for ${getEmbeddedTrackLink(track.spotify)}.`
          )).join('\n'),
        });
      }

      case 'info': {
        const tracksWithAudioFeatures = await getTracksWithAudioFeatures(message, filteredTracks, 'info');

        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: tracksWithAudioFeatures.map((track) => (
            track.features
              ? `${getEmbeddedTrackLink(track.spotify)} has a BPM of **${Math.round(track.features.tempo)}**, is written in **${getPitchClassNotation(track.features.key)}**, and lasts ${getTrackDuration(track.duration_ms)}.`
              : `Could not get audio features for ${getEmbeddedTrackLink(track.spotify)}.`
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

/**
 * @param { import('discord.js').Message } message
 * @param { Array<any> } tracks
 * @param { 'BPM' | 'key' | 'info' } feature 
 * @returns { Promise<Array<{
 *   spotify: Record<string, any>;
 *   features: Awaited<ReturnType<typeof getSpotifyTrackAudioFeatures>>[number];
 * }>> }
 */
const getTracksWithAudioFeatures = async (message, tracks, feature) => {
  if (tracks.some((track) => typeof track === 'string')) {
    return await message.reply({
      flags: [MessageFlags.SuppressNotifications],
      content: `You can only request the ${feature} of a track currently playing that is not a local file.`,
    });
  }

  const spotifyTracks = await addMissingSpotifyTracksFromPresences(tracks);
  const audioFeatures = await getSpotifyTrackAudioFeatures(spotifyTracks.map((track) => track.spotify.id));

  for (const index in spotifyTracks) {
    spotifyTracks[index].features = audioFeatures[index];
  }
  return spotifyTracks;
};

/**
 * @param { Array<{
 *   presence?: Record<string, any> | string;
 *   spotify?: Record<string, any>;
 *   userId?: string;
 * }> } tracks
 * @returns { Promise<Array<{
 *   presence?: Record<string, any> | string;
 *   spotify: Record<string, any>;
 *   userId?: string;
 * }>> }
 */
const addMissingSpotifyTracksFromPresences = async (tracks) => {
  const spotifyTracks = JSON.parse(JSON.stringify(tracks));
  for (const index in tracks) {
    if (tracks[index].presence) {
      spotifyTracks[index].spotify = await getSpotifyTrack(tracks[index].presence.syncId);
    }
  }
  return spotifyTracks;
};
