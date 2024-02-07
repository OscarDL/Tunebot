import dotenv from 'dotenv';
import { Client, IntentsBitField } from 'discord.js';

import { getTunebatSong } from './src/tunebat/index.js';
import { sendDeedgeMessage } from './src/spam/index.js';
import { addDipCount, getDips } from './src/vibin/dips.js';

dotenv.config();

const COMMANDS = [
  's',
  'np',
  'bpm',
  'key',
  'duration',
  'info',
  'pop',
  'vibindips',
];

const PREFIXES = [
  '>',
  ';',
  ',',
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

const isMessageCommand = (message) => {
  const prefix = message.content[0];
  const command = message.content.slice(1).toLowerCase().split(' ')[0];
  return PREFIXES.includes(prefix) && COMMANDS.includes(command);
};

const getSpotifyPresence = async (command, user, empty, isMultiple) => {
  const currentSong = user.presence.activities.find((activity) => activity.name === 'Spotify');
  if (!currentSong) return empty;

  const {details: title, state: artists, assets: {largeText: album}} = currentSong;
  const prefix = isMultiple ? `<@${user.id}>: ` : '';
  const song = await getTunebatSong(command, [artists, title, album]);
  return prefix + song;
};


// --- CLIENT EVENTS --- //


client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  // const username = 'xxx';
  // const text = 'yyy';
  // if (message.content.toLowerCase() === username) {
  //   // get last message of username
  //   return message.channel.send(await getPersonMessage(message, username, text));
  // }

  if (message.author.bot) return;

  if (!isMessageCommand(message)) return await sendDeedgeMessage(message);

  await message.channel.sendTyping();

  const isVibinDip = await addDipCount(message);
  if (isVibinDip) return; // don't process the rest of the code if it's a vibin dip

  const content = message.content.slice(1).toLowerCase().split(' ');
  const [command, ...args] = content;

  if (command === 'vibindips') return await getDips(message);

  if (!args || args.length === 0) {
    const reply = 'No song currently playing, please provide an artist and song name.';
    return await message.reply(await getSpotifyPresence(command, message.member, reply));
  }

  const mentions = message.mentions?.users;
  if (mentions && mentions.first()) { // there's at least one mention
    const getReply = (user) => `No song currently playing for **${user.username}**.`;

    const users = mentions.map((mention) => message.guild.members.cache.get(mention.id));
    const promises = users.map((user) => getSpotifyPresence(command, user, getReply(user), users.length > 1));
    const responses = await Promise.all(promises);

    return await message.reply(responses.join('\n'));
  }

  const requests = args.join(' ').split(',');
  const promises = requests.map((request) => getTunebatSong(command, [request]));
  const responses = await Promise.all(promises);

  return await message.reply(responses.join('\n'));
});

client.login(process.env.TOKEN);
