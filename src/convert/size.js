/**
 * @param { import('discord.js').Message } message
 * @param { string } input
 * @returns { Promise<import('discord.js').Message> }
 */
export const getConvertedSize = async (message, input) => {
  const size = Number(input.replace(/[^0-9-.]/g, '')) || 0;
  if (!size) return 'Please provide a size.';

  const unit = input.slice(-1).toUpperCase();
  if (!unit) return 'Please provide a unit.';

  const isInch = unit.startsWith('inch') || unit === '"';
  const centimeters = isInch ? size * 2.54 : size;
  const inches = isInch ? size : size / 2.54;

  const result = Math.round((isInch ? centimeters : inches) * 100) / 100 + (isInch ? ' cm' : ' in');
  return await message.reply(`${size}${unit} is ${result}.`);
};
