import dotenv from 'dotenv';

dotenv.config();

const spamUsername = process.env.SPAM_USERNAME;
const firstMessageLine = spamUsername + ' says:';
const firstMessageLineBreak = firstMessageLine + '\n';

export const getReplyContent = (message, skipFirstLine = false) => ({
  content: `${skipFirstLine ? '' : firstMessageLineBreak}${message.content}`,
  files: message.attachments.map((attachment) => attachment.url),
  stickers: message.stickers.map((sticker) => sticker.id),
});

export const sendDeedgeMessage = async (message) => {
  if (message.author.username === spamUsername) {
    try {
      // find if the last message sent was also by spamUsername
      const messages = await message.channel.messages.fetch({limit: 50});
      const lastMessages = Array.from(messages.map((m) => ({...m})));
      const lastUserBotMessage = lastMessages.findIndex((m) => m.content.startsWith(firstMessageLine));
      const followUpMessages = lastUserBotMessage > -1 ? lastMessages.slice(0, lastUserBotMessage) : [];
      const isUserBotContinuity = followUpMessages.length > 0 && followUpMessages.every((m) => (
        m.author.id === '1157375969468883014' || m.author.username === spamUsername // is from bot or spamUsername
      ));

      // send last message of spamUsername flagged as spam
      if (message.reference) {
        await message.channel.messages.fetch(message.reference.messageId).then((msgToReply) => msgToReply.reply(getReplyContent(message)));
      } else {
        if (message.content.length > (2000 - firstMessageLineBreak.length)) {
          await message.channel.send(firstMessageLine);
          await message.channel.send(message.content);
        } else {
          await message.channel.send(getReplyContent(message, isUserBotContinuity));
        }
      }

      // delete previous message from spamUsername
      await message.delete();
      return true;
    } catch (e) {
      console.error(e);
    }
  }

  return false;
}
