import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin({
  enabledEvasions: [
    'chrome.runtime',
    'iframe.contentWindow',
    'media.codecs',
    'navigator.languages',
    'navigator.permissions',
    'navigator.plugins',
    'navigator.webdriver',
    'sourceurl',
    'user-agent-override'
  ]
}));

const createBrowserPage = async (browser) => {
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    Accept: 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br', // Important for Cloudflare
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
  });

  // Navigate first to homepage to establish trust
  await page.goto('https://tunebat.com', { waitUntil: 'networkidle2' });

  page.setDefaultNavigationTimeout(60000); // 60 seconds
  page.setDefaultTimeout(60000); // For other operations like waitForSelector

  // Wait for Cloudflare challenge to complete if any
  while (true) {
    const content = await page.content();
    if (!content.includes('Just a moment...')) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return page;
}

export const runTunebatBrowserInstance = async (message, callback) => {
  let browser;

  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await createBrowserPage(browser);
    await callback(page);
  } catch (error) {
    console.error('Error during tunebat search:', error);
    return await message.reply('Could not fetch data. Tunebat may be causing issues.');
  } finally {
    await browser?.close();
  }
};
