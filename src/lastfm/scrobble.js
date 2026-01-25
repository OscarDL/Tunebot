import { generateMd5HashSig } from './auth.js';
import { LASTFM_API_URL } from './utils.js';

/**
 * @param { string } lastfmSessionKey
 * @param { Array<{ title: string; artist: string; album?: string; timestamp: string }> } tracks
 * @param { number } timestamp = null
 * @param { number } batchSize = 1
 * @returns { Promise<void> }
 */
export const scrobble = async (
  lastfmSessionKey,
  tracks,
  timestamp = null,
  batchSize = 1,
) => {
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
        scrobbleOptions[`timestamp[${index}]`] = timestamp ?? track.timestamp;
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

      console.log(
        scrobbled.scrobbles['@attr'].ignored > 0
          ? `Some tracks in batch failed to scrobble. Processed ${batchIndex + batchSize} of ${tracks.length} tracks.`
          : `Successfully scrobbled ${batchIndex + batchSize} of ${tracks.length} tracks.`
      );

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
