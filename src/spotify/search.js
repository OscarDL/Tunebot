import { getSpotifyAccessToken } from './auth.js';
import { cleanWordsFromTrackName, scoreTracksOnMatch } from './utils.js';

export const searchSpotifyTrack = async (q) => {
  const { accessToken } = await getSpotifyAccessToken();
  const query = q.toLowerCase().trim();
  const params = new URLSearchParams({
    q: query,
    limit: '10',
    type: 'track',
  });

  const resp = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!resp.ok) throw new Error('Failed to search track on Spotify.');
  const data = await resp.json();

  if (!query.includes(' | ')) {
    // Score each track based on how well it matches the query
    const scoredTracks = scoreTracksOnMatch(data.tracks.items, query);
    return scoredTracks.length > 0 ? scoredTracks[0].item : null;
  }

  const [titleOrArtist, artistOrTitle] = query.split(' | ').map((s) => s.trim().toLowerCase());
  return scoredTracks.find((item) => {
    const title = cleanWordsFromTrackName(item.name.toLowerCase());
    const artists = item.artists.map((a) => a.name.toLowerCase());
    return (title === titleOrArtist && artists.includes(artistOrTitle)) ||
      (title === artistOrTitle && artists.includes(titleOrArtist));
  });
}

export const getSpotifyTrack = async (trackId) => {
  const { accessToken } = await getSpotifyAccessToken();
  const resp = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!resp.ok) throw new Error('Failed to get track from Spotify.');
  return await resp.json();
};
