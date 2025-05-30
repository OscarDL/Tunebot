// import fetch from 'node-fetch';

export const getLocalFileTrackInfo = async (command, prefix, details) => {
  try {
    let videoText = '';

    // const sanitizedSearchTerm = details.replace(/[;&|()]/g, '');
    // const res = await fetch(
    //   `https://www.youtube.com/youtubei/v1/search`,
    //   {
    //     method: 'POST',
    //     body: JSON.stringify({query: sanitizedSearchTerm}),
    //   },
    // );
    // const json = await res.json();

    // const content = json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    // if (!content.includes('videoRenderer')) {
    //   console.log('failed YouTube search at', new Date().toLocaleString().split(' ')[1]);
    //   console.log(json);
    // }

    // const video = content.find((item) => Object.keys(item)[0] === 'videoRenderer')?.videoRenderer;
    // videoText = `**${video.title.runs[0].text}** by ${video.ownerText.runs[0].text}`;

    videoText = videoText ? `[${videoText}](https://youtu.be/${video.videoId})` : details;

    switch (command) {
      case 's':
      case 'spotify': {
        return prefix + videoText;
      }

      case 'fm':
      case 'np': {
        return prefix + `${videoText} is currently playing.`;
      }

      default:
        throw 'Cannot execute this command with a local file.';
    }
  } catch (error) {
    console.log(error);
    return error;
  }
};
