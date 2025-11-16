export const repeatTypingDuringCommand = async (message, callback) => {
  const typingInterval = setInterval(async () => await message.channel.sendTyping(), 9000);
  await callback();
  return clearInterval(typingInterval);
};

const MAX_USER_REQUESTS = 3;
const MAX_SONG_REQUESTS = 10;
const MAX_COVER_REQUESTS = 1;

/**
 * @param { details: { title: string; artists: Array<string>; trackId: string } }
 * @param { string | undefined } userId
 * @returns { string }
 */
export const getEmbeddedTrackLink = (details, userId) => {
  const {title, artists, trackId} = details;
  const prefix = userId ? `**<@${userId}>**: ` : '';
  const trackText = `**${title}** by ${artists.join(', ')}`;
  return prefix + `[${trackText}](${`https://open.spotify.com/track/${trackId}`})`;
};

/**
 * @param { import('discord.js').Message } message
 * @param { string } command
 * @param { number } nbRequests
 * @param { boolean } isRequestingSongs
 * @returns { Promise<void | import('discord.js').Message> }
 */
export const checkMaxRequests = async (message, command, nbRequests, isRequestingSongs) => {
  switch (command) {
    case 'cover': {
      if (nbRequests > MAX_COVER_REQUESTS) {
        return await message.reply(`Please ask for ${MAX_COVER_REQUESTS} cover${MAX_COVER_REQUESTS > 1 ? 's' : ''} at most.`);
      }
      break;
    }
    default: {
      const maxRequests = isRequestingSongs ? MAX_SONG_REQUESTS : MAX_USER_REQUESTS;
      if (nbRequests > maxRequests) {
        return await message.reply(`Please ask for ${maxRequests} track${maxRequests > 1 ? 's' : ''} at most.`);
      }
    }
  }
};

export const isCommandSelfAsk = (message, args) =>
  !args || args.length === 0 || (args.length === 1 && args[0] === `<@${message.author.id}>`);
export const isCommandUserRequest = (args) =>
  args && args.length > 0 && args.some(arg => /(.)*<@\d+>(.)*/.test(arg));
export const isCommandSpecificSongRequest = (args) =>
  args && args.length > 0 && args.some(arg => /(.)*<@\d+>(.)*/.test(arg)) === false;
