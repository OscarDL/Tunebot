import fs from 'fs';

import { generateMd5HashSig } from './auth.js';
import { LASTFM_API_URL } from './utils.js';
import tkcScrobbles from './tkc.json' with { type: 'json' };
import tkcLogs from './tkc_log.json' with { type: 'json' };

/**
 * @param { string } lastfmSessionKey
 * @param { Array<{ title: string; artist: string; album?: string; timestamp: string }> } tracks
 * @param { number } batchSize = 1
 * @returns { Promise<void> }
 */
export const scrobble = async (lastfmSessionKey, tracks, batchSize = 1) => {
  console.log('SCROBBLING STARTED!');

  try {
    for (let batchIndex = 0; batchIndex < tracks.length; batchIndex += batchSize) {
      const batch = tracks.slice(batchIndex, batchIndex + batchSize);

      const scrobbleOptions = {
        method: 'track.scrobble',
        api_key: process.env.LASTFM_API_KEY,
        sk: lastfmSessionKey,
      };

      batch.forEach((track, index) => {
        scrobbleOptions[`artist[${index}]`] = track.artist['#text'];
        scrobbleOptions[`track[${index}]`] = track.name;
        scrobbleOptions[`timestamp[${index}]`] = 1767225000 + Math.floor(batchIndex / 5) + batchSize;
        if (track.album) {
          scrobbleOptions[`album[${index}]`] = track.album['#text'];
        }
      });

      // Sort keys according to ASCII table for MD5 signature (required by lastfm API)
      const sortedKeys = Object.keys(scrobbleOptions).sort();
      const sortedOptions = {};
      sortedKeys.forEach((key) => {
        sortedOptions[key] = scrobbleOptions[key];
      });

      const md5 = generateMd5HashSig(sortedOptions);
      const scrobbleUrl = `${LASTFM_API_URL}?format=json`;

      const formData = new URLSearchParams();
      Object.entries(sortedOptions).forEach(([key, value]) => formData.append(key, value));
      formData.append('api_sig', md5);

      console.log(sortedOptions)
      const scrobbled = await getLastfmApiDataAndRetryOnError8(scrobbleUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (scrobbled.error) {
        throw new Error(`Error scrobbling track: ${scrobbled.message}`);
      }

      if (scrobbled.scrobbles['@attr'].ignored > 0) {
        for (let j = 0; j < batch.length; j++) {
          if (parseInt(scrobbled.scrobbles.scrobble[j].ignoredMessage?.code ?? '0') > 0) {
            tkcScrobbles[batchIndex + j].scrobbled = 'error: code ' + scrobbled.scrobbles.scrobble[j].ignoredMessage.code;
          }
        }
        console.log(`Some tracks in batch failed to scrobble. Processed ${batchIndex + batchSize} of ${tracks.length} tracks.`);
      } else {
        for (let j = 0; j < batch.length; j++) {
          tkcScrobbles[batchIndex + j].scrobbled = 'scrobble successful';
        }
        console.log(`Successfully scrobbled ${batchIndex + batchSize} of ${tracks.length} tracks.`);
      }
      tkcLogs.push(scrobbled);
      fs.writeFileSync('src/lastfm/tkc_log.json', JSON.stringify(tkcLogs, null, 2));
      fs.writeFileSync('src/lastfm/tkc.json', JSON.stringify(tkcScrobbles, null, 2));

      // Wait 10 seconds before next batch (except after the last batch)
      if (batchIndex + batchSize < tracks.length) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  } catch (error) {
    console.error('Error scrobbling tracks on Last.fm:', error);
    return;
  }
};

const getLastfmApiDataAndRetryOnError8 = async (url, options) => {
  try {
    const response = await fetch(url, options);
    let data = await response.json();

    while (data.error && data.message.includes('Most likely the backend service failed')) {
      console.warn('Last.fm API backend service error detected. Retrying in 2 seconds...');
      await sleep(2000);
      const retryResponse = await fetch(url, options);
      data = await retryResponse.json();
    }

    return data;
  } catch (error) {
    console.error('Error making Last.fm API call:', error);
    return null;
  }
};
