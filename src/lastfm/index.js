import fs from 'fs';

import { initiateLogin } from './auth.js';
import { USERS_FILE } from './utils.js';

export const setLastfmUsername = async (message) => {
  const userId = message.author.id;

  // Check if the user already exists in the file
  const users = fs.readFileSync(USERS_FILE, 'utf8').split('\n').map(line => line.split(' '));
  const existingUserIndex = users.findIndex(([id]) => id === userId);
  if (existingUserIndex !== -1) {
    return message.reply("You've already set your last.fm username up, idiot.");
  }

  const lastfmSession = await initiateLogin(message);

  if (existingUserIndex !== -1) {
    // Update existing user
    users[existingUserIndex][1] = lastfmSession.name;
    users[existingUserIndex][2] = lastfmSession.key;
  } else {
    // Add user to the list
    users.push([userId, lastfmSession.name, lastfmSession.key]);
  }

  // Write updated user back to the file
  fs.writeFileSync(USERS_FILE, users.map(user => user.join(' ')).join('\n'));
  message.channel.send(`You have successfully authorized the bot! Your last.fm username is ${lastfmSession.name}.`);
};

export const fixOpheliaScrobblesForTimePeriod = async (message, timePeriod) => {
  const userId = message.author.id;

  // get user from users.txt file
  const user = fs.readFileSync(USERS_FILE, 'utf8').split('\n')
    .map(line => line.split(' '))
    .find(([id]) => id === userId);

  const [discordId, lastfmUsername] = user ?? [];
  if (!lastfmUsername) {
    message.reply('You need to set your last.fm username first using the `setlastfm` command.');
    return;
  }
};
