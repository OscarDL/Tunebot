import { getSpotifyAccessToken } from './auth.js';

export const searchSpotifyTrack = async (query) => {
  const { accessToken } = await getSpotifyAccessToken();
  const params = new URLSearchParams({
    q: query.replace(/[;|\(\)\[\]<>]/g, ''),
    type: 'track',
    limit: '10',
  });

  const resp = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!resp.ok) throw new Error('Failed to search track on Spotify.');
  const data = await resp.json();

  if (!query.includes(' | ')) {
    return data.tracks.items.find((item) => {
      const title = item.name.toLowerCase();
      const artists = item.artists.map((a) => a.name.toLowerCase());
      // This maximizes the chance of getting the correct track when user input is imprecise (no " | " separator)
      return artists.find((artist) => (
        query.split(' ').map((s) => s.toLowerCase()).some((s) => s === artist.toLowerCase()) &&
        query.split(' ').map((s) => s.toLowerCase()).some((s) => s === title.toLowerCase())
      ));
    }) ?? data.tracks.items[0];
  }

  const [titleOrArtist, artistOrTitle] = query.split(' | ').map((s) => s.trim().toLowerCase());
  return data.tracks.items.find((item) => {
    const title = item.name.toLowerCase();
    const artists = item.artists.map((a) => a.name.toLowerCase());
    return (title === titleOrArtist && artists.includes(artistOrTitle)) ||
      (title === artistOrTitle && artists.includes(titleOrArtist));
  });
}

export const getSpotifyTrack = async (trackId) => {
  const { accessToken } = await getSpotifyAccessToken();
  const resp = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!resp.ok) throw new Error('Failed to get track from Spotify.');
  return await resp.json();
};
