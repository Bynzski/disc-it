// Run against the Vite dev server on localhost:5173.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const [name, width, height, input] of [
      ['desktop', 1440, 900, 'click'],
      ['phone', 390, 844, 'tap'],
      ['small-phone', 320, 568, 'Enter'],
      ['landscape', 844, 390, 'Space'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: name !== 'desktop', hasTouch: name !== 'desktop' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/\/src\/main\.js(?:\?.*)?$/, async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + '\nwindow.landingTest={state,camera,preview};' });
      });
      await page.goto('http://localhost:5173');
      await page.waitForFunction(() => !!window.landingTest);
      const before = await page.evaluate(() => landingTest.camera.position.toArray());
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => landingTest.camera.position.toArray());
      assert.notDeepEqual(after, before, `${name}: flyover moves`);
      assert.equal(await page.evaluate(() => landingTest.preview.active), false);
      assert.equal(await page.locator('.pg-topbar').isVisible(), false);
      const title = await page.locator('.pg-title-brand').boundingBox();
      const dock = await page.locator('.pg-title-dock').boundingBox();
      const play = await page.locator('#pg-start-round').boundingBox();
      assert(dock.x >= 0 && dock.x + dock.width <= width && dock.y + dock.height <= height);
      assert(dock.y - title.y - title.height > height * .25, `${name}: clear central scenery`);
      assert(play.height >= 44, `${name}: usable touch target`);
      await page.screenshot({ path: `/tmp/title-${name}.png` });
      if (input === 'tap') await page.locator('#pg-start-round').tap();
      else if (input === 'click') await page.locator('#pg-start-round').click();
      else await page.keyboard.press(input);
      await page.waitForFunction(() => landingTest.preview.active);
      assert.equal(await page.locator('#pg-landing').isVisible(), false);
      assert.equal(await page.evaluate(() => landingTest.state.throws), 0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS: ${name} layout, animated background, ${input} start`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
