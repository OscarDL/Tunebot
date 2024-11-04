import fetch from 'node-fetch';

export const getYouTubeVideo = async (command, prefix, details) => {
  try {
    const sanitizedSearchTerm = details.replace(/[;&|()]/g, '');
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/search`,
      {
        method: 'POST',
        body: JSON.stringify({query: sanitizedSearchTerm}),
      },
    );
    const json = await res.json();

    const content = json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    if (!content.includes('videoRenderer')) {
      console.log('failed YouTube search at', new Date().toLocaleString().split(' ')[1]);
      console.log(json);
    }

    const video = content.find((item) => Object.keys(item)[0] === 'videoRenderer')?.videoRenderer;
    const videoText = `**${video.title.runs[0].text}** by ${video.ownerText.runs[0].text}`;

    switch (command) {
      case 's':
      case 'spotify': {
        return prefix + `[${videoText}](https://youtu.be/${video.videoId})`;
      }

      case 'fm':
      case 'np': {
        return prefix + `[${videoText}](https://youtu.be/${video.videoId}) is currently playing.`;
      }

      default:
        break;
    }
  } catch (error) {
    console.log(error);
    return error;
  }
};
