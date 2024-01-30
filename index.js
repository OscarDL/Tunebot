import dotenv from 'dotenv';
import { Client, IntentsBitField } from 'discord.js';

import { getTunebatSong } from './src/tunebat/index.js';
import { sendDeedgeMessage } from './src/deedge/index.js';
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

  const isVibinDip = await addDipCount(message);
  if (isVibinDip) return; // don't process the rest of the code if it's a vibin dip

  const isDeedgeMessage = await sendDeedgeMessage(message);
  if (isDeedgeMessage) return; // don't process the rest of the code if it's a deedge message

  if (message.author.bot) return;
  if (!PREFIXES.includes(message.content[0])) return; 

  const content = message.content.slice(1).toLowerCase().split(' ');
  const [command, ...args] = content;
  if (!COMMANDS.includes(command)) return;

  if (command === 'vibindips') return await getDips(message);

  if (!args || args.length === 0) {
    // get current spotify song playing
    const currentSong = message.member.presence.activities.find((activity) => activity.name === 'Spotify');
    if (!currentSong) {
      return await message.reply('No song currently playing, please provide an artist and song name.');
    }

    const {details: title, state: artists} = currentSong;
    return await message.reply(await getTunebatSong(command, [artists, title]));
  }

  let reply = [];
  const requests = args.join(' ').split(',');

  for (const request of requests) {
    reply.push(await getTunebatSong(command, [request]));
  };

  return await message.reply(reply.join('\n'));
});

client.login(process.env.TOKEN);
