/**
 * @param { string } trackName
 * @returns { string }
 */
export const cleanWordsFromTrackName = (trackName) => {
  // Words that need exact/full matches (case-insensitive)
  const fullMatchWords = ['original mix', 'radio mix', 'radio edit'];

  // Words/patterns that are partial matches (can appear within other text)
  const partialMatchWords = ['feat.', 'feat', 'ft.', 'ft', 'with', 'w/'];

  let result = trackName;

  // Remove full match words - these are exact matches in any bracket format
  fullMatchWords.forEach((pattern) => {
    // Match (pattern), [pattern], or - pattern at end
    const regexes = [
      new RegExp(`\\s*\\(\\s*${pattern}\\s*\\)`, 'i'),
      new RegExp(`\\s*\\[\\s*${pattern}\\s*\\]`, 'i'),
      new RegExp(`\\s*-\\s*${pattern}\\s*$`, 'i'),
    ];
    regexes.forEach((regex) => {
      result = result.replace(regex, '');
    });
  });

  // Remove partial match words
  const words = result.toLowerCase().split(' ');
  const index = words.findIndex((word) => partialMatchWords.some((w) => word.includes(w)));

  if (index === -1) return result.trim();

  const word = words[index];

  // Handle different bracket/separator types
  if (word.includes('(')) {
    const closingIndex = words.findIndex((w, i) => i >= index && w.includes(')'));
    if (closingIndex !== -1) {
      return [words.slice(0, index).join(' '), words.slice(closingIndex + 1).join(' ')].join(' ').trim();
    }
  } else if (word.includes('[')) {
    const closingIndex = words.findIndex((w, i) => i >= index && w.includes(']'));
    if (closingIndex !== -1) {
      return [words.slice(0, index).join(' '), words.slice(closingIndex + 1).join(' ')].join(' ').trim();
    }
  } else {
    const dashIndex = words.findIndex((w, i) => i >= index && w === '-');
    if (dashIndex !== -1) {
      return words.slice(0, index).join(' ').trim();
    }
  }

  return result.trim();
};

/**
 * @param { number } durationMs
 * @returns { string }
 */
export const getTrackDuration = (durationMs) => (
  `${Math.floor(durationMs / 60000)}:${String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0')} minutes`
);

/**
 * @param { number } key
 * @param { number } mode
 * @returns { string }
 */
export const getPitchClassNotation = (key, mode) => {
  const minorOrMajor = mode === 1 ? ' major' : ' minor';

  switch (key) {
    case 0: return 'C' + minorOrMajor;
    case 1: return 'D♭' + minorOrMajor;
    case 2: return 'D' + minorOrMajor;
    case 3: return 'E♭' + minorOrMajor;
    case 4: return 'E' + minorOrMajor;
    case 5: return 'F' + minorOrMajor;
    case 6: return 'F♯' + minorOrMajor;
    case 7: return 'G' + minorOrMajor;
    case 8: return 'A♭' + minorOrMajor;
    case 9: return 'A' + minorOrMajor;
    case 10: return 'B♭' + minorOrMajor;
    case 11: return 'B' + minorOrMajor;
    default: return 'Unknown';
  }
};
