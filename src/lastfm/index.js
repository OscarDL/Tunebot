import fs from 'fs';

import { initiateLogin } from './auth.js';
import { scrobble } from './scrobble.js';
import { unscrobble } from './unscrobble.js';
import users from './users.json' with { type: 'json' };
import { LASTFM_API_URL, MISMATCH_TRACK_SUFFIXES, WHITELISTED_ARTISTS, BLACKLISTED_TITLES } from './utils.js';

/**
 * @param { import('discord.js').Message } message
 * @returns { Promise<string> }
 */
export const setLastfmUsername = async (message) => {
  const userId = message.author.id;

  // Check if the user already exists in the file
  const existingUserIndex = users.findIndex((user) => user.discordId === userId);
  if (existingUserIndex !== -1) {
    return await message.reply('Your last.fm username is already set up, idiot.');
  }

  const lastfmSession = await initiateLogin(message);

  if (existingUserIndex !== -1) {
    // Update existing user
    users[existingUserIndex].lastfm.username = lastfmSession.name;
    users[existingUserIndex].lastfm.sessionKey = lastfmSession.key;
  } else {
    // Add user to the list
    users.push({
      discordId: userId,
      lastfm: {
        username: lastfmSession.name,
        sessionKey: lastfmSession.key,
      },
    });
  }

  // Write updated user back to the file
  fs.writeFileSync('src/lastfm/users.json', JSON.stringify(users, null, 2));
  const reply = `Bot authorization successful! Your last.fm username is saved as **${lastfmSession.name}**.`
    + `\nCommands you send will now use last.fm if you don't use Spotify or share your Discord presence in real time.`
    // + `\nYou can now use the \`opheliafix\` command to re-scrobble tracks impacted by the Ophelia discography redistribution.`
    // + `\n\n⚠️ To also unscrobble your incorrect scrobbles, please reply at any time with a valid session ID token (send it using \`Upload as File\` if it's too long).`
    // + `\nHere's a [screenshot explaining how to get your session ID token](https://i.imgur.com/84owYIB.png) (only possible on a computer)`
    // + `\n\nThis is entirely optional, but recommended if you want to keep your scrobble count accurate. If you don't want to provide a session ID token, just ignore this message.`;
  await message.author.send(reply).catch(() => {}); // Ignore if DMs are closed
  return await message.channel.send(reply);
};

/**
 * @param { import('discord.js').Message } message
 * @returns { Promise<void> }
 */
export const checkForLastfmSessionIdToken = async (message) => {
  const userId = message.author.id;
  const tokenRegex = /\./i;
  const tokenMatch = message.content.match(tokenRegex);

  if (tokenMatch) {
    const sessionId = tokenMatch[0];
    const user = users.find((user) => user.discordId === userId);
    if (user) {
      user.lastfm.sessionId = sessionId;
      fs.writeFileSync('src/lastfm/users.json', JSON.stringify(users, null, 2));
      await message.channel.send(`Session ID token saved successfully!`);
    }
  }
};

/**
 * @param { import('discord.js').Message } message
 * @param { Array<string> } args
 * @returns { Promise<void> }
 */
export const fixOpheliaScrobblesForTimePeriod = async (message, args) => {
  // get user from users storage file
  const user = users.find((user) => user.discordId === message.author.id);
  if (!user) {
    return await message.reply('You need to set your last.fm username first using the `setlastfm` command.');
  }

  let recentsUrl = `${LASTFM_API_URL}?method=user.getrecenttracks&user=${user.lastfm.username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=200`;

  const [timePeriod, forceArg] = args.join(' ').split('-');
  // if no time period is provided, use the current day
  const date = timePeriod ? new Date(timePeriod) : new Date();
  if (isNaN(date)) {
    return await message.reply('Invalid date format. Please provide a valid date.');
  }

  // if we're in early January and the date entered is in late December, use previous year
  if (timePeriod) {
    const now = new Date();
    if (now.getMonth() === 0 && date.getMonth() === 11) {
      date.setFullYear(now.getFullYear() - 1);
    } else {
      date.setFullYear(now.getFullYear());
    }
  }

  const forceScrobble = ['-force', '-f'].includes(`-${forceArg}`);
  // last.fm doesn't allow scrobbling before 14 days ago (or equal to make it easier)
  if (!forceScrobble && Date.now() - date.getTime() >= 14 * 24 * 60 * 60 * 1000) {
    return await message.reply('You cannot fix scrobbles from 2 weeks ago or earlier.');
  }

  // use the UNIX timestamps for the start and end of the day 
  const startOfDay = date.setHours(0, 0, 0, 0) / 1000;
  const endOfDay = date.setHours(23, 59, 59, 0) / 1000;
  recentsUrl += `&from=${startOfDay}&to=${endOfDay}`;

  try {
    const response = await fetch(recentsUrl);
    const data = await response.json();
    if (data.error) {
      return await message.reply(`Error: ${data.message}`);
    }

    console.log(data.recenttracks['@attr'].total + ' scrobbles');
    const tracks = [data.recenttracks.track].flat(1).filter((track) => !!track.date);
    if (!tracks || tracks.length === 0) {
      return await message.reply('No scrobbles found for the specified date.');
    }

    for (const track of tracks) {
      console.log(`\nChecking track: ${track.artist['#text']} - ${track.name}`);

      const featureRegex = new RegExp(`\\b(${BLACKLISTED_TITLES.join('|')})\\b`, 'i');
      if (featureRegex.test(track.name)) {
        console.log(`Skipping blacklisted track: ${track.name}`);
        continue;
      }

      if (!WHITELISTED_ARTISTS.some((name) => track.artist['#text'].toLowerCase() === name)) {
        console.log(`Skipping non-whitelisted artist: ${track.artist['#text']}`);
        continue;
      }

      const searchTracksUrl = `${LASTFM_API_URL}?method=track.search&artist=${encodeURIComponent(track.artist['#text'])}&track=${encodeURIComponent(track.name)}&api_key=${process.env.LASTFM_API_KEY}&format=json`;

      // Wait for the timeout and the API call to complete before continuing
      await new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const response = await fetch(searchTracksUrl);
            const searchData = await response.json();

            if (searchData.error) {
              console.error(`Error searching for track: ${searchData.message}`);
              return resolve(); // Resolve anyway to continue with next track
            }

            const searchResults = searchData.results.trackmatches.track;
            searchResults.sort((a, b) => Number(b.listeners) - Number(a.listeners));

            const suffixRegexMap = new Map(
              MISMATCH_TRACK_SUFFIXES.map(suffix => [
                suffix, 
                new RegExp(`\\b${suffix}\\b`, 'i')
              ])
            );
            const relevantResults = searchResults.filter((result) => {
              return !MISMATCH_TRACK_SUFFIXES.some((suffix) => {
                const regex = suffixRegexMap.get(suffix);
                return (
                  (regex.test(result.name) && !regex.test(track.name)) ||
                  (regex.test(track.name) && !regex.test(result.name)) ||
                  (result.name.split(/[^a-zA-Z\s]/)[0].toLowerCase().trim() !== track.name.split(/[^a-zA-Z\s]/)[0].toLowerCase().trim())
                );
              });
            });

            if (relevantResults.length === 0) {
              console.log(`No results found for ${track.artist['#text']} - ${track.name}`);
              return resolve();
            }

            const sameTrack = relevantResults.find((result) => (
              result.name.toLowerCase() === track.name.toLowerCase() &&
              result.artist.toLowerCase() === track.artist['#text'].toLowerCase()
            ));
            const secondMatch = relevantResults.find((result) => (
              result.name.toLowerCase() !== track.name.toLowerCase() &&
              result.artist.toLowerCase() === track.artist['#text'].toLowerCase()
            ));

            if (
              !secondMatch ||
              // create a ratio between the listeners of the two tracks
              // if the ratio is lower than 0.5, we can rule out the second match
              (Number(secondMatch.listeners) / Number(sameTrack.listeners) < 0.5)
            ) {
              console.log(`Track already matches: ${sameTrack.artist} - ${sameTrack.name}`);
              return resolve();
            }

            const scrobbleTimestamp = forceScrobble
              ? String(Math.floor(Date.now() / 1000))
              : String(track.date.uts);

            await scrobble(
              user.lastfm.sessionKey,
              scrobbleTimestamp,
              secondMatch.artist,
              secondMatch.name,
              track.album['#text'],
            );
            await unscrobble(user, track);

            resolve();
          } catch (error) {
            console.error('Error processing track:', error);
            resolve(); // Resolve anyway to continue with next track
          }
        }, 5000);
      });
    }

    await message.reply('All scrobbles have been fixed for the specified date.');
  } catch (error) {
    console.error('Error fetching scrobbles:', error);
    await message.reply('An error occurred while fetching your scrobbles.');
  }
};
