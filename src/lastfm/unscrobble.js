import request from 'request';
import limit from 'simple-rate-limiter';

/**
 * @param { import('./users.json')[number] } user
 * @param { * } track
 * @returns { Promise<boolean> }
 */
export const unscrobble = async (user, track) => {
  let limitedRequest = limit(request).to(1).per(1000);

  let jar = request.jar();
  jar.setCookie(request.cookie(' sessionid=' + user.lastfm.web.session), 'https://www.last.fm');
  jar.setCookie(request.cookie(' csrftoken=' + user.lastfm.web.csrftoken), 'https://www.last.fm');

  try {
    await unscrobbleTrack(track, user, jar, limitedRequest);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

/**
 * @param { * } track
 * @param { import('./users.json')[number] } user
 * @param { import('request').CookieJar } jar
 * @param { * } limitedRequest 
 * @returns { Promise<void> }
 */
const unscrobbleTrack = async (track, user, jar, limitedRequest) => {
  let options = {
    method: 'POST',
    url: `https://www.last.fm/user/${user.lastfm.username}/library/delete`,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Accept-Language': 'en-GB,en;q=0.7,en-US;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      Accept: '*/*',
      Referer: `https://www.last.fm/user/${user.lastfm.username}/library`,
    },
    jar,
    gzip: true,
    form: { 
      'csrfmiddlewaretoken': user.lastfm.web.csrftoken,
      'artist_name': track.artist['#text'],
      'track_name': track.name,
      'timestamp': track.date.uts,
      'ajax': 1,
    },
  };

  return new Promise((resolve, reject) => {
    try {
      limitedRequest(options, (error, response, body) => {
        if (error) reject('Error deleting ' + JSON.stringify(track) + ' - ' + error);
        try {
          if (JSON.parse(body).result === true) {
            resolve();
          } else if (JSON.parse(body).result === false) {
            reject('Delete returned fail: ' + JSON.stringify(track));
          } else {
            reject('Error deleting ' + JSON.stringify(track) + ' body:'+body);
          }
        } catch (error) {
          console.log(response);
          reject('Error parsing JSON response ' + body + ' - ' + error);
        }
      });
    } catch (error) {
      reject('Error deleting ' + JSON.stringify(track) + ' - ' + error);
    }
  });
}
