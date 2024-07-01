export const getConvertedTemperature = (message) => {
  const temp = Number(message.replace(/[^0-9.]/g, '')) || 0;
  const unit = message.slice(-1).toUpperCase();
  if (!temp) return 'Please provide a temperature.';

  const wantsCelcius = unit === 'F';
  const celsius = unit === 'F' ? (temp - 32) * 5 / 9 : temp;
  const fahrenheit = unit === 'C' ? temp * 9 / 5 + 32 : temp;

  const result = wantsCelcius ? celsius + '°C' : fahrenheit + '°F';
  return message.reply(`${temp}°${unit} is ${result}.`);
};
