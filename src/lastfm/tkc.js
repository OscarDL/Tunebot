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
  let startFromLastfmTimestamp = 1596844800; // August 8 2020, 0:00 AM GMT

  const recentsUrl = `${LASTFM_API_URL}?method=user.getrecenttracks&user=${user.lastfm.username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=${LIMIT}`;
  const totalResponse = await fetch(recentsUrl + `&to=${startFromLastfmTimestamp}`);
  const totalData = await totalResponse.json();
  total = parseInt(totalData?.recenttracks?.['@attr']?.total ?? 0);

  while (start < total) {
    try {
      const to = startFromLastfmTimestamp + 86400; // 1 day in seconds
      const dayUrl = `${recentsUrl}&from=${startFromLastfmTimestamp}&to=${to}`;
      const dayData = await getLastfmApiDataAndRetryError8(dayUrl);
      await sleep();

      let dayStart = 0;
      const dayTracks = [];
      const dayTotal = parseInt(dayData.recenttracks?.['@attr']?.total ?? 0);

      if (dayTotal === 0) continue;

      while (dayStart < dayTotal) {
        // start from last page to first page using LIMIT
        let page = Math.ceil((dayTotal - dayStart) / LIMIT);
        const pagedDayUrl = dayUrl + `&page=${page}`;
        const pagedDayData = await getLastfmApiDataAndRetryError8(pagedDayUrl);
        await sleep();

        const tracks = [pagedDayData.recenttracks.track].flat().reverse();

        for (const track of tracks) {
          const [mainArtist, ...otherArtists] = track.artist['#text'].split(', ');
          if (otherArtists.length === 0) {
            continue;
          };

          const foundTrack = structuredClone(track);
          foundTrack['artist']['#text'] = mainArtist;
          foundTrack.date = { uts: String(scrobbleTimestamp) };
          dayTracks.push(foundTrack);

          scrobbleTimestamp += 1;
        }

        page += 1;
        dayStart += LIMIT;
      }

      await scrobble(user.lastfm.sessionKey, dayTracks);
      await sleep(5000);
      // await Promise.all(
      //   dayData.recenttracks.track.map((t) => unscrobble(user, t)),
      // );

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
      await sleep();
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

const sleep = async (ms = 1000) => await new Promise((resolve) => setTimeout(resolve, ms));
