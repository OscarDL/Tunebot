import { getSpotifyAccessToken } from './auth.js';
import { cleanWordsFromTrackName } from './utils.js';

const spotifyResponseToTrack = (track) => ({
  ...track,
  trackId: track.id,
  title: track.name,
  artists: track.artists.map((a) => a.name),
  album: track.album.name,
  cover: track.album.images[0]?.url ?? null,
});

/**
 * @param { string | null } q - search query
 * @returns { Promise<Object | null> }
 */
export const searchSpotifyTrack = async (q) => {
  if (!q) return null;

  try {
    const { accessToken } = await getSpotifyAccessToken();
    const query = q.toLowerCase().trim();

    const params = new URLSearchParams({
      q: query,
      limit: '1',
      type: 'track',
    });
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
    };

    if (query.includes(' | ')) {
      const [tOrA, aOrT] = query.split(' | ').map((s) => s.trim().toLowerCase());
      const queryTA = `track:"${tOrA}" artist:"${aOrT}"`;
      const queryAT = `track:"${aOrT}" artist:"${tOrA}"`;

      const [resp1, resp2] = await Promise.all([
        fetch(`https://api.spotify.com/v1/search?${params.toString().replace(query, queryTA)}`, {headers}),
        fetch(`https://api.spotify.com/v1/search?${params.toString().replace(query, queryAT)}`, {headers}),
      ]);
      const [data1, data2] = await Promise.all([resp1.json(), resp2.json()]);
      const [track1, track2] = [data1.tracks.items[0], data2.tracks.items[0]];

      const track = [track1, track2].find((item) => {
        const title = cleanWordsFromTrackName(item.name.toLowerCase());
        const artists = item.artists.map((a) => a.name.toLowerCase());
        return false ||
          (title === cleanWordsFromTrackName(tOrA) && artists.includes(aOrT)) ||
          (title === cleanWordsFromTrackName(aOrT) && artists.includes(tOrA));
      });
      return track ? spotifyResponseToTrack(track) : null;
    }

    const resp = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {headers});

    if (!resp.ok) throw new Error('Failed to search track on Spotify.');
    const data = await resp.json();
    return spotifyResponseToTrack(data.tracks.items[0]) ?? null;
  } catch (error) {
    console.error(error);
    return await message.reply({
      flags: [MessageFlags.SuppressNotifications],
      content: error.message || 'An unknown error occurred.',
    });
  }
}

/**
 * @param { string } trackId - Spotify track ID
 * @returns { Promise<Object> }
 */
export const getSpotifyTrack = async (trackId) => {
  const { accessToken } = await getSpotifyAccessToken();
  const resp = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!resp.ok) throw new Error('Failed to get track from Spotify.');
  const song = await resp.json();
  return spotifyResponseToTrack(song);
};
