import dotenv from 'dotenv';
import { Client, IntentsBitField } from 'discord.js';

import { getTunebatTrack } from './src/tunebat/index.js';
import { addDipCount, getDips } from './src/vibin/dips.js';
import { getConvertedTemperature } from './src/convert/temp.js';
import { checkShouldPingSpamUser, sendSpamUserMessage } from './src/spam/index.js';

dotenv.config();

const COMMANDS = [
  's',
  'spotify',
  'np',
  'bpm',
  'key',
  'duration',
  'info',
  'pop',
  // 'release',
  'vibindips',
  'temp',
];

const PREFIXES = [
  '>',
  ';',
  ',',
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
    const prefix = noPrefix ? '' : `**${getServerUser(user).nickname}**: `;
    if (!currentTrack) return prefix + empty;
  
    const {details: title, state: artists, assets: {largeText: album}} = currentTrack;
    const track = await getTunebatTrack(command, [artists, title, album], title);
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
  if (command === 'temp') return await message.reply(getConvertedTemperature(args[0]));

  // the rest of the commands are for tunebat
  if (!args || args.length === 0) { // self-ask for current song
    const {user, presence} = message.member;
    const reply = 'No track currently playing, please provide an artist and track name.';
    return await message.reply(await getSpotifyPresence(command, user, presence, reply, true));
  }

  const {mentions} = message;
  const filteredMentions = mentions.users.filter((user) => user.id !== mentions.repliedUser?.id);
  if (filteredMentions.size > 0) { // there's at least one mention in the message and it's not a reply
    if (filteredMentions.size > MAX_TUNEBAT_REQUESTS) {
      return await message.reply(`Please ask for ${MAX_TUNEBAT_REQUESTS} users at most.`);
    }

    const users = filteredMentions.map((mention) => getServerUser(mention));
    const promises = users.map(({user, presence}) => (
      getSpotifyPresence(command, user, presence, 'No track currently playing.')
    ));
    const responses = await Promise.all(promises);

    return await message.reply(responses.join('\n'));
  }

  const requests = args.join(' ').split(',');
  if (requests.length > MAX_TUNEBAT_REQUESTS) {
    return await message.reply(`Please ask for ${MAX_TUNEBAT_REQUESTS} tracks at most.`);
  }

  const promises = requests.map((request) => getTunebatTrack(command, [request]));
  const responses = await Promise.all(promises);

  return await message.reply(responses.join('\n'));
});

client.login(process.env.TOKEN);
