import dotenv from 'dotenv';
import { Client, IntentsBitField } from 'discord.js';

import { getTunebatTrack } from './src/tunebat/index.js';
import { sendDeedgeMessage } from './src/spam/index.js';
import { addDipCount, getDips } from './src/vibin/dips.js';
import { getConvertedTemperature } from './src/temp/index.js';

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
  
  const getServerUser = (user) => message.guild.members.cache.get(user.id);
  
  const getSpotifyPresence = async (command, user, presence, empty, isMultiple) => {
    const currentTrack = presence?.activities?.find((activity) => activity.name === 'Spotify');
    if (!currentTrack) return empty;
  
    const {details: title, state: artists, assets: {largeText: album}} = currentTrack;
    const prefix = isMultiple ? `**${getServerUser(user).nickname}**: ` : '';
    const track = await getTunebatTrack(command, [artists, title, album]);
    return prefix + track;
  };

  if (message.author.bot) return;

  if (!isMessageCommand(message)) return await sendDeedgeMessage(message);

  await message.channel.sendTyping();

  const isVibinDip = await addDipCount(message);
  if (isVibinDip) return; // don't process the rest of the code if it's a vibin dip

  const content = message.content.slice(1).toLowerCase().split(' ');
  const [command, ...args] = content;

  // vibin dips command
  if (command === 'vibindips') return await getDips(message);

  // temperature conversion command
  if (command === 'temp') return await message.reply(getConvertedTemperature(args[0]));

  // the rest of the commands are for tunebat
  if (!args || args.length === 0) {
    const {user, presence} = message.member;
    const reply = 'No track currently playing, please provide an artist and track name.';
    return await message.reply(await getSpotifyPresence(command, user, presence, reply));
  }

  const {mentions} = message;
  const filteredMentions = mentions.users.filter((user) => user.id !== mentions.repliedUser?.id);
  if (filteredMentions.size > 0) {
    if (filteredMentions.size > MAX_TUNEBAT_REQUESTS) {
      return await message.reply(`Please ask for ${MAX_TUNEBAT_REQUESTS}  users at most.`);
    }

    // there is at least one mention in the message and it's not a reply
    const getReply = (user) => `**${getServerUser(user).nickname}**: no track currently playing.`;

    const users = filteredMentions.map((mention) => getServerUser(mention));
    const promises = users.map(({user, presence}) => (
      getSpotifyPresence(command, user, presence, getReply(user), filteredMentions.size > 1)
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
