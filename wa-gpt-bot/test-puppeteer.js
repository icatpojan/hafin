const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: true,
            dumpio: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Browser launched!');
        const page = await browser.newPage();
        console.log('Going to google.com...');
        await page.goto('https://google.com');
        console.log('Page title:', await page.title());
        await browser.close();
        console.log('Done!');
    } catch (err) {
        console.error('Error:', err);
    }
})();
