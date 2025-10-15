import crypto from 'crypto';

import { LASTFM_API_URL } from './utils.js';

// a key/value pair object or a full URL string
export const generateMd5HashSig = (paramsOrUrl) => {
  let sigParams;

  if (typeof paramsOrUrl === 'string') {
    sigParams = Object.fromEntries(new URLSearchParams(paramsOrUrl.split('?')[1]));
  } else if (typeof paramsOrUrl === 'object') {
    sigParams = { ...paramsOrUrl };
  }

  const hash = crypto.createHash('md5');
  const sortedParams = Object.keys(sigParams)
    .sort()
    .map((key) => {
      if (Array.isArray(sigParams[key])) {
        return sigParams[key]
          .map((value) => `${key}${value}`)
          .join('');
      }
      return `${key}${sigParams[key]}`;
    })
    .concat(process.env.LASTFM_API_SECRET)
    .join('');
  hash.update(sortedParams);
  return hash.digest('hex');
};

const createToken = async () => {
  const url = `${LASTFM_API_URL}?api_key=${process.env.LASTFM_API_KEY}&method=auth.getToken`;
  const token = await fetch(`${url}&api_sig=${generateMd5HashSig(url)}&format=json`)
    .then((response) => response.json())
    .then((data) => data.token)
    .catch((error) => {
      console.error('Error fetching token:', error);
      throw 'An error occurred while fetching the token. Please try again later.';
    });

  return token;
};

export const initiateLogin = async (message) => {
  let token;

  try {
    token = await createToken();
    if (!token) throw 'Failed to create a login token.';
  } catch (error) {
    return await message.reply(error);
  }

  const authRequestUrl = `http://www.last.fm/api/auth/?api_key=${process.env.LASTFM_API_KEY}&token=${token}`;
  await message.author.send(`Please authorize the bot within 5 minutes by clicking [this link](${authRequestUrl}).`);
  await message.reply(`Check your DMs for the link to authorize the bot.`);

  // check every 5 seconds if the user has authorized the bot
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes = 60 attempts at 5 second intervals

  return new Promise((resolve) => {
    const checkAuthInterval = setInterval(async () => {
      attempts += 1;
      const authUrl = `${LASTFM_API_URL}?api_key=${process.env.LASTFM_API_KEY}&method=auth.getSession&token=${token}`;

      const data = await fetch(`${authUrl}&api_sig=${generateMd5HashSig(authUrl)}&format=json`)
        .then((response) => response.json())
        .catch((error) => {
          console.error('Error fetching token:', error);
          throw 'An error occurred while fetching the token. Please try again later.';
        });

      if (data.session) {
        clearInterval(checkAuthInterval);
        resolve(data.session);
      } else if (data.error) {
        // don't send a message if the error is 14 (not authorized yet)
        if (data.error !== 14) {
          return await message.reply(`Error: ${data.message}`);
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkAuthInterval);
        await message.reply('Authorization timed out. Please send the command again to re-initiate the process.');
        resolve(null);
      }
    }, 5000);
  });
};
