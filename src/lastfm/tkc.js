import { generateMd5HashSig } from './auth.js';
import { unscrobble } from './unscrobble.js';
import { LASTFM_API_URL } from './utils.js';

const LIMIT = 200;

/**
 * @param { import('./users.json')[number] } user
 */
export const handleTkcScrobbleFix = async (user) => {
  let start = 0;
  let total = 0;
  let startFromDay = new Date(1758844799000); // september 26 2025

  const recentsUrl = `${LASTFM_API_URL}?method=user.getrecenttracks&user=${user.lastfm.username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=${LIMIT}`;
  const totalResponse = await fetch(recentsUrl + `&to=${startFromDay.getTime() / 1000}`);
  const totalData = await totalResponse.json();
  total = parseInt(totalData.recenttracks['@attr'].total);

  while (start < total) {
    const from = Math.floor(startFromDay.getTime() / 1000);
    const to = from - 86400; // 1 day in seconds
    startFromDay = new Date(to * 1000);

    try {
      const dayUrl = `${recentsUrl}&from=${to}&to=${from}`;
      const dayResponse = await fetch(dayUrl);
      const dayData = await dayResponse.json();

      let dayStart = 0;
      const dayTotal = parseInt(dayData.recenttracks?.['@attr']?.total ?? 0);

      if (dayTotal === 0) continue;

      while (dayStart < dayTotal) {
        dayStart += LIMIT;
        const searchTrackUrl = `${LASTFM_API_URL}?method=track.search&api_key=${process.env.LASTFM_API_KEY}&format=json`;

        for (const track of dayData.recenttracks.track) {
          const [artist, ...otherArtists] = track.artist['#text'].split(', ');
          if (otherArtists.length === 0) continue;

          // Wait for the timeout and the API call to complete before continuing
          await new Promise((resolve) => {
            setTimeout(async () => {
              let foundTrack = track;
              let mainArtist = artist;

              try {
                const searchedTracks = await Promise.all([
                  getLastfmApiDataAndIgnoreError8(
                    `${searchTrackUrl}&artist=${encodeURIComponent(mainArtist)}&track=${encodeURIComponent(track.name)}`
                  ),
                  ...otherArtists.map((otherArtist) => getLastfmApiDataAndIgnoreError8(
                    `${searchTrackUrl}&artist=${encodeURIComponent(otherArtist)}&track=${encodeURIComponent(track.name)}`
                  )),
                ]);

                const tracks = searchedTracks.flatMap((st) => st.results.trackmatches.track);
                foundTrack = tracks.find((t) => t.artist.toLowerCase() === mainArtist.toLowerCase() && t.name.toLowerCase() === track.name.toLowerCase())
                  ?? tracks.find((t) => {
                    const originalName = track.name.toLowerCase();
                    const searchedName = t.name.toLowerCase();
                    const dashVariant = originalName.replace(/\s*(( )\()([^)]*)(\))/, ' - $3').replace(/\s+/g, ' ').trim();
                    return t.artist.toLowerCase() === mainArtist.toLowerCase() && (searchedName === dashVariant || searchedName === dashVariant.replace(' -', ' - '));
                  })
                  ?? tracks.sort((a, b) => parseInt(b.listeners) - parseInt(a.listeners))[0] // pick most popular if no exact match
                  ?? foundTrack; // if no results from search, keep original

                const scrobbleOptions = {
                  method: 'track.scrobble',
                  api_key: process.env.LASTFM_API_KEY,
                  sk: user.lastfm.sessionKey,
                  artist: foundTrack.artist,
                  track: foundTrack.name,
                  // December 31 2025, 23:59:59 GMT
                  timestamp: '1767225599',
                  album: track.album['#text'],
                };
                const md5 = generateMd5HashSig(scrobbleOptions);
                const scrobbleUrl = `${LASTFM_API_URL}?format=json`;

                const formData = new URLSearchParams();
                Object.entries(scrobbleOptions).forEach(([key, value]) => formData.append(key, value));
                formData.append('api_sig', md5);

                console.log(`\nProcessing track: ${track.artist['#text']} | ${track.name}`);
                console.log(`Would scrobble: ${foundTrack.artist} | ${foundTrack.name} | ${track.album['#text']}`);

                // const scrobbleResponse = await fetch(scrobbleUrl, {
                //   method: 'POST',
                //   headers: {
                //     'Content-Type': 'application/x-www-form-urlencoded',
                //   },
                //   body: formData,
                // });
                // const scrobbled = await scrobbleResponse.json();

                // if (scrobbled.error) {
                //   console.error(`Error scrobbling track: ${scrobbled.message}`);
                // } else {
                //   console.log(`Successfully scrobbled ${foundTrack.artist} - ${foundTrack.name}`);
                //   await unscrobble(user, track);
                //   console.log(`Successfully unscrobbled ${foundTrack.artist} - ${foundTrack.name}`);
                // }

                resolve();
              } catch (error) {
                console.error('Error processing track:', error);
                resolve(); // Resolve anyway to continue with next track
              }
            }, 5000);
          });
        }
      }
    } catch (error) {
      console.error('Error fetching recent tracks from Last.fm:', error);
      return;
    } finally {
      start += LIMIT;
    }
  }
};


const getLastfmApiDataAndIgnoreError8 = async (url) => {
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error && data.message.includes('Most likely the backend service failed')) {
      // wait 500ms and try again
      await new Promise(resolve => setTimeout(resolve, 500));
      const retryResponse = await fetch(url);
      const retryData = await retryResponse.json();
      return retryData;
    }

    return data;
  } catch (error) {
    console.error('Error making Last.fm API call:', error);
    return null;
  }
};
