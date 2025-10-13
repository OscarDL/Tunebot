import dotenv from 'dotenv';
import { Client, IntentsBitField, MessageFlags } from 'discord.js';

import { getRandomBingoCard } from './src/bingo/index.js';
import { getConvertedTemperature } from './src/convert/temp.js';
// import { runGoogleBrowserInstance } from './src/google/index.js';
import { fixOpheliaScrobblesForTimePeriod, setLastfmUsername } from './src/lastfm/index.js';
import { fixEmbeddedLink } from './src/linkfix/index.js';
import { getServerUser, getSpotifyPresence } from './src/discord/index.js';
import { checkShouldPingSpamUser, sendSpamUserMessage } from './src/spam/index.js';
import { getSpotifyTrack, searchSpotifyTrack } from './src/spotify/search.js';
// import { fetchTrackInfo } from './src/tunebat/index.js';
// import { runTunebatBrowserInstance } from './src/tunebat/browser.js';
import { checkMaxRequests, getEmbeddedTrackLink, repeatTypingDuringCommand } from './src/utils.js';
import { addDipCount, getDips } from './src/vibin/dips.js';

dotenv.config();

const COMMANDS = [
  // spotify info commands
  's',
  'fxs',
  'fm',
  'fxfm',
  'np',
  'fxnp',
  'cover',
  'duration',
  'pop',
  // 'bpm',  // disabled until tunebat works again
  // 'key',  // disabled until tunebat works again
  // 'info', // disabled until tunebat works again
  /* --- vibin dips count command --- */
  'vibindips',
  /* --- temperature conversion --- */
  'temp',
  /* --- create bingo card command --- */
  'bingo',
  /* --- set lastfm username command --- */
  // 'setlastfm',
  /* --- fix ophelia scrobbles --- */
  // 'opheliafix',
];

const PREFIXES = [
  ',',
  '>',
];

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildPresences,
  ],
});


// --- CLIENT EVENTS --- //


client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  const isMessageCommand = () => {
    const prefix = message.content[0];
    const command = message.content.slice(1).toLowerCase().split(' ')[0];
    return PREFIXES.includes(prefix) && COMMANDS.includes(command);
  };

  if (message.author.bot) return;

  if (!isMessageCommand(message)) {
    await addDipCount(message);
    await fixEmbeddedLink(message);
    await sendSpamUserMessage(message);
    await checkShouldPingSpamUser(message);
    return;
  }

  const content = message.content.slice(1).toLowerCase().split(' ');
  const [command, ...args] = content;

  message.channel.sendTyping();

  // fix ophelia scrobbles command
  if (command === 'opheliafix') {
    return await repeatTypingDuringCommand(message, async () => {
      await fixOpheliaScrobblesForTimePeriod(message, args.join(' '));
    });
  }

  // vibin dips command
  if (command === 'vibindips') return await getDips(message);

  // temperature conversion command
  if (command === 'temp') return await getConvertedTemperature(message, args[0]);

  // random bingo card creation
  if (command === 'bingo') return await getRandomBingoCard(message);

  // set lastfm username command
  if (command === 'setlastfm') return await setLastfmUsername(message, args[0]);

  const getTrackMessage = ({presence, apiTrack}) => {
    if (apiTrack) {
      const {name: title, artists, id: trackId} = apiTrack;
      return getEmbeddedTrackLink({title, artists: artists.map((a) => a.name), trackId});
    }

    if (typeof presence === 'string') return presence;
    const {details: title, state: artists, syncId: trackId} = presence;
    return getEmbeddedTrackLink({title, artists: artists.split(';'), trackId});
  };

  // the rest of the commands are for tunebat
  await repeatTypingDuringCommand(message, async () => {
    try {
      const tracks = [];

      const isSelfAsk = !args || args.length === 0 ||
        (args.length === 1 && args[0] === `<@${message.author.id}>`);

      const isSpecificSongRequest = args && args.length > 0 && args.some(arg => /(.)*<@\d+>(.)*/.test(arg)) === false;

      if (isSelfAsk) {
        const {user, presence} = message.member;
        tracks.push({
          presence: await getSpotifyPresence(user, presence, isSelfAsk),
        });
      }

      else if (!isSpecificSongRequest) {
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

      else {
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
          return await message.reply({
            flags: [MessageFlags.SuppressNotifications],
            content: tracks.map(getTrackMessage).join('\n'),
          });

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
  });
});

client.login(process.env.TOKEN);
