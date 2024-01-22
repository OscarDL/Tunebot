const vibinUsername = 'TheVibinGuy';
const vibinDipGif = 'https://media.discordapp.net/attachments/1020530190583087136/1194708618843525261/4b62b577-663e-4ad5-bfa3-001f48cf4052-2.gif';

export const getDips = async () => {
  const file = fs.readFileSync('./dips.txt', 'utf8');
  const lines = file.split('\n');
  const currentCount = parseInt(lines[0]) || 0;
  return await message.channel.send(`${vibinUsername} has dipped ${currentCount} times.`);
};

export const addDipCount = async (message) => {
  if (
    message.author.username === vibinUsername.toLowerCase() &&
    ['dip', vibinDipGif].some((dip) => message.content.toLowerCase().split(' ').some((word) => word.includes(dip)))
  ) {
    const filePath = './dips.txt';
    const file = fs.readFileSync(filePath, 'utf8');
    const lines = file.split('\n');
    const currentCount = parseInt(lines[0]) || 0;
    const newCount = currentCount + 1;
    fs.writeFileSync(filePath, String(newCount), {flag:'w'});
    return await message.channel.send(`${vibinUsername} has dipped ${newCount} times.`);
  }

  return undefined;
}
