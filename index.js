import dotenv from 'dotenv';
import { Client, IntentsBitField } from 'discord.js';

import { getTunebatSong } from './src/tunebat/index.js';
import { sendDeedgeMessage } from './src/deedge/index.js';
import { addDipCount, getDips } from './src/vibin/dips.js';

dotenv.config();

// const getPersonMessage = require('./src/person_message');

const COMMANDS = [
  'bpm',
  'key',
  'duration',
  'info',
  'pop',
  'vibindips',
  // 'timezone',
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
  // if (message.content.toLowerCase() === 'justin') {
  //   // get last message of justin (justinxls)
  //   return message.channel.send(await getPersonMessage(message, 'justinxls', 'MEAT NOW!'));
  // }
  
  const isVibinDip = await addDipCount(message);
  if (isVibinDip) return; // don't process the rest of the code if it's a vibin dip
  
  const isDeedgeMessage = await sendDeedgeMessage(message);
  if (isDeedgeMessage) return; // don't process the rest of the code if it's a deedge message
  
  if (message.author.bot) return;
  if (message.content[0] !== '>') return; 
  
  const content = message.content.slice(1).toLowerCase().split(' ');
  const [command, ...args] = content;
  if (!COMMANDS.includes(command)) return;
  
  if (command === 'vibindips') return getDips();
  
  if (!args || args.length === 0) {
    // get current spotify song playing
    const currentSong = message.member.presence.activities.find((activity) => activity.name === 'Spotify');
    if (!currentSong) {
      return await message.reply('No song currently playing, please provide an artist and song name.');
    }

    const {details: title, state: artists} = currentSong;
    return await getTunebatSong(message, command, [artists.replace(';', ' '), title]);
  }

  return await getTunebatSong(message, command, args);
});

client.login(process.env.TOKEN);
