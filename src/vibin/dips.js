import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const vibinUsername = 'TheVibinGuy';
const vibinDipGif = 'https://media.discordapp.net/attachments/1020530190583087136/1194708618843525261/4b62b577-663e-4ad5-bfa3-001f48cf4052-2.gif';
const filePath = `${process.env.ABS_PATH}/src/vibin/dips.txt`;

/**
 * @param { import('discord.js').Message } message
 * @returns { Promise<import('discord.js').Message> }
 */
export const getDips = async (message) => {
  const file = fs.readFileSync(filePath, 'utf8');
  const lines = file.split('\n');
  const currentCount = parseInt(lines[0]) || 0;
  return await message.channel.send(`${vibinUsername} has dipped ${currentCount} times.`);
};

/**
 * @param { import('discord.js').Message } message
 * @returns { Promise<import('discord.js').Message | undefined> }
 */
export const addDipCount = async (message) => {
  if (
    message.author.username === vibinUsername.toLowerCase() &&
    ['dip', vibinDipGif].some((dip) => message.content.toLowerCase().split(' ').some((word) => word.startsWith(dip)))
  ) {
    const file = fs.readFileSync(filePath, 'utf8');
    const lines = file.split('\n');
    const currentCount = parseInt(lines[0]) || 0;
    const newCount = currentCount + 1;
    fs.writeFileSync(filePath, String(newCount), {flag:'w'});
    return await message.channel.send(`${vibinUsername} has dipped ${newCount} times.`);
  }

  return;
}
