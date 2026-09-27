const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    page.on('console', msg => {
        console.log(`PAGE LOG [${msg.type()}]:`, msg.text());
    });

    page.on('pageerror', error => {
        console.log(`PAGE ERROR:`, error.message);
    });

    await page.setExtraHTTPHeaders({
        'Authorization': 'Basic ' + Buffer.from('vendor1:vendor1').toString('base64')
    });

    try {
        await page.goto('http://127.0.0.1:4004/vendor-invoices/webapp/index.html?sap-ui-logLevel=ALL', { waitUntil: 'networkidle0', timeout: 15000 });
        await new Promise(r => setTimeout(r, 15000));
        
        const html = await page.content();
        console.log('HTML SNIPPET:', html.substring(0, 1000));
        console.log('BODY HTML:', await page.evaluate(() => document.body.innerHTML.substring(0, 1000)));
        await page.screenshot({ path: 'screenshot.png' });
        console.log('Screenshot saved to screenshot.png');
    } catch (e) {
        console.log('Error:', e.message);
        await page.screenshot({ path: 'screenshot-error.png' }).catch(()=>{});
    }
    
    await browser.close();
})();
