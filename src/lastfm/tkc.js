import { scrobble } from './scrobble.js';
import { unscrobble } from './unscrobble.js';
import { LASTFM_API_URL } from './utils.js';

const LIMIT = 200;

/**
 * @param { import('./users.json')[number] } user
 */
export const handleTkcScrobbleFix = async (user) => {
  let start = 0;
  let total = 0;
  let scrobbleTimestamp = 1767139200; // December 31 2025, 12:00 AM GMT
  let startFromLastfmTimestamp = 1596852000; // August 8 2020, 2:00 AM GMT

  const recentsUrl = `${LASTFM_API_URL}?method=user.getrecenttracks&user=${user.lastfm.username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=${LIMIT}`;
  const totalResponse = await fetch(recentsUrl + `&to=${startFromLastfmTimestamp}`);
  const totalData = await totalResponse.json();
  total = parseInt(totalData.recenttracks['@attr'].total);

  while (start < total) {
    try {
      const to = startFromLastfmTimestamp + 86400; // 1 day in seconds
      const dayUrl = `${recentsUrl}&from=${startFromLastfmTimestamp}&to=${to}`;
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
          if (otherArtists.length === 0) {
            // await scrobble(
            //   user.lastfm.sessionKey,
            //   '1767225599',
            //   artist,
            //   track.name,
            //   track.album['#text'],
            // );
            // scrobbleTimestamp += 1;
            // await unscrobble(user, track);
            continue;
          };

          // Wait for the timeout and the API call to complete before continuing
          await new Promise((resolve) => {
            setTimeout(async () => {
              try {
                const mainArtist = artist;
                const searchedTracks = await Promise.all([
                  getLastfmApiDataAndRetryError8(
                    `${searchTrackUrl}&artist=${encodeURIComponent(mainArtist)}&track=${encodeURIComponent(track.name)}`
                  ),
                  ...otherArtists.map((otherArtist) => getLastfmApiDataAndRetryError8(
                    `${searchTrackUrl}&artist=${encodeURIComponent(otherArtist)}&track=${encodeURIComponent(track.name)}`
                  )),
                ]);
                const tracks = searchedTracks.flatMap((st) => st.results.trackmatches.track);

                const foundTrack = tracks.find((t) => t.artist.toLowerCase() === mainArtist.toLowerCase() && t.name.toLowerCase() === track.name.toLowerCase())
                  ?? tracks.find((t) => {
                    const originalName = track.name.toLowerCase();
                    const searchedName = t.name.toLowerCase();
                    const dashVariant = originalName.replace(/\s*(( )\()([^)]*)(\))/, ' - $3').replace(/\s+/g, ' ').trim();
                    return t.artist.toLowerCase() === mainArtist.toLowerCase() && (searchedName === dashVariant || searchedName === dashVariant.replace(' -', ' - '));
                  })
                  ?? tracks.sort((a, b) => parseInt(b.listeners) - parseInt(a.listeners))[0] // pick most popular if no exact match
                  ?? track; // if no results from search, keep original

                // December 31 2025, 23:59:59 GMT
                await scrobble(
                  user.lastfm.sessionKey,
                  scrobbleTimestamp,
                  foundTrack.artist,
                  foundTrack.name,
                  track.album['#text'],
                );
                scrobbleTimestamp += 1;
                await unscrobble(user, track);

                resolve();
              } catch (error) {
                console.error('Error processing track:', error);
                resolve(); // Resolve anyway to continue with next track
              }
            }, 5000);
          });
        }
      }

      startFromLastfmTimestamp = to;
      start += dayTotal;
    } catch (error) {
      console.error(`TKC ERROR FOR RECENTS FROM ${new Date(startFromLastfmTimestamp * 1000)} TO ${new Date((startFromLastfmTimestamp + 86400) * 1000)}:`);
      console.error('Error fetching recent tracks from Last.fm:', error);
      return;
    }
  }
};


const getLastfmApiDataAndRetryError8 = async (url) => {
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
