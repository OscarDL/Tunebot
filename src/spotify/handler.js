import { MessageFlags } from 'discord.js';
import { getServerUser, getSpotifyPresence } from '../discord/index.js';
import { getSpotifyTrack, searchSpotifyTrack } from './search.js';
import { checkMaxRequests, getEmbeddedTrackLink } from '../utils.js';

const getTrackMessage = ({presence, apiTrack}) => {
  if (apiTrack) {
    const {name: title, artists, id: trackId} = apiTrack;
    return getEmbeddedTrackLink({title, artists: artists.map((a) => a.name), trackId});
  }

  if (typeof presence === 'string') return presence;
  const {details: title, state: artists, syncId: trackId} = presence;
  return getEmbeddedTrackLink({title, artists: artists.split('; '), trackId});
};

export const handleSpotifyCommand = async (message, command, args) => {
  try {
    const tracks = [];

    const isSelfAsk = !args || args.length === 0 ||
      (args.length === 1 && args[0] === `<@${message.author.id}>`);

    const isUserRequest = args && args.length > 0 && args.some(arg => /(.)*<@\d+>(.)*/.test(arg));
    const isSpecificSongRequest = args && args.length > 0 && args.some(arg => /(.)*<@\d+>(.)*/.test(arg)) === false;

    if (isSelfAsk) {
      const {user, presence} = message.member;
      tracks.push({
        presence: await getSpotifyPresence(user, presence, isSelfAsk),
      });
    }

    else if (isUserRequest) {
      const {mentions} = message;
      const filteredMentions = mentions.users.filter((user) => user.id !== mentions.repliedUser?.id);

      if (filteredMentions.size > 0) {
        await checkMaxRequests(command, filteredMentions.size, false);

        const users = await Promise.all(
          filteredMentions.map((mention) => getServerUser(message, mention)),
        );
        for (const {user, presence} of users) {
          tracks.push({
            presence: await getSpotifyPresence(user, presence),
          });
        }
      }
    }

    else if (isSpecificSongRequest) {
      const requests = args.join(' ').split(', ');
      await checkMaxRequests(command, requests.length, true);

      for (const request of requests) {
        tracks.push({
          apiTrack: await searchSpotifyTrack(request),
        });
      }
    }

    switch (command) {
      case 's':
      case 'np':
      case 'fm':
        // return await message.reply({
        //   flags: [MessageFlags.SuppressNotifications],
        //   content: tracks.map(getTrackMessage).join('\n'),
        // });

      case 'fxs':
      case 'fxnp':
      case 'fxfm': {
        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: tracks.map(getTrackMessage).join('\n')
            .replaceAll('https://open.spotify.com', 'https://play.spotify.com')
        });
      }

      case 'cover': {
        if (tracks.some((track) => typeof track === 'string')) {
          return await message.reply({
            flags: [MessageFlags.SuppressNotifications],
            content: 'You can only request the cover of a track that is currently playing and not a local file.',
          });
        }

        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: tracks[0].presence.assets.largeImage.replace('spotify:', 'https://i.scdn.co/image/')
            ?? tracks[0].apiTrack.album.images[0].url,
        });
      }

      case 'duration':
      case 'pop': {
        if (tracks.some((track) => typeof track === 'string')) {
          return await message.reply({
            flags: [MessageFlags.SuppressNotifications],
            content: `You can only request the ${command === 'duration' ? 'duration' : 'popularity'} of a track that is currently playing and not a local file.`,
          });
        }

        const spotifyTracks = JSON.parse(JSON.stringify(tracks));
        for (const trackIndex in tracks) {
          if (tracks[trackIndex].presence) {
            spotifyTracks[trackIndex].apiTrack =
              await getSpotifyTrack(tracks[trackIndex].presence.syncId);
          }
        }

        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: spotifyTracks.map((track) => track.apiTrack).map(({name, trackId, ...track}) => {
            return `<${getEmbeddedTrackLink({name, artists: track.artists.map((a) => a.name), trackId})}> ${
              command === 'duration'
                ? `lasts ${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')} minutes.`
                : `has a popularity score of **${track.popularity}%** on Spotify.`
            }`;
          }).join('\n'),
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
