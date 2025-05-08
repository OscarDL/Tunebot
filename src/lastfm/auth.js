import crypto from 'crypto';

import { LASTFM_API_KEY, LASTFM_API_SECRET, LASTFM_API_URL } from './utils.js';

const generateMd5HashSig = (url) => {
  const hash = crypto.createHash('md5');
  const params = url.split('?')[1].split('&').sort().join('') + LASTFM_API_SECRET;
  hash.update(params.replaceAll('=', ''));
  return hash.digest('hex');
};

const createToken = async () => {
  const url = `${LASTFM_API_URL}?api_key=${LASTFM_API_KEY}&format=json&method=auth.getToken`;
  const token = await fetch(`${url}&api_sig=${generateMd5HashSig(url)}`)
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
    if (!token) throw 'Failed to create token.';
  } catch (error) {
    return message.reply(error);
  }

  const authRequestUrl = `http://www.last.fm/api/auth/?api_key=${LASTFM_API_KEY}&token=${token}`;
  message.author.send(`Please authorize the bot by clicking this link: ${authRequestUrl}`);
  message.reply(`Check your DMs for the link to authorize the bot.`);

  // check every 5 seconds if the user has authorized the bot

  let attempts = 0;
  const maxAttempts = 60; // 5 minutes = 60 attempts at 5 second intervals

  return new Promise((resolve) => {
    const checkAuthInterval = setInterval(async () => {
      attempts += 1;
      const authUrl = `${LASTFM_API_URL}?api_key=${LASTFM_API_KEY}&method=auth.getSession&token=${token}`;

      try {
        const data = await fetch(`${authUrl}&format=json&api_sig=${generateMd5HashSig(authUrl)}`)
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
          if (data.error !== 14) message.reply(`Error: ${data.message}`);
        }
      } catch (error) {
        console.error('Error checking authorization:', error);
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkAuthInterval);
        message.reply('Authorization timed out. Please send the command again to re-initiate the process.');
        resolve(null);
      }
    }, 5000);
  });
};

// export const searchTrack = async (trackName) => {
//   const SEARCH_TRACKS = 'track.search';
//   const TRACK_SEARCH_QUERY_STRING = `&track=${trackName}&api_key=${LASTFM_API_KEY}&limit=10&format=json`;
//   const trackSearchReqeustURL = encodeURI(
//     `${LASTFM_API_URL}${SEARCH_TRACKS}${TRACK_SEARCH_QUERY_STRING}`
//   );

//   try {
//     const {
//       data: {
//         results: {
//           trackmatches: { track: tracks }
//         }
//       }
//     } = await axios.get(trackSearchReqeustURL);
//   } catch (error) {
//     console.error('Error fetching track data:', error);
//     return null;
//   }
// };
