import { generateMd5HashSig } from './auth.js';
import { LASTFM_API_URL } from './utils.js';

/**
 * @param { string } lastfmSessionKey
 * @param { Array<{ title: string; artist: string; album?: string; }> } tracks
 * @returns { Promise<void> }
 */
export const scrobble = async (lastfmSessionKey, tracks) => {
  const batchSize = 50;

  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);

    const scrobbleOptions = {
      method: 'track.scrobble',
      api_key: process.env.LASTFM_API_KEY,
      sk: lastfmSessionKey,
    };

    batch.forEach((track, index) => {
      scrobbleOptions[`artist[${index}]`] = track.artist['#text'] ?? track.artist;
      scrobbleOptions[`track[${index}]`] = track.name ?? track.title;
      scrobbleOptions[`timestamp[${index}]`] = track.date.uts;
      if (track.album) {
        scrobbleOptions[`album[${index}]`] = track.album['#text'] ?? track.album;
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

    batch.forEach((track) => {
      console.log(`\nProcessing track: ${track.artist['#text']} | ${track.name}`);
      console.log(`Would scrobble: ${track.artist['#text']} | ${track.name}${track.album ? ` | ${track.album['#text']}` : ''}`);
    });

    const scrobbleResponse = await fetch(scrobbleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });
    const scrobbled = await scrobbleResponse.json();

    if (scrobbled.error) {
      throw new Error(`Error scrobbling track: ${scrobbled.message}`);
    } else {
      batch.forEach((track) => {
        console.log(`Successfully scrobbled ${track.artist['#text'] ?? track.artist} - ${track.name ?? track.title}`);
      });
    }

    // Wait 5 seconds before next batch (except after the last batch)
    if (i + batchSize < tracks.length) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};
