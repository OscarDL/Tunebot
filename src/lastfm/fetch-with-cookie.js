export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setCookie(cookieStr, url) {
    const cookieParts = cookieStr.split(';').map(part => part.trim());
    const [nameValue, ...attributes] = cookieParts;
    const [name, value] = nameValue.split('=').map(s => s.trim());
    
    const cookie = {
      name,
      value: decodeURIComponent(value),
      domain: new URL(url).hostname,
      path: '/',
      secure: false,
      httpOnly: false
    };

    // Parse cookie attributes
    attributes.forEach(attr => {
      const [key, val] = attr.split('=').map(s => s.trim().toLowerCase());
      if (key === 'domain') cookie.domain = val;
      if (key === 'path') cookie.path = val;
      if (key === 'secure') cookie.secure = true;
      if (key === 'httponly') cookie.httpOnly = true;
    });

    const domainKey = cookie.domain;
    if (!this.cookies.has(domainKey)) {
      this.cookies.set(domainKey, new Map());
    }
    this.cookies.get(domainKey).set(name, cookie);
  }

  getCookies(url) {
    const urlObj = new URL(url);
    const cookies = [];

    this.cookies.forEach((domainCookies, domain) => {
      if (urlObj.hostname.endsWith(domain)) {
        domainCookies.forEach(cookie => {
          if (urlObj.pathname.startsWith(cookie.path)) {
            if (!cookie.secure || urlObj.protocol === 'https:') {
              cookies.push(`${cookie.name}=${encodeURIComponent(cookie.value)}`);
            }
          }
        });
      }
    });

    return cookies.join('; ');
  }
}

export const fetchWithCookies = (jar = new CookieJar()) => async (url, options = {}) => {
  // Add cookies from jar to request
  const cookies = jar.getCookies(url);
  if (cookies) {
    options.headers = {
      ...options.headers,
      'Cookie': cookies,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': url,
      'Origin': new URL(url).origin
    };
  }

  // Make the request
  const response = await fetch(url, options);

  // Handle Set-Cookie headers
  const setCookieHeaders = response.headers.getAll ? 
    response.headers.getAll('set-cookie') : 
    (response.headers.get('set-cookie') || '').split(/,(?=[^;]+=[^;]+)/);

  if (setCookieHeaders) {
    setCookieHeaders.forEach(cookie => jar.setCookie(cookie, url));
  }

  const responseText = await response.text();
  return {
    ...response,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    responseBody: responseText,
    json: async () => JSON.parse(responseText)
  };
};