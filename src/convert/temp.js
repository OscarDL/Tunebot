/**
 * @param { import('discord.js').Message } message
 * @param { string } input
 * @returns { Promise<import('discord.js').Message> }
 */
export const getConvertedTemperature = async (message, input) => {
  const temp = Number(input.replace(/[^0-9.]/g, '')) || 0;
  const unit = input.slice(-1).toUpperCase();
  if (!temp) return 'Please provide a temperature.';

  const isF = unit === 'F';
  const celsius = isF ? (temp - 32) * 5 / 9 : temp;
  const fahrenheit = isF ? temp : temp * 9 / 5 + 32;

  const result = Math.round((isF ? celsius : fahrenheit) * 100) / 100 + (isF ? '°C' : '°F');
  return await message.reply(`${temp}°${unit} is ${result}.`);
};
