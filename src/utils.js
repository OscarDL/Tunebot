export const repeatTypingDuringCommand = async (message, callback) => {
  const typingInterval = setInterval(async () => await message.channel.sendTyping(), 9000);
  await callback();
  return clearInterval(typingInterval);
};

export const getNowPlayingPrefix = (isSelfAsk, userId) => isSelfAsk ? '' : `**<@${userId}>**: `;

const MAX_USER_REQUESTS = 3;
const MAX_SONG_REQUESTS = 10;
const MAX_COVER_REQUESTS = 1;

export const getEmbeddedTrackLink = (details) => {
  const {title, artists, trackId} = details;
  const trackText = `**${title}** by ${artists.join(', ')}`;
  return `[${trackText}](${`https://open.spotify.com/track/${trackId}`})`;
};

export const checkMaxRequests = async (command, nbRequests, isRequestingSongs) => {
  switch (command) {
    case 'cover': {
      if (nbRequests.length > MAX_COVER_REQUESTS) {
        return await message.reply(`Please ask for ${MAX_COVER_REQUESTS} cover${MAX_COVER_REQUESTS > 1 && 's'} at most.`);
      }
      break;
    }
    default: {
      const maxRequests = isRequestingSongs ? MAX_SONG_REQUESTS : MAX_USER_REQUESTS;
      if (nbRequests.length > maxRequests) {
        return await message.reply(`Please ask for ${maxRequests} track${maxRequests > 1 && 's'} at most.`);
      }
      break;
    }
  }
};
