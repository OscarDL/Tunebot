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

const trackParams = {
  limit: 1,
  market: 'US',
  type: 'track',
};

/**
 * @param { string | null } q - search query
 * @returns { Promise<Object | null> }
 */
export const searchSpotifyTrack = async (q) => {
  if (!q) {
    throw new Error('No song provided for Spotify track search.');
  }

  try {
    const { accessToken } = await getSpotifyAccessToken();
    const query = q.toLowerCase().trim();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
    };

    if (query.includes(' | ')) {
      const [tOrA, aOrT] = query.split(' | ').map((s) => s.trim().toLowerCase());
      const params1 = new URLSearchParams({
        ...trackParams,
        limit: 5, // increase limit to improve chances of finding the correct track
        q: `track:"${aOrT}" artist:"${tOrA}"`,
      });
      const params2 = new URLSearchParams({
        ...trackParams,
        limit: 5, // increase limit to improve chances of finding the correct track
        q: `track:"${tOrA}" artist:"${aOrT}"`,
      });

      const [resp1, resp2] = await Promise.all([
        fetch(`https://api.spotify.com/v1/search?${params1.toString()}`, {headers}),
        fetch(`https://api.spotify.com/v1/search?${params2.toString()}`, {headers}),
      ]);
      const [data1, data2] = await Promise.all([resp1.json(), resp2.json()]);
      const tracks = [...data1.tracks.items, ...data2.tracks.items];

      const track = tracks.find((item) => {
        const title = cleanWordsFromTrackName(item.name.toLowerCase());
        const artists = item.artists.map((a) => a.name.toLowerCase());
        return (
          (title === cleanWordsFromTrackName(tOrA) && artists.includes(aOrT)) ||
          (title === cleanWordsFromTrackName(aOrT) && artists.includes(tOrA))
        );
      });

      if (!track) {
        throw new Error('No matching track found on Spotify.');
      }
      return spotifyResponseToTrack(track);
    }

    const params = new URLSearchParams({ q: query, ...trackParams });
    const resp = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {headers});

    if (!resp.ok) throw new Error('Failed to search track on Spotify.');
    const data = await resp.json();
    return spotifyResponseToTrack(data.tracks.items[0]) ?? null;
  } catch (error) {
    throw new Error(error.message || 'An unknown error occurred.');
  }
}

/**
 * @param { string } trackId - Spotify track ID
 * @returns { Promise<Object> }
 */
export const getSpotifyTrack = async (trackId) => {
  try {
    const { accessToken } = await getSpotifyAccessToken();
    const resp = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!resp.ok) throw new Error('Failed to get track from Spotify.');
    const song = await resp.json();
    return spotifyResponseToTrack(song);
  } catch (error) {
    throw new Error(error.message || 'An unknown error occurred.');
  }
};
