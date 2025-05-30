import fs from 'fs';

import { generateMd5HashSig, initiateLogin } from './auth.js';
import { unscrobble } from './unscrobble.js';
import users from './users.json' with { type: 'json' };
import { LASTFM_API_KEY, LASTFM_API_URL, MISMATCH_TRACK_SUFFIXES, WHITELISTED_ARTISTS, BLACKLISTED_TITLES } from './utils.js';

export const setLastfmUsername = async (message) => {
  const userId = message.author.id;

  // Check if the user already exists in the file
  const existingUserIndex = users.findIndex((user) => user.discordId === userId);
  if (existingUserIndex !== -1) {
    return message.reply("You've already set your last.fm username up, idiot.");
  }

  const lastfmSession = await initiateLogin(message);

  if (existingUserIndex !== -1) {
    // Update existing user
    users[existingUserIndex].lastfm.username = lastfmSession.name;
    users[existingUserIndex].lastfm.sk = lastfmSession.key;
  } else {
    // Add user to the list
    users.push({
      discordId: userId,
      lastfm: {
        username: lastfmSession.name,
        sk: lastfmSession.key,
      },
    });
  }

  // Write updated user back to the file
  fs.writeFileSync('src/lastfm/users.json', JSON.stringify(users, null, 2));
  message.channel.send(`You have successfully authorized the bot! Your last.fm username is ${lastfmSession.name}.`);
};

export const fixOpheliaScrobblesForTimePeriod = async (message, timePeriod) => {
  const userId = message.author.id;

  // get user from users storage file
  const user = users.find((user) => user.discordId === userId);

  if (!user) {
    return message.reply('You need to set your last.fm username first using the `setlastfm` command.');
  }

  let recentsUrl = `${LASTFM_API_URL}?method=user.getrecenttracks&user=${user.lastfm.username}&api_key=${LASTFM_API_KEY}&format=json&limit=200`;

  // if no time period is provided, use the current day
  const date = timePeriod ? new Date(timePeriod) : new Date();

  if (isNaN(date)) {
    return message.reply('Invalid date format. Please provide a valid date.');
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

  // last.fm doesn't allow scrobbling before 14 days ago (or equal to make it easier)
  if (Date.now() - date.getTime() >= 14 * 24 * 60 * 60 * 1000) {
    return message.reply('You cannot fix scrobbles from 2 weeks ago or earlier.');
  }

  // use the UNIX timestamps for the start and end of the day 
  const startOfDay = date.setHours(0, 0, 0, 0) / 1000;
  const endOfDay = date.setHours(23, 59, 59, 0) / 1000;
  recentsUrl += `&from=${startOfDay}&to=${endOfDay}`;

  try {
    const response = await fetch(recentsUrl);
    const data = await response.json();
    if (data.error) {
      return message.reply(`Error: ${data.message}`);
    }

    console.log(data.recenttracks)
    const tracks = [data.recenttracks.track].flat(1).filter((track) => !!track.date);
    if (!tracks || tracks.length === 0) {
      return message.reply('No scrobbles found for the specified date.');
    }

    for (const track of tracks) {
      console.log(`Checking track: ${track.artist['#text']} - ${track.name}`);

      const featureRegex = new RegExp(`\\b(${BLACKLISTED_TITLES.join('|')})\\b`, 'i');
      if (featureRegex.test(track.name)) {
        console.log(`Skipping blacklisted track: ${track.name}\n`);
        continue;
      }

      if (!WHITELISTED_ARTISTS.some((name) => track.artist['#text'].toLowerCase() === name)) {
        console.log(`Skipping non-whitelisted artist: ${track.artist['#text']}\n`);
        continue;
      }

      const searchTracksUrl = `${LASTFM_API_URL}?method=track.search&artist=${encodeURIComponent(track.artist['#text'])}&track=${encodeURIComponent(track.name)}&api_key=${LASTFM_API_KEY}&format=json`;

      // Wait for the timeout and the API call to complete before continuing
      await new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const response = await fetch(searchTracksUrl);
            const searchData = await response.json();

            if (searchData.error) {
              console.error(`Error searching for track: ${searchData.message}\n`);
              resolve(); // Resolve anyway to continue with next track
              return;
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
              console.log(`No results found for ${track.artist['#text']} - ${track.name}\n`);
              resolve();
              return;
            }

            const sameTrack = relevantResults.find((result) => {
              return (
                result.name.toLowerCase() === track.name.toLowerCase() &&
                result.artist.toLowerCase() === track.artist['#text'].toLowerCase()
              );
            });
            const secondMatch = relevantResults.find((result) => {
              return (
                result.name.toLowerCase() !== track.name.toLowerCase() &&
                result.artist.toLowerCase() === track.artist['#text'].toLowerCase()
              );
            });

            if (
              !secondMatch ||
              // create a ratio between the listeners of the two tracks
              // if the ratio is lower than 0.5, we can rule out the second match
              (Number(secondMatch.listeners) / Number(sameTrack.listeners) < 0.5)
            ) {
              console.log(`Track already matches: ${sameTrack.artist} - ${sameTrack.name}\n`);
              resolve();
              return;
            }

            const options = {
              method: 'track.scrobble',
              api_key: LASTFM_API_KEY,
              sk: user.lastfm.sk,
              artist: secondMatch.artist,
              track: secondMatch.name,
              timestamp: track.date.uts,
              album: track.album['#text'],
            };

            const md5 = generateMd5HashSig(options);
            const scrobbleUrl = `${LASTFM_API_URL}?format=json`;

            const formData = new URLSearchParams();
            Object.entries(options).forEach(([key, value]) => formData.append(key, value));
            formData.append('api_sig', md5);

            const sbResponse = await fetch(scrobbleUrl, {
              method: 'POST',
              headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: formData,
            });
            const scrobbled = await sbResponse.json();

            if (scrobbled.error) {
              console.error(`Error scrobbling track: ${scrobbled.message}`);
            } else {
              console.log(`Successfully scrobbled ${secondMatch.artist} - ${secondMatch.name}`);
              await unscrobble(user, track);
              console.log(`Successfully unscrobbled ${track.artist['#text']} - ${track.name}\n`);
            }

            resolve();
          } catch (error) {
            console.error('Error processing track:', error, '\n');
            resolve(); // Resolve anyway to continue with next track
          }
        }, 5000);
      });
    }

    message.reply('All scrobbles have been fixed for the specified date.');
  } catch (error) {
    console.error('Error fetching scrobbles:', error);
    message.reply('An error occurred while fetching your scrobbles.');
  }
};
