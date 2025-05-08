import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createCanvas } from 'canvas';

// Constants for the bingo game
const cardCount = 25;
const cardsPerRow = 5;
const cardWidth = 300;
const cardHeight = 300;
const cardPadding = 10;

// Get the current date as a string from US-west timezone (YYYY-MM-DD)
const getCurrentDateString = () => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  dateStyle: 'short',
}).format(new Date());

// Seeded random number generator (using Mulberry32)
const seededRandom = (seed) => {
  let t = seed;
  return function() {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ x >>> 15, 1 | x);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
};

const getSeedForUserAndDate = (userAndDate) => {
  const seed = crypto.createHash('sha256').update(userAndDate).digest('hex').slice(0, 8);
  return parseInt(seed, 16);
};

// Shuffle array using seeded random number generator
const shuffleArray = (array, seed) => {
  const random = seededRandom(seed);
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export const getRandomBingoCard = async (message) => {
  const channel = await message.guild.channels.fetch(process.env.BINGO_CHANNEL_ID);
  const bingo = await channel.messages.fetch(process.env.BINGO_MESSAGE_ID);
  const userId = message.author.id;

  // Split each tier into an array of items without the tier name
  let [_, free, likely, possible, unlikely] = bingo.content.split('\n\n# ').map((tier) => tier.split('\n').slice(1));

  // Create a seed based on the current date string
  const currentDateString = getCurrentDateString();
  const seed = getSeedForUserAndDate(currentDateString + userId);

  // Pick 6 random items from tier 1 using the seed
  // Pick 12 random items from tier 2 using the seed
  // Pick 6 random items from tier 3 using the seed
  const randomFree = shuffleArray([...free], seed).slice(0, 1);
  const randomLikely = shuffleArray([...likely], seed).slice(0, 6);
  const randomPossible = shuffleArray([...possible], seed).slice(0, 12);
  const randomUnlikely = shuffleArray([...unlikely], seed).slice(0, 6);

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

  // Shuffle the cards using the seed
  const cards = [...randomLikely, ...randomPossible, ...randomUnlikely];
  const cardTexts = cards.map((text) => text.replace(/[\\n-]+/, ''));
  const shuffledTexts = shuffleArray([...cardTexts], seed);

  // Add a card from the free tier that will always be in the center
  shuffledTexts.splice(Math.floor(shuffledTexts.length / 2), 0, randomFree[0].replace('- ', '[FREE] '));

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
      content: "Here's your personal Bingo card for today's stream:",
      files: [{
        attachment: path.join(process.env.ABS_PATH, 'bingo.png'),
        name: 'bingo.png'
      }]
    });

    // Delete the image file
    fs.unlinkSync(path.join(process.env.ABS_PATH, 'bingo.png'));
  });
};
