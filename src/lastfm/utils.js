import users from './users.json' with { type: 'json' };

export const LASTFM_API_URL = 'http://ws.audioscrobbler.com/2.0/';

export const BLACKLISTED_TITLES = [
  'feat.', 'ft.', 'feat', 'ft', 'with', 'w/',
];
export const MISMATCH_TRACK_SUFFIXES = [
  'mix', 'mixed', 'remix', 'vip', 'acoustic', 'cover',
];

export const WHITELISTED_ARTISTS = [
  'abandoned',
  'blastoyz',
  'blanke',
  'caster',
  'codeko',
  'crystal skies',
  'far out',
  'fatum',
  'feed me',
  'gem & tauri',
  'haliene',
  'ironheart',
  'jason ross',
  'kepik',
  'kill the noise',
  'last heroes',
  'medz',
  'mitis',
  'outwild',
  'roy knox',
  'seven lions',
  'star seed',
  'trivecta',
  'wooli',
  'xavi',
];

export const isUserSavedAsLastfmUser = (discordId) => {
  return users.some((user) => user.discordId === discordId);
};
