// Run-mode browser checks. Requires the Vite dev server on http://localhost:5173
// (npm run dev) and Playwright (set PLAYWRIGHT_PATH if it is installed elsewhere).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/jay/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const URL = process.env.GAME_URL || 'http://localhost:5173';
const xss = '<img src=x onerror=alert(1)>';

async function openGame(browser, board) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await page.route('**/api/leaderboard*', route => board === 'offline'
    ? route.abort()
    : route.fulfill({ json: { rows: board } }));
  await page.goto(URL);
  await page.waitForSelector('#pg-start-round');
  return { page, dialogs };
}

// The hole flyover preview swallows all keys and clicks until it ends; skip it before playing.
async function startPlaying(page, start = '#pg-start-round') {
  await page.click(start);
  await page.waitForFunction(() => window.__discState && window.__discState.showLanding === false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__discState.mode === 'aiming');
}

(async () => {
  const browser = await chromium.launch();
  try {
    // 1. Board renders hostile names as literal text.
    {
      const { page, dialogs } = await openGame(browser, [{ rank: 1, name: xss, parDiff: -2, totalThrows: 52, createdAt: 1 }]);
      await page.waitForSelector('#pg-board-list li');
      assert.equal(await page.locator('#pg-board-list img').count(), 0);
      assert.equal(await page.locator('#pg-board-list .who').first().textContent(), xss);
      assert.equal(await page.locator('#pg-board-list .score').first().textContent(), '-2');
      assert.deepEqual(dialogs, []);
      await page.close();
    }

    // 2. Offline board: message shown, Play still works.
    {
      const { page } = await openGame(browser, 'offline');
      await page.waitForFunction(() => document.querySelector('#pg-board-note')?.textContent === 'Leaderboard offline');
      await page.click('#pg-start-round');
      await page.waitForFunction(() => window.__discState && window.__discState.showLanding === false);
      await page.close();
    }

    // 3. Free play restarts; leaderboard run does not.
    for (const mode of ['free', 'run']) {
      const { page } = await openGame(browser, []);
      await startPlaying(page, mode === 'run' ? '#pg-start-run' : '#pg-start-round');
      // The action nav is visibility:hidden during the hole flyover, so check the hidden attribute, not visibility.
      assert.equal(await page.locator('#pg-restart').evaluate(e => e.hidden), mode === 'run');
      assert.equal(await page.locator('#pg-quit').evaluate(e => e.hidden), mode === 'free');
      await page.evaluate(() => { window.__discState.throws = 2; });
      await page.keyboard.press('r');
      const throws = await page.evaluate(() => window.__discState.throws);
      assert.equal(throws, mode === 'run' ? 2 : 0, `${mode}: throws after R`);
      await page.close();
    }

    // 4. Name box swallows shortcuts instead of replaying / skipping.
    {
      const { page } = await openGame(browser, []);
      await startPlaying(page, '#pg-start-run');
      await page.evaluate(() => {
        const s = window.__discState;
        s.scores = s.scores.map(() => 3);
        s.finished = true;
        s.runResult = { phase: 'name' };
      });
      await page.waitForSelector('#pg-run-name-input', { state: 'visible' });
      await page.fill('#pg-run-name-input', '');
      await page.click('#pg-run-name-input');
      await page.keyboard.type('rnv123');
      assert.equal(await page.inputValue('#pg-run-name-input'), 'rnv123');
      const after = await page.evaluate(() => ({ finished: window.__discState.finished, holeIndex: window.__discState.holeIndex, scores: window.__discState.scores.length, throwsSet: window.__discState.scores.every(s => s === 3) }));
      assert.deepEqual(after, { finished: true, holeIndex: 0, scores: 18, throwsSet: true });
      await page.close();
    }
    // 5. Name prompt: Enter spam posts once; N cannot discard the run; the input gets focus.
    {
      const { page } = await openGame(browser, []);
      let posts = 0;
      await page.route('**/api/rounds', async route => {
        posts++;
        await new Promise(r => setTimeout(r, 600));
        await route.fulfill({ status: 201, json: { id: 1, rank: 1 } });
      });
      await startPlaying(page, '#pg-start-run');
      await page.evaluate(() => {
        const s = window.__discState;
        s.scores = s.scores.map(() => 3);
        s.holeIndex = s.scores.length - 1;
        s.finished = true;
        s.runResult = { phase: 'name' };
      });
      await page.waitForSelector('#pg-run-name-input', { state: 'visible' });
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'pg-run-name-input', 'name input is focused');
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.press('n');
      const afterN = await page.evaluate(() => ({ landing: window.__discState.showLanding, run: window.__discState.runMode }));
      assert.deepEqual(afterN, { landing: false, run: true }, 'N must not leave the run while the name prompt is showing');
      await page.fill('#pg-run-name-input', 'Spam');
      // The form hides after the first submit, so key presses can't reach it; submit it directly to hit the wiring.
      await page.evaluate(() => { const form = document.querySelector('#pg-run-form'); for (let i = 0; i < 4; i++) form.requestSubmit(); });
      await page.waitForFunction(() => /You ranked/.test(document.querySelector('#pg-run-status').textContent));
      assert.equal(posts, 1, 'one run posts once');
      await page.close();
    }
    console.log('run-mode browser checks passed');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
