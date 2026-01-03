import { generateMd5HashSig } from './auth.js';
import { LASTFM_API_URL } from './utils.js';

/**
 * @param { string } lastfmSessionKey
 * @param { string } timestamp
 * @param { string } artist
 * @param { string } track
 * @param { string } album
 * @returns { Promise<void> }
 */
export const scrobble = async (
  lastfmSessionKey,
  timestamp,
  artist,
  track,
  album = undefined,
) => {
  const scrobbleOptions = {
    method: 'track.scrobble',
    api_key: process.env.LASTFM_API_KEY,
    sk: lastfmSessionKey,
    timestamp,
    artist,
    album,
    track,
  };
  const md5 = generateMd5HashSig(scrobbleOptions);
  const scrobbleUrl = `${LASTFM_API_URL}?format=json`;

  const formData = new URLSearchParams();
  Object.entries(scrobbleOptions).forEach(([key, value]) => formData.append(key, value));
  formData.append('api_sig', md5);

  console.log(`\nProcessing track: ${track.artist['#text']} | ${track.name}`);
  console.log(`Would scrobble: ${foundTrack.artist} | ${foundTrack.name} | ${track.album['#text']}`);

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
    console.log(`Successfully scrobbled ${foundTrack.artist} - ${foundTrack.name}`);
  }
};
