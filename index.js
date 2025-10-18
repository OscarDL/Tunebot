import dotenv from 'dotenv';
import { ChannelType, Client, IntentsBitField, Partials } from 'discord.js';

import { getRandomBingoCard } from './src/bingo/index.js';
import { getConvertedTemperature } from './src/convert/temp.js';
import { fixOpheliaScrobblesForTimePeriod, setLastfmUsername } from './src/lastfm/index.js';
import { fixEmbeddedLink } from './src/linkfix/index.js';
import { checkShouldPingSpamUser, sendSpamUserMessage } from './src/spam/index.js';
import { handleSpotifyCommand } from './src/spotify/handler.js';
import { COMMANDS, getCommandTypeFromCommand } from './src/types.js';
import { addDipCount, getDips } from './src/vibin/dips.js';

dotenv.config();

const PREFIXES = [
  ',',
  '>',
];

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.DirectMessages,
  ],
  partials: [
    Partials.Channel,
  ],
});


// --- CLIENT EVENTS --- //


client.on('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.channel.type === ChannelType.DM && !message.author.bot) {
    // return await checkForLastfmSessionIdToken(message);
  }

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

  await message.channel.sendTyping();

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

  // handle spotify related commands
  if (getCommandTypeFromCommand(command) === 'music') {
    return await repeatTypingDuringCommand(message, async () => {
      await handleSpotifyCommand(message, command, args);
    });
  }

  if (getCommandTypeFromCommand(command) === 'lastfm') {
    return await repeatTypingDuringCommand(message, async () => {
      await handleLastfmCommand(message, command, args);
    });
  }
});

client.login(process.env.TOKEN);
