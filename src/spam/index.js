import dotenv from 'dotenv';

dotenv.config();

const spamUserId = process.env.SPAM_USER_ID;
const spamUsername = process.env.SPAM_USERNAME;
const firstMessageLine = spamUsername + ' says:';
const firstMessageLineBreak = firstMessageLine + '\n';

export const getReplyContent = (message, skipFirstLine = false) => ({
  content: `${skipFirstLine ? '' : firstMessageLineBreak}${message.content}`,
  files: message.attachments.map((attachment) => attachment.url),
  stickers: message.stickers.map((sticker) => sticker.id),
});

const wasMessageSentBySpamUser = async (message, messageReference) => {
  const includeMessageAndBefore = messageReference ? {before: messageReference.id} : {};

  const messages = await message.channel.messages.fetch({limit: 50, ...includeMessageAndBefore});
  const lastMessages = (messageReference ? [messageReference] : []).concat(Array.from(messages.map((m) => ({...m}))));

  const lastUserBotMessage = lastMessages.findIndex((m) => m.content.startsWith(firstMessageLine));
  const followUpMessages = lastUserBotMessage > -1 ? lastMessages.slice(0, lastUserBotMessage) : [];

  const isSpamUserContinuity = followUpMessages.length > 0 && followUpMessages.every((m) => (
    m.author.id === process.env.BOT_DISCORD_ID || m.author.username === spamUsername // is from bot or spamUsername
  ));
  return isSpamUserContinuity;
};

export const sendSpamUserMessage = async (message) => {
  if (message.author.username !== spamUsername) return;

  try {
    // find if the last message sent was also by spamUsername
    const isSpamUserContinuity = await wasMessageSentBySpamUser(message);

    // send last message of spamUsername flagged as spam
    if (message.reference) {
      await message.channel.messages.fetch(message.reference.messageId).then((msgToReply) => msgToReply.reply(getReplyContent(message)));
    } else {
      if (message.content.length > (2000 - firstMessageLineBreak.length)) {
        await message.channel.send(firstMessageLine);
        await message.channel.send(message.content);
      } else {
        await message.channel.send(getReplyContent(message, isSpamUserContinuity));
      }
    }

    // delete previous message from spamUsername
    await message.delete();
  } catch (e) {
    console.error(e);
  }
}

export const checkShouldPingSpamUser = async (message) => {
  // if the message is pinging the bot, send a ping to spamUser and immediately delete it afterwards
  if (message.mentions?.repliedUser?.id !== process.env.BOT_DISCORD_ID) return;

  const {messageId} = message.reference;
  const repliedMessage = await message.channel.messages.fetch(messageId);
  const sendGhostPing = async () => {
    const ghostPing = await message.channel.send(`<@${spamUserId}>`);
    await ghostPing.delete();
  };

  // replied message was for sure sent by spamUser and relayed by the bot
  if (repliedMessage.content.startsWith(firstMessageLine)) return await sendGhostPing();

  // need to make sure the replied message was sent by spamUser and relayed by the bot, and not a bot command
  const isSpamUserContinuity = await wasMessageSentBySpamUser(message, repliedMessage);
  if (isSpamUserContinuity) return await sendGhostPing();
};
