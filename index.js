import dotenv from 'dotenv';
import { Client, IntentsBitField, MessageFlags } from 'discord.js';

import { getRandomBingoCard } from './src/bingo/index.js';
import { getConvertedTemperature } from './src/convert/temp.js';
import { runGoogleBrowserInstance } from './src/google/index.js';
import { fixOpheliaScrobblesForTimePeriod, setLastfmUsername } from './src/lastfm/index.js';
import { fixEmbeddedLink } from './src/linkfix/index.js';
import { getServerUser, getSpotifyPresence } from './src/discord/index.js';
import { checkShouldPingSpamUser, sendSpamUserMessage } from './src/spam/index.js';
import { repeatTypingDuringCommand } from './src/utils.js';
import { fetchTrackInfo } from './src/tunebat/index.js';
import { runTunebatBrowserInstance } from './src/tunebat/browser.js';
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
  // 'setlastfm',
  // fix ophelia scrobbles
  // 'opheliafix',
];

const PREFIXES = [
  '$',
  '$',
];

const MAX_USER_REQUESTS = 3;
const MAX_SONG_REQUESTS = 10;

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

  const getNowPlayingMessage = (spotifyPresence, domain = 'open') => {
    if (typeof spotifyPresence === 'string') return spotifyPresence;
    const {details: title, state: artists, syncId: trackId} = spotifyPresence;
    const trackText = `**${title}** by ${artists.replaceAll(';', ',')}`;
    return `[${trackText}](${`https://${domain}.spotify.com/track/${trackId}`})`;
  };

  // the rest of the commands are for tunebat
  await repeatTypingDuringCommand(message, async () => {
    const tracks = [];

    const isSelfAsk = !args || !args.length ||
      (args.length === 1 && args[0] === `<@${message.author.id}>`);

    const isSpecificSongRequest = args && args.length > 0 && !args[0].startsWith('<@');

    if (isSelfAsk) {
      const {user, presence} = message.member;
      tracks.push(await getSpotifyPresence(user, presence, isSelfAsk));
    }

    else if (isSpecificSongRequest) {
      const requests = args.join(' ').split(', ');
      if (requests.length > MAX_SONG_REQUESTS) {
        return await message.reply(`Please ask for ${MAX_SONG_REQUESTS} tracks at most.`);
      }

      const responses = [];
      await runGoogleBrowserInstance(message, async (page) => {
        const acceptCookiesButton = await page.$(
          'div[aria-modal="true"][role="dialog"] button:has(div[role="none"]) + button:has(div[role="none"])',
        );
        await acceptCookiesButton.click();

        for (const request of requests) {
          const sanitizedSearchTerm = request.replace(/[;&|()]/g, '');
          const searchBox = await page.$('textarea[name="q"]');
          await searchBox.click();
          // empty the search box first
          await page.keyboard.down('Control');
          await page.keyboard.press('A');
          await page.keyboard.up('Control');
          await page.keyboard.press('Backspace');
          // type the new search term
          await searchBox.type(sanitizedSearchTerm + ' site:tunebat.com');
          await page.keyboard.press('Enter');
          // if captcha, find the checkbox by its position and click it
          await new Promise(resolve => setTimeout(resolve, 10000));
          const recaptchaBox = await page.waitForSelector('iframe[title="reCAPTCHA"]');
          const { x, y } = await recaptchaBox.boundingBox();
          await page.mouse.click(x + 20, y + 40);
          await new Promise(resolve => setTimeout(resolve, 150000));

          // wait for results to load
          await page.$('#search');
          await new Promise(resolve => setTimeout(resolve, 150000));
          // responses.push(await fetchTrackInfo({command, page, searchTerm: sanitizedSearchTerm, isExplicitSearch: true}));
        }
      });
    }

    else {
      const {mentions} = message;
      const filteredMentions = mentions.users.filter((user) => user.id !== mentions.repliedUser?.id);

      if (filteredMentions.size > 0) {
        // there's at least one mention in the message and it's not a reply
        if (filteredMentions.size > MAX_USER_REQUESTS) {
          return await message.reply(`Please ask for ${MAX_USER_REQUESTS} users at most.`);
        }

        const users = await Promise.all(
          filteredMentions.map((mention) => getServerUser(message, mention)),
        );
        for (const {user, presence} of users) {
          tracks.push(await getSpotifyPresence(user, presence));
        }
      }
    }

    switch (command) {
      case 's':
      case 'np':
      case 'fm':
        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: tracks.map(getNowPlayingMessage).join('\n'),
        });

      case 'fxs':
      case 'fxnp':
      case 'fxfm': {
        return await message.reply({
          flags: [MessageFlags.SuppressNotifications],
          content: tracks.map((track) => getSpotifyPresence(track, 'play')).join('\n'),
        });
      }
    }

    // await runTunebatBrowserInstance(message, async (page) => {
    //   const requests = args.join(' ').split(', ');
    //   if (requests.length > MAX_USER_REQUESTS) {
    //     return await message.reply(`Please ask for ${MAX_USER_REQUESTS} tracks at most.`);
    //   }

    //   const responses = [];
    //   for (const request of requests) {
    //     responses.push(await fetchTrackInfo({command, page, searchTerm: request, isExplicitSearch: true}));
    //   }

    //   return await message.reply(responses.join('\n'));
    // });
  });
});

client.login(process.env.TOKEN);
