// End-to-end check against the production build, at iPhone size:
//   npm run build && npm run test:offline
// Starts `vite preview`, walks the main flows, then cuts the network and reloads.
// Needs Playwright with Chromium installed. Pass a directory as argv[2] to save screenshots.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const assert = require('assert');
const path = require('path');

const URL = 'http://localhost:4173/';
const shots = process.argv[2];

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', detached: true });
  const browser = await chromium.launch();
  let failed = false;
  try {
    const context = await browser.newContext({ ...devices['iPhone 14'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const shot = async (name) => shots && page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
    const step = (name) => console.log('ok  ' + name);

    for (let i = 0; ; i++) {
      try { await page.goto(URL); break; } catch (e) { if (i > 40) throw e; await new Promise((r) => setTimeout(r, 250)); }
    }
    await page.waitForSelector('.tile');
    assert.equal(await page.locator('.tile').count(), 9);
    await shot('home');
    step('home shows 9 game tiles');

    const badgeOf = (name) => page.locator('.tile', { hasText: name }).first().locator('.badge-label').innerText();
    assert.match(await badgeOf('Jacks or Better'), /PREFERRED/);
    await page.selectOption('.goal select', 'return');
    assert.match(await badgeOf('Jacks or Better'), /GOOD/);
    assert.match(await badgeOf('Double Bonus'), /PREFERRED/);
    await page.selectOption('.goal select', 'state');
    assert.match(await badgeOf('Bonus Streak'), /PREFERRED/);
    await shot('home-state-goal');
    await page.selectOption('.goal select', 'preserve');
    step('goal selector changes preference badges');

    await page.locator('.tile', { hasText: 'Jacks or Better' }).click();
    await page.waitForSelector('.paytable');
    await page.getByRole('button', { name: '9/6', exact: true }).click();
    assert.match(await page.locator('.verdict').innerText(), /MATCH[\s\S]*99\.54%/);
    await page.getByRole('button', { name: '8/5', exact: true }).click();
    assert.match(await page.locator('.verdict').innerText(), /BELOW TARGET[\s\S]*97\.30%[\s\S]*Full House: 8 instead of 9/);
    await shot('jacks-below-target');
    await page.getByRole('button', { name: 'Increase Straight', exact: true }).click();
    const unknown = await page.locator('.verdict').innerText();
    assert.match(unknown, /UNKNOWN TABLE/);
    assert.doesNotMatch(unknown, /\d\d\.\d\d%/);
    step('paytable entry: match, below target, unknown without an RTP');

    await page.getByRole('button', { name: /Compute exact return/ }).click();
    await page.waitForSelector('text=exact return with optimal strategy', { timeout: 120000 });
    await shot('jacks-custom-exact');
    step('exact return for a custom table runs in a worker');

    await page.getByRole('button', { name: '9/6', exact: true }).click();
    assert.equal(await page.locator('.strategy li').count(), 16);
    await shot('jacks-detail');
    await page.getByRole('link', { name: /Train 9\/6/ }).click();
    await page.waitForSelector('.playing-card:not(.blank)');
    await page.locator('.playing-card').first().click();
    await shot('trainer-question');
    await page.locator('.btn', { hasText: /Hold|Discard/ }).click();
    await page.waitForSelector('.verdict');
    assert.match(await page.locator('.verdict').innerText(), /CORRECT|INCORRECT/);
    await shot('trainer-result');
    await page.reload();
    await page.waitForSelector('.scores');
    assert.equal(await page.locator('.scores strong').first().innerText(), '1');
    step('trainer grades a hand and the score survives a reload');

    await page.goto(URL + '#/game/ultimate-x-bonus-streak');
    await page.getByRole('button', { name: /10-play · Double Double Bonus 8\/5/ }).click();
    const fields = page.locator('.state-input input');
    await fields.nth(0).fill('20');
    await fields.nth(1).fill('34');
    assert.match(await page.locator('.verdict-play').first().innerText(), /QUALIFIES/);
    assert.match(await page.locator('.card', { hasText: 'Exit' }).innerText(), /STOP AFTER 2 DEALS/);
    await shot('bonus-streak-play');
    await page.getByRole('button', { name: 'Other / not listed' }).click();
    assert.match(await page.locator('.verdict').first().innerText(), /NO RULE FOR THIS CONFIGURATION/);
    await page.goto(URL + '#/game/ultimate-x');
    await page.locator('.state-input input').fill('30');
    assert.match(await page.locator('.verdict').first().innerText(), /NO RULE/);
    await shot('ultimate-x');
    step('persistent state: qualifies with exit, and NO RULE when unsourced');

    await page.goto(URL + '#/game/ten-play');
    assert.match(await page.locator('.card', { hasText: 'Total wager' }).innerText(), /\$12\.50 per deal/);
    await shot('ten-play');
    step('Ten Play shows total wager exposure');

    await page.goto(URL);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => page.reload());
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('.tile');
    await page.locator('.tile', { hasText: 'Deuces Wild' }).click();
    await page.getByRole('link', { name: /^Train/ }).click();
    await page.waitForSelector('.playing-card:not(.blank)');
    await page.goto(URL + '#/game/ultimate-x-bonus-streak');
    await page.waitForSelector('.option');
    step('works offline after first load (home, detail, trainer, state check)');

    assert.deepEqual(errors, []);
    step('no page errors');
  } catch (e) {
    failed = true;
    console.error('FAILED', e);
  } finally {
    await browser.close();
    try { process.kill(-server.pid); } catch {}
  }
  process.exit(failed ? 1 : 0);
})();
