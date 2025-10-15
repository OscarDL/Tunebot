export const scoreTracksOnMatch = (tracks, query) => {
  const scoredItems = tracks.map((item, index) => {
    const title = cleanWordsFromTrackName(item.name.toLowerCase());
    const artists = item.artists.map((a) => a.name.toLowerCase());
    
    let score = 0;
    
    // Check if any artist name appears in the query
    const artistMatch = artists.some((artist) => {
      // Check for exact artist name match in query
      if (query.includes(artist)) {
        score += artist.length * 2; // Higher weight for artist matches
        return true;
      }
      return false;
    });
    
    // Check if title appears in the query (or vice versa)
    if (query.includes(title)) {
      score += title.length * 2;
    } else if (title.includes(query)) {
      score += query.length;
    }
    
    // Bonus points if both artist and title match
    if (artistMatch && (query.includes(title) || title.includes(query))) {
      score += 100;
    }
    
    return { item, score, index };
  });
  
  // Sort by score (highest first), with original index as tiebreaker to ensure stability
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index; // Preserve original order for same scores
  });
  return scoredItems;
};

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
