import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const sendSpotifyTrackname = async (message) => {
  const deleteButtonId = 'delete_spotify_embed_fix';
  const spotifyTrackBaseLink = 'https://open.spotify.com/track/';
  if (!message.content.includes(spotifyTrackBaseLink)) return;

  const collector = message.channel.createMessageComponentCollector({
    max: 10, // collect 10 interactions
    time: 120000, // works for 2 minutes
  });
  collector.on('collect', (interaction) => {
    if (interaction.customId === deleteButtonId && message.id === interaction.message.reference.messageId) {
      interaction.message.delete();
    }
  });

  const messageLinks = message.content.match(/https:\/\/open.spotify.com\/track\/[a-zA-Z0-9]+/g);
  const croppedLinks = messageLinks.map((link) => link.split('?')[0]).slice(0, 5);

  // make the if above a function that repeats for n - 1 times
  const maxTimes = Math.min(5, croppedLinks.length);
  const repeat = (link) => `[^](${link}) `.repeat(Math.floor(33 / maxTimes));
  const repeatedLinks = croppedLinks.map(repeat).join('');

  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(deleteButtonId)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
    );

  return await message.reply({
    content: repeatedLinks,
    components: [actionRow],
    allowedMentions: {
      repliedUser: false,
    },
  });
};
