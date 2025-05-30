import dotenv from 'dotenv';
import { Client, IntentsBitField, MessageFlagsBitField } from 'discord.js';

import { getTunebatTrack } from './src/tunebat/index.js';
import { getRandomBingoCard } from './src/bingo/index.js';
import { addDipCount, getDips } from './src/vibin/dips.js';
import { getLocalFileTrackInfo } from './src/local/index.js';
import { getConvertedTemperature } from './src/convert/temp.js';
import { checkShouldPingSpamUser, sendSpamUserMessage } from './src/spam/index.js';
import { fixOpheliaScrobblesForTimePeriod, setLastfmUsername } from './src/lastfm/index.js';

dotenv.config();

const COMMANDS = [
  // spotify info commands
  's',
  'fxs',
  'spotify',
  'fm',
  'np',
  'bpm',
  'key',
  'duration',
  'info',
  'pop',
  // vibin dips count command
  'vibindips',
  // temperature conversion
  'temp',
  // create bingo card command
  'bingo',
  // set lastfm username command
  'setlastfm',
  // fix ophelia scrobbles
  'opheliafix',
];

const PREFIXES = [
  ',',
  '>',
];

const MAX_TUNEBAT_REQUESTS = 5;

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

  const getServerUser = async (user) => await message.guild.members.fetch(user.id);

  const getSpotifyPresence = async (command, user, presence, empty, noPrefix) => {
    const currentTrack = presence?.activities?.find((activity) => activity.name === 'Spotify');
    const prefix = noPrefix ? '' : `**${(await getServerUser(user)).nickname}**: `;
    if (!currentTrack) return prefix + empty;
  
    const {details: title, state: artists} = currentTrack;

    // That's a local file, so we don't want to search for it but only send the name
    if (!artists) return await getLocalFileTrackInfo(command, prefix, title);

    const track = await getTunebatTrack(command, `${artists.split(';')[0]} | ${title}`);
    return prefix + track;
  };

  if (message.author.bot) return;

  if (!isMessageCommand(message)) {
    await addDipCount(message);
    await sendSpamUserMessage(message);
    await checkShouldPingSpamUser(message);
    return;
  }

  await message.channel.sendTyping();

  const content = message.content.slice(1).toLowerCase().split(' ');
  const [command, ...args] = content;

  // vibin dips command
  if (command === 'vibindips') return await getDips(message);

  // temperature conversion command
  if (command === 'temp') return await getConvertedTemperature(message, args[0]);

  // random bingo card creation
  if (command === 'bingo') return await getRandomBingoCard(message);

  // set lastfm username command
  if (command === 'setlastfm') return await setLastfmUsername(message, args[0]);

  // fix ophelia scrobbles command
  if (command === 'opheliafix') return await fixOpheliaScrobblesForTimePeriod(message, args.join(' '));

  // the rest of the commands are for tunebat
  if (!args || args.length === 0) { // self-ask for current song
    const {user, presence} = message.member;
    const reply = 'No track currently playing.';
    return await message.reply(await getSpotifyPresence(command, user, presence, reply, true));
  }

  const {mentions} = message;
  const filteredMentions = mentions.users.filter((user) => user.id !== mentions.repliedUser?.id);
  if (filteredMentions.size > 0) { // there's at least one mention in the message and it's not a reply
    if (filteredMentions.size > MAX_TUNEBAT_REQUESTS) {
      return await message.reply(`Please ask for ${MAX_TUNEBAT_REQUESTS} users at most.`);
    }

    const users = await Promise.all(filteredMentions.map(async (mention) => await getServerUser(mention)));
    const promises = await Promise.all(users.map(({user, presence}) => (
      getSpotifyPresence(command, user, presence, 'No track currently playing.')
    )));
    const responses = await Promise.all(promises);

    return await message.reply(responses.join('\n'));
  }

  const requests = args.join(' ').split(',');
  if (requests.length > MAX_TUNEBAT_REQUESTS) {
    return await message.reply(`Please ask for ${MAX_TUNEBAT_REQUESTS} tracks at most.`);
  }

  const promises = requests.map((request) => getTunebatTrack(command, request, true));
  const responses = await Promise.all(promises);

  return await message.reply(responses.join('\n'));
});

client.login(process.env.TOKEN);
