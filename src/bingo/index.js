import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';

// Constants for the bingo game
const cardCount = 25;
const cardsPerRow = 5;
const cardWidth = 300;
const cardHeight = 300;
const cardPadding = 10;

export const getRandomBingoCard = async (message) => {
  const channel = await message.guild.channels.fetch(process.env.BINGO_CHANNEL_ID);
  const bingo = await channel.messages.fetch(process.env.BINGO_MESSAGE_ID);

  // Split each tier into an array of items without the tier name
  let tiers = bingo.content.split('\n\n# ').map((tier) => tier.split('\n').slice(1));

  // Remove the first sentence of the message
  tiers.shift();

  // Pick 6 random items from tier 1
  // Pick 13 random items from tier 2
  // Pick 6 random items from tier 3
  const randomTier1 = tiers[0].sort(() => Math.random() - 0.5).slice(0, 6);
  const randomTier2 = tiers[1].sort(() => Math.random() - 0.5).slice(0, 13);
  const randomTier3 = tiers[2].sort(() => Math.random() - 0.5).slice(0, 6);

  // Create a canvas
  const canvas = createCanvas(cardsPerRow * cardWidth, Math.ceil(cardCount / cardsPerRow) * cardHeight);
  const ctx = canvas.getContext('2d');

  // Set the background to white
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Set text properties
  ctx.font = '36px Arial';
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Text wrapping function
  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.replaceAll('/', ' / ').trim().split(' ');
    let line = '';
    let testLine = '';
    let testWidth = 0;
    let lines = [];

    for (let n = 0; n < words.length; n++) {
      testLine += `${words[n]} `;
      testWidth = context.measureText(testLine).width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = `${words[n]} `;
        testLine = `${words[n]} `;
      } else {
        line += `${words[n]} `;
      }
    }
    lines.push(line);

    for (let i = 0; i < lines.length; i++) {
      context.fillText(lines[i], x, y - (lines.length - 1) * lineHeight / 2 + i * lineHeight);
    }
  }

  // Shuffle the cards
  const cardTexts = [...randomTier1, ...randomTier2, ...randomTier3].map((text) => text.replace(/[\\n-]+/, ''));
  const shuffledTexts = cardTexts.sort(() => 0.5 - Math.random());

  // Draw the text cards on the canvas
  shuffledTexts.forEach((text, index) => {
    const x = (index % cardsPerRow) * cardWidth + cardWidth / 2;
    const y = Math.floor(index / cardsPerRow) * cardHeight + cardHeight / 2;
    ctx.strokeRect((index % cardsPerRow) * cardWidth, Math.floor(index / cardsPerRow) * cardHeight, cardWidth, cardHeight);
    wrapText(ctx, text, x, y, cardWidth - cardPadding * 2, 42); // Adjust line height as necessary
  });

  // Save the image to a file
  const out = fs.createWriteStream(path.join(process.env.ABS_PATH, 'bingo.png'));
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on('finish', async () => {
    // Send the image file to the Discord channel
    await message.reply({
      files: [{
        attachment: path.join(process.env.ABS_PATH, 'bingo.png'),
        name: 'bingo.png'
      }]
    });

    // Delete the image file
    fs.unlinkSync(path.join(process.env.ABS_PATH, 'bingo.png'));
  });

  // return message.reply(`Here's your bingo card!\n\nTier 1:\n${randomTier1.join('\n')}\n\nTier 2:\n${randomTier2.join('\n')}\n\nTier 3:\n${randomTier3.join('\n')}`);
};
