export const fixEmbeddedLink = async (message) => {
  let reply = '';

  // find all instances of a url in the message content
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = message.content.match(urlRegex);
  if (!urls) return;

  const baseUrl = (url, i = '') => `[Link${i}](${url})`;

  // replace each url with an embedded link
  for (const index in urls) {
    const url = urls[index];
    const i = urls.length > 1 ? ' ' + (parseInt(index) + 1) : '';

    const instagramMatch = url.match(/https:\/\/(((www\.)?)instagram\.com)/);
    if (instagramMatch) {
      reply += `[Link${i}](${url.replace(instagramMatch[0], 'https://vxinstagram.com')})`;
      continue;
    }

    const twitterMatch = url.match(/https:\/\/(((www\.)?)(twitter\.com|x\.com))/);
    if (twitterMatch) {
      reply += `[Link${i}](${url.replace(twitterMatch[0], 'https://fxtwitter.com')})`;
      continue;
    }

    const redditMatch = url.match(/https:\/\/(((www\.)?)(reddit\.com)|redd\.it)/);
    if (redditMatch) {
      reply += `[Link${i}](${url.replace(redditMatch[0], 'https://vxreddit.com')})`;
      continue;
    }

    if (url.startsWith('https://preview.redd.it')) {
      reply += `[Link${i}](${url.replace('https://preview.redd.it', 'https://i.redd.it')})`;
      continue;
    }

    const tiktokMatch = url.match(/https:\/\/((((vx\.)?)|((www\.)?))tiktok\.com)/);
    if (tiktokMatch) {
      reply += `[Link${i}](${url.replace(tiktokMatch[0], 'https://kktiktok.com')})`;
      continue;
    }

    reply += baseUrl(url, i);
  }

  // Only suppress embeds and send fix if URLs were actually changed
  if (reply && reply !== urls.map((url, index) => {
    const i = urls.length > 1 ? ' ' + (index + 1) : '';
    return baseUrl(url, i);
  }).join('')) {
    await message.suppressEmbeds();
    return message.reply(reply.replaceAll(')[', ') \u2014 ['));
  }
};
