import { CookieJar, fetchWithCookies } from './fetch-with-cookie.js';
import users from './users.json' with { type: 'json' };

export const unscrobble = async (user, track) => {
  try {
    await unscrobbleTrack(user, track);
    console.log(`Deleted scrobble: ${track.artist['#text']} - ${track.name} @ ${new Date(track.timestamp * 1000).toUTCString()}`);
    return 1;
  } catch (error) {
    console.log(error);
    return 0;
  }
};

const unscrobbleTrack = async (user, track) => {
  // Initialize cookies in jar
  const jar = new CookieJar();
  jar.setCookie(` sessionid=${user.lastfm.web.session}`, 'https://www.last.fm');
  jar.setCookie(` csrftoken=${user.lastfm.web.csrftoken}`, 'https://www.last.fm');

  const options = {
    method: 'POST',
    url: `https://www.last.fm/user/${user.lastfm.username}/library/delete`,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Accept-Language': 'en-GB,en;q=0.7,en-US;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      Accept: '*/*',
      Referer: `https://www.last.fm/user/${user.lastfm.username}/library`
    },
    form: {
      csrfmiddlewaretoken: user.lastfm.web.csrftoken,
      artist_name: track.artist['#text'],
      track_name: track.name,
      timestamp: track.date.uts,
      ajax: 1
    }
  };

  return new Promise(async (resolve, reject) => {
    try {
        const formData = new URLSearchParams(options.form);
        const response = await fetchWithCookies(jar)(`https://www.last.fm/user/${user.lastfm.username}/library/delete`, {
        method: options.method,
        headers: {
          ...options.headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
      });

      const data = await response.json();
      console.log('DATA AAAAA', data);
      // if (data.error) reject('Error deleting ' + JSON.stringify(track) + ' - ' + error);
      // if (JSON.parse(data.body).result === true) {
      //   resolve();
      // } else if (JSON.parse(data.body).result === false) {
      //   reject('Delete returned fail: ' + JSON.stringify(track));
      // } else {
      //   console.log()
      //   reject('Error deleting ' + JSON.stringify(track) + ' body:' + body);
      // }
      if (data.result === true) {
        resolve();
      } else if (data.result === false) {
        reject('Delete returned fail: ' + JSON.stringify(track));
      } else {
        reject('Error deleting ' + JSON.stringify(track) + ' body:' + response.body);
      }
    } catch (error) {
      reject('Error deleting ' + JSON.stringify(track) + ' - ' + error);
    }
  });
}

unscrobble(users[0], {name: 'Stop Thinking', artist: {'#text': 'Seven Lions'}, date: {'uts': 1746386078}});
