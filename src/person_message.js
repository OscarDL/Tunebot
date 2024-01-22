const getPersonMessage = async (message, username, defaultText) => {
  const lastMessage = (await message.channel.messages.fetch({ limit: 100 })).filter((msg) => msg.author.username === username).random();
  return lastMessage?.content || defaultText;
};

module.exports = getPersonMessage;
