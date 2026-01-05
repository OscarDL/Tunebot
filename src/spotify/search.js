import { getSpotifyAccessToken } from './auth.js';
import { cleanWordsFromTrackName } from './utils.js';

/**
 * @param { Record<string, any> } track
 * @returns { {
 *   trackId: string;
 *   title: string;
 *   artists: Array<string>;
 *   album: string;
 *   cover: string | null;
 * } }
 */
const spotifyResponseToTrack = (track) => ({
  ...track,
  trackId: track.id,
  title: track.name,
  artists: track.artists.map((a) => a.name),
  album: track.album.name,
  cover: track.album.images[0]?.url ?? null,
});

const trackParams = {
  limit: 5, // increase chances of finding the correct track
  locale: 'en-US',
  market: 'US',
  type: 'track',
};

/**
 * @param { string } q
 * @returns { Promise<Record<string, any>> }
 */
export const searchSpotifyTracks = async (q) => {
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
        q: `track:"${aOrT}" artist:"${tOrA}"`,
      });
      const params2 = new URLSearchParams({
        ...trackParams,
        q: `track:"${tOrA}" artist:"${aOrT}"`,
      });

      const [resp1, resp2] = await Promise.all([
        fetch(`https://api.spotify.com/v1/search?${params1.toString()}`, {headers}),
        fetch(`https://api.spotify.com/v1/search?${params2.toString()}`, {headers}),
      ]);
      const [data1, data2] = await Promise.all([resp1.json(), resp2.json()]);
      return [...data1.tracks.items, ...data2.tracks.items];
    }

    const params = new URLSearchParams({ q: query, ...trackParams });
    const resp = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {headers});

    if (!resp.ok) throw new Error('Failed to search track on Spotify.');
    const data = await resp.json();
    return data.tracks.items;
  } catch (error) {
    throw new Error(error.message || 'An unknown error occurred.');
  }
}

/**
 * @param { string | null } q
 * @returns { Promise<ReturnType<typeof spotifyResponseToTrack> | null> }
 */
export const searchSpotifyTrack = async (q) => {
  if (!q) {
    throw new Error('No song provided for Spotify track search.');
  }

  try {
    const tracks = await searchSpotifyTracks(q);
    const query = q.toLowerCase().trim();

    if (query.includes(' | ')) {
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

    return spotifyResponseToTrack(tracks[0]) ?? null;
  } catch (error) {
    throw new Error(error.message || 'An unknown error occurred.');
  }
}

/**
 * @param { string } trackId
 * @returns { Promise<ReturnType<typeof spotifyResponseToTrack>> }
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

/**
 * @param { Array<string> } trackIds
 * @returns { Promise<Array<{
 *   id: string;
 *   href: string;
 *   acousticness: number;
 *   danceability: number;
 *   energy: number;
 *   key: number;
 *   liveness: number;
 *   loudness: number;
 *   mode: number;
 *   speechiness: number;
 *   tempo: number;
 *   valence: number;
 * } | null>> }
 */
export const getSpotifyTrackAudioFeatures = async (trackIds) => {
  try {
    const resp = await fetch(`https://api.reccobeats.com/v1/audio-features?ids=${trackIds.join(',')}`);

    if (!resp.ok) throw new Error('Failed to get audio features from Spotify.');
    const data = await resp.json();

    return trackIds.map((id) => data.content.find((feature) => feature.href.endsWith(id)) ?? null);
  } catch (error) {
    throw new Error(error.message || 'An unknown error occurred.');
  }
};
