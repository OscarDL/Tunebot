export const COMMAND_TYPES = {
  /* --- music commands --- */
  'music': [
    's', 'fxs', 'fm', 'fxfm', 'np', 'fxnp',
    'cover',
    'duration',
    'pop',
  ],
  /* --- lastfm commands --- */
  'lastfm': [
    'wk', 'w', 'whoknows',
    'wkt', 'wt', 'whoknowstrack',
    'setlastfm',
    'opheliafix',
  ],
  'utils': [
    /* --- vibin dips count --- */
    'vibindips',
    /* --- temperature conversion --- */
    'temp',
    /* --- create bingo card --- */
    'bingo',
  ],
};

export const COMMANDS = Object.values(COMMAND_TYPES).flat();

export const getCommandTypeFromCommand = (command) => {
  for (const [type, commands] of Object.entries(COMMAND_TYPES)) {
    if (commands.includes(command)) return type;
  }
  return null;
}
