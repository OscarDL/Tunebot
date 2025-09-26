export const repeatTypingDuringCommand = async (message, callback) => {
  const typingInterval = setInterval(() => message.channel.sendTyping(), 9000);
  await callback();
  return clearInterval(typingInterval);
};
