export const cleanWordsFromTrackName = (trackName) => {
  let wordsToRemove = ['feat.', 'feat', 'ft.', 'ft', 'with', 'w/'];
  wordsToRemove.map((word) => wordsToRemove.push(`(${word}`, `[${word}`));

  const words = trackName.toLowerCase().split(' ');

  // find the index of the word to remove
  const index = words.findIndex((word) => wordsToRemove.includes(word));
  if (index === -1) return words.join(' ');

  // remove the word at index, the character prior and everything up until the opposite corresponding character
  const word = words[index];

  switch (word[0]) {
    case '(':
      // remove what's inside the parentheses
      const closingP = words.findIndex((word) => word.endsWith(')'));
      return [words.slice(0, index).join(' '), words.slice(closingP + 1).join(' ')].join(' ').trim();
    case '[':
      // remove what's inside the brackets
      const closingB = words.findIndex((word) => word.endsWith(']'));
      return [words.slice(0, index).join(' '), words.slice(closingB + 1).join(' ')].join(' ').trim();
    default:
      const closing = words.findIndex((word) => word === '-');
      const suffix = words.slice(closing).join(' '); // If there's a dash for a remix, keep it
      return [words.slice(0, index).join(' '), closing > -1 ? ` ${suffix}` : ''].join(' ').trim();
  }
};
