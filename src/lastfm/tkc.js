import fs from 'fs';

import { scrobble } from './scrobble.js';
import { unscrobble } from './unscrobble.js';
import { LASTFM_API_URL } from './utils.js';
import users from './users.json' with { type: 'json' };
import tkcScrobbles from './tkc.json' with { type: 'json' };
import tkcScrobblesOrdered from './tkc_ordered.json' with { type: 'json' };

const LIMIT = 200;

(async () => {
  // let incrementForDuplicate = 0;

  // for (let i = 0; i < tkcScrobbles.length; i++) {
  //   let batchSongs = i > 5000
  //     ? i > 26000
  //       ? 5
  //       : 7
  //     : 5;
  //   const baseCounter = Math.floor(i / batchSongs);

  //   // Check for duplicates in current batch
  //   const batchStart = baseCounter * batchSongs;
  //   let duplicates = 0;
  //   for (let j = batchStart; j < i; j++) {
  //     if (tkcScrobbles[i].name === tkcScrobbles[j].name &&
  //         tkcScrobbles[i].artist['#text'] === tkcScrobbles[j].artist['#text']) {
  //       duplicates += 1;
  //     }
  //   }

  //   // Increment by 1 every 5 songs OR if there's a duplicate
  //   if (i > 0 && i % batchSongs === 0) {
  //     incrementForDuplicate++;
  //   }
  //   else if (duplicates > 0) {
  //     incrementForDuplicate += duplicates;
  //   }

  //   tkcScrobbles[i].timestamp = String(1767164400 + incrementForDuplicate);
  // }
  // fs.writeFileSync('src/lastfm/tkc.json', JSON.stringify(tkcScrobbles, null, 2));

  const newTkcScrobbles = tkcScrobblesOrdered.filter(t => !t.scrobbled);
  // Log songs by frequency (most to least)
  const artistFrequency = {};
  const songFrequency = {};
  for (const scrobble of newTkcScrobbles) {
    if (scrobble.name && scrobble.artist?.['#text']) {
      const artist = scrobble.artist['#text'].toLowerCase();
      const key = `${artist} | ${scrobble.name}`;
      artistFrequency[artist] = (artistFrequency[artist] || 0) + 1;
      songFrequency[key] = (songFrequency[key] || 0) + 1;
    }
  }

  const sortedArtists = Object.entries(artistFrequency).sort((a, b) => b[1] - a[1]);

  console.log('Artists by frequency:');
  sortedArtists.map(([artist, count]) => `${count}x ${artist}`).forEach(artist => console.log(artist));

  const indexesToScrobble = [];

  // get the number of scrobbles per song for every song from an artist that has more than 250 scrobbles
  newTkcScrobbles.forEach((t, index) => {
    const key = `${t.artist['#text'].toLowerCase()} | ${t.name}`;
    if (
      sortedArtists.find(([artist, count]) => artist === t.artist['#text'].toLowerCase() && count < 199 && count >= 88) && songFrequency[key] > 25 ||
      sortedArtists.find(([artist, count]) => artist === t.artist['#text'].toLowerCase() && count >= 199) && songFrequency[key] < 27 && songFrequency[key] > 20 ||
      t.album['#text'] === 'Fluorescence'
    ) {
      indexesToScrobble.push(index);
      return true;
    }
    return false;
  })

  const toScrobble = indexesToScrobble.map(i => newTkcScrobbles[i]);
  // for each different song, only keep 90% of occurrences
  const songOccurrences = {};
  const filteredScrobbles = [];
  for (const scrobble of toScrobble) {
    const key = `${scrobble.artist['#text']} - ${scrobble.name}`;
    songOccurrences[key] = (songOccurrences[key] ?? 0) + 1;
    const totalOccurrences = toScrobble.filter(t => `${t.artist['#text']} - ${t.name}` === key).length;

    if (songOccurrences[key] <= Math.floor(totalOccurrences * 0.86)) {
      filteredScrobbles.push(scrobble);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const user = users.find(u => u.lastfm.username === 'thekandycinema');
  await scrobble(user.lastfm.sessionKey, filteredScrobbles, 50);

  // // Populate tkcScrobblesOrdered with all scrobbles ordered by song frequency
  // const sortedSongKeys = sortedSongs.map(([song]) => song);
  // const orderedScrobbles = [];

  // for (const key of sortedSongKeys) {
  //   for (const scrobble of tkcScrobbles) {
  //     if (scrobble.name && scrobble.artist?.['#text']) {
  //       const songKey = `${scrobble.artist['#text']} - ${scrobble.name}`;
  //       if (songKey === key) {
  //         orderedScrobbles.push(scrobble);
  //       }
  //     }
  //   }
  // }

  // fs.writeFileSync('src/lastfm/tkc_ordered.json', JSON.stringify(orderedScrobbles, null, 2));
})();
// (async () => {
//   await new Promise((resolve) => setTimeout(resolve, 3000));
//   const user = users.find(u => u.lastfm.username === 'thekandycinema');
//   for (let i = 0; i < 1008; i++) {
//     await unscrobble(user, tkcScrobbles[i]);
//     await sleep(2000);
//   }
// })();
// (async () => {
//   await new Promise((resolve) => setTimeout(resolve, 3000));
//   const user = users.find(u => u.lastfm.username === 'thekandycinema');
//   const scrobbles = tkcScrobblesOrdered.filter(t => !t.scrobbled);
//   // for each different song, only keep 90% of occurrences
//   const songOccurrences = {};
//   const filteredScrobbles = [];
//   for (const scrobble of scrobbles) {
//     const key = `${scrobble.artist['#text']} - ${scrobble.name}`;
//     songOccurrences[key] = (songOccurrences[key] ?? 0) + 1;
//     const totalOccurrences = scrobbles.filter(t => `${t.artist['#text']} - ${t.name}` === key).length;

//     if (songOccurrences[key] <= Math.floor(totalOccurrences * 0.8)) {
//       filteredScrobbles.push(scrobble);
//     }
//   }
//   scrobble(user.lastfm.sessionKey, filteredScrobbles, 6);
// })();

/**
 * @param { import('./users.json')[number] } user
 */
export const handleTkcScrobbleFix = async (user) => {
  let start = 0;
  let total = 0;
  let scrobbleTimestamp = 1767164400; // December 31 2025, 7:00 AM GMT
  let startFromLastfmTimestamp = 1596844800; // August 8 2020, 0:00 AM GMT

  console.log('DAY STARTED!');

  const recentsUrl = `${LASTFM_API_URL}?method=user.getrecenttracks&user=${user.lastfm.username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=${LIMIT}`;
  const totalResponse = await fetch(recentsUrl + `&from=${startFromLastfmTimestamp}&to=${1758931200}`);
  const totalData = await totalResponse.json();
  total = parseInt(totalData?.recenttracks?.['@attr']?.total ?? 0);

  console.log(111);

  while (start < total) {
    console.log(222);
    try {
      const to = startFromLastfmTimestamp + 86400; // 1 day in seconds
      const dayUrl = `${recentsUrl}&from=${startFromLastfmTimestamp}&to=${to}`;
      const dayData = await getLastfmApiDataAndRetryOnError8(dayUrl);
      console.log(333);
      await sleep();

      let dayStart = 0;
      const dayTracks = [];
      const dayTotal = parseInt(dayData.recenttracks?.['@attr']?.total ?? 0);

      if (dayTotal > 0) {
        console.log(444);

        while (dayStart < dayTotal) {
          console.log(555);
          // start from last page to first page using LIMIT
          let page = Math.ceil((dayTotal - dayStart) / LIMIT);
          const pagedDayUrl = dayUrl + `&page=${page}`;
          const pagedDayData = await getLastfmApiDataAndRetryOnError8(pagedDayUrl);
          console.log(666);

          const tracks = [pagedDayData.recenttracks.track].flat().reverse();

          for (const track of tracks) {
            console.log(777);
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

          console.log(888);

          page += 1;
          dayStart += LIMIT;
        }

        console.log(999);

        tkcScrobbles.unshift(...dayTracks);
        fs.writeFileSync('src/lastfm/tkc.json', JSON.stringify(tkcScrobbles, null, 2));
      }

      console.log('DAY DONE!', new Date(startFromLastfmTimestamp * 1000));
      // await scrobble(user.lastfm.sessionKey, dayTracks);
      // await Promise.all(
      //   dayData.recenttracks.track.map((t) => unscrobble(user, t)),
      // );

      startFromLastfmTimestamp = to;
      start += dayTotal;
      console.log(start, total);
      await sleep(5000);
    } catch (error) {
      console.error(`TKC ERROR FOR RECENTS FROM ${new Date(startFromLastfmTimestamp * 1000)} TO ${new Date((startFromLastfmTimestamp + 86400) * 1000)}:`);
      console.error('Error fetching recent tracks from Last.fm:', error);
      return;
    }
  }
};


const getLastfmApiDataAndRetryOnError8 = async (url) => {
  try {
    const response = await fetch(url);
    let data = await response.json();

    while (data.error && data.message.includes('Most likely the backend service failed')) {
      console.warn('Last.fm API backend service error detected. Retrying in 2 seconds...');
      tkcScrobbles.push({ errorRetry: true, timestamp: Date.now() });
      fs.writeFileSync('src/lastfm/tkc.json', JSON.stringify(tkcScrobbles, null, 2));
      await sleep(2000);
      const retryResponse = await fetch(url);
      data = await retryResponse.json();
    }

    return data;
  } catch (error) {
    console.error('Error making Last.fm API call:', error);
    return null;
  }
};

const sleep = async (ms = 1000) => await new Promise((resolve) => setTimeout(resolve, ms));
