let _cachedToken = null;
let _cachedTokenExpiresAt = 0;

/**
 * @returns { Promise<{ accessToken: string; expiresIn: number }> }
 */
export const getSpotifyAccessToken = async () => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (_cachedToken && Date.now() < _cachedTokenExpiresAt) {
    return { accessToken: _cachedToken, expiresIn: Math.floor((_cachedTokenExpiresAt - Date.now()) / 1000) };
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' })
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error(`Spotify token request failed: ${resp.status} ${body}`);
    throw new Error('Failed to request the Spotify API.');
  }

  const data = await resp.json();
  _cachedToken = data.access_token;
  _cachedTokenExpiresAt = Date.now() + (Number(data.expires_in) - 30) * 1000; // subtract small buffer

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}
