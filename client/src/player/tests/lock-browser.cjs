// PB-17 + PB-28 integration: real team server and real phone/host pages; no MongoDB required.
// Like the existing browser checks, resolve Playwright through NODE_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '../../../..');
const { io: connect } = require(path.join(repo, 'client/node_modules/socket.io-client'));
const output = process.env.QAFFELHA_TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'qaffelha-lock-check');
fs.mkdirSync(output, { recursive: true });

(async () => {
  let api, vite, browser, time = 100000, sequence = 0;
  const jobs = new Map(), pages = [], clients = [], errors = [];
  const oldOrigin = process.env.CLIENT_ORIGIN, oldUrl = process.env.VITE_SERVER_URL;
  async function advance(ms) {
    const target = time + ms;
    while (true) {
      const next = [...jobs].filter(([, job]) => job.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      jobs.delete(next[0]); time = next[1].at; next[1].callback();
    }
    time = target;
    await Promise.all(pages.map(page => page.clock.setFixedTime(new Date(time))));
  }
  async function page(viewport) {
    const next = await browser.newPage({ viewport }); pages.push(next);
    next.on('pageerror', error => errors.push(error.message));
    await next.clock.setFixedTime(new Date(time)); return next;
  }
  const identity = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('qaffelha')));
  const request = (page, event, input) => page.evaluate(async ({ event, input }) => {
    const { socket } = await import('/src/socket.js'); return socket.timeout(5000).emitWithAck(event, input);
  }, { event, input });
  async function layout(page, sizes) {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}×${height}`);
      assert.ok(await page.evaluate(() => {
        const region = document.querySelector('[aria-label="نافذة بطاقات المواجهة"]');
        return region && region.getBoundingClientRect().bottom <= innerHeight + 1;
      }), `Card window exceeds viewport at ${width}×${height}`);
    }
  }
  try {
    const { createGameServer } = await import(pathToFileURL(path.join(repo, 'server/index.js')));
    const { prepareCategories } = await import(pathToFileURL(path.join(repo, 'server/game.js')));
    const { createServer } = await import(pathToFileURL(path.join(repo, 'client/node_modules/vite/dist/node/index.js')));
    process.env.CLIENT_ORIGIN = 'http://127.0.0.1:5191';
    api = createGameServer({ categories: prepareCategories(Array.from({ length: 16 }, (_, id) => ({
      _id: String(id), title: `فواكه ${id + 1}`, answers: ['موز', 'تفاح', 'برتقال'] }))),
      now: () => time, random: () => 0, log: () => {},
      schedule(callback, delay) { const id = ++sequence; jobs.set(id, { callback, at: time + delay }); return id; },
      cancel(id) { jobs.delete(id); } });
    await new Promise(resolve => api.http.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${api.http.address().port}`;
    process.env.VITE_SERVER_URL = url;
    vite = await createServer({ root: path.join(repo, 'client'), server: { host: '127.0.0.1', port: 5191, strictPort: true }, logLevel: 'error' });
    await vite.listen();
    browser = await chromium.launch({ channel: process.env.QAFFELHA_TEST_BROWSER || 'chrome', headless: true });
    const host = await page({ width: 1440, height: 900 });
    await host.goto('http://127.0.0.1:5191/host');
    await host.getByRole('button', { name: 'ابدأ', exact: true }).waitFor();
    const display = await identity(host), code = display.code;
    const locking = await page({ width: 390, height: 844 });
    const choosing = await page({ width: 390, height: 844 });
    const people = [];
    for (const [phone, name, team] of [[locking, 'لينا', 'B'], [choosing, 'ريف', 'A']]) {
      await phone.goto(`http://127.0.0.1:5191/play/${code}`);
      await phone.locator('#player-name').fill(name);
      await phone.getByRole('button', { name: 'ادخل', exact: true }).click();
      await phone.getByText('انتظر المضيف يبدأ', { exact: false }).waitFor();
      people.push({ ...(await identity(phone)), team });
    }
    for (const [name, team] of [['دانة', 'A'], ['رناد', 'B']]) {
      const socket = connect(url, { transports: ['websocket'] }); clients.push(socket);
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
      const ack = await socket.timeout(5000).emitWithAck('room:join', { code, name });
      people.push({ code, playerId: ack.playerId, team });
    }
    for (const person of people) assert.equal((await request(host, 'team:set', { code, playerId: person.playerId, team: person.team })).ok, true);
    await host.getByRole('button', { name: 'فرق', exact: true }).click();
    await host.getByRole('button', { name: 'ابدأ', exact: true }).click();
    // PB-15 owns the board tap UI; send its documented intent to the production PB-14 handler.
    assert.equal((await request(choosing, 'square:choose', { code, squareId: 0 })).ok, true);
    await locking.getByRole('button', { name: 'استخدم بطاقة القفل', exact: true }).waitFor();
    await host.getByRole('region', { name: 'نافذة بطاقات المواجهة' }).waitFor();
    assert.equal(await choosing.getByRole('button', { name: 'استخدم بطاقة القفل', exact: true }).count(), 0);
    const original = await identity(locking), deadline = api.rooms.get(code).cardWindowEndsAt;
    await layout(locking, [[320, 568], [390, 844], [768, 1024]]);
    await locking.setViewportSize({ width: 390, height: 844 });
    await locking.screenshot({ path: path.join(output, 'phone-lock-window.png'), fullPage: true, animations: 'disabled' });
    await layout(host, [[1280, 720], [1440, 900], [1920, 1080]]);
    await host.setViewportSize({ width: 1440, height: 900 });
    await host.screenshot({ path: path.join(output, 'host-lock-window.png'), fullPage: true, animations: 'disabled' });
    await locking.reload();
    await locking.getByRole('button', { name: 'استخدم بطاقة القفل', exact: true }).waitFor();
    await host.reload();
    await host.getByRole('region', { name: 'نافذة بطاقات المواجهة' }).waitFor();
    assert.equal(api.rooms.get(code).cardWindowEndsAt, deadline);
    await locking.getByRole('button', { name: 'استخدم بطاقة القفل', exact: true }).click();
    await locking.getByLabel('بطاقة القفل فعالة', { exact: true }).waitFor();
    await host.getByLabel('بطاقة القفل فعالة', { exact: true }).waitFor();
    assert.equal(api.rooms.get(code).cards.B.lock, 0);
    assert.equal(api.rooms.get(code).chosen.lockedBy, 'B');
    await locking.reload();
    await locking.getByLabel('بطاقة القفل فعالة', { exact: true }).waitFor();
    assert.equal(await locking.getByRole('button', { name: 'استخدم بطاقة القفل', exact: true }).count(), 0);
    assert.deepEqual(await identity(locking), original);
    await advance(8000);
    await locking.locator('#answer').fill('موز');
    await locking.getByRole('button', { name: 'إرسال', exact: true }).click();
    await locking.waitForFunction(() => document.querySelector('.q-m-me b')?.textContent === '2');
    assert.equal(await locking.locator('.q-feedback__pts').textContent(), '+2');
    await host.getByLabel('بطاقة القفل فعالة', { exact: true }).waitFor();
    const end = api.rooms.get(code).endsAt;
    await locking.reload();
    await locking.waitForFunction(() => document.querySelector('.q-m-me b')?.textContent === '2');
    await locking.getByLabel('بطاقة القفل فعالة', { exact: true }).waitFor();
    await host.reload();
    await host.getByLabel('بطاقة القفل فعالة', { exact: true }).waitFor();
    assert.equal(api.rooms.get(code).endsAt, end);
    assert.equal(api.rooms.get(code).players.size, 4);
    await locking.screenshot({ path: path.join(output, 'phone-restored-lock-round.png'), fullPage: true, animations: 'disabled' });
    await host.screenshot({ path: path.join(output, 'host-restored-lock-round.png'), fullPage: true, animations: 'disabled' });
    assert.equal((await request(choosing, 'card:play', { code, card: 'freeze' })).ok, true);
    await locking.locator('.q-frozen').waitFor();
    await locking.reload();
    await locking.waitForFunction(() => document.querySelector('.q-m-me b')?.textContent === '2');
    await locking.locator('.q-frozen').waitFor();
    assert.equal(api.rooms.get(code).players.get(original.playerId).frozenUntil, time + 3000);
    await advance(20000);
    assert.equal(api.rooms.get(code).teamPoints.B, 2);
    await advance(4000);
    assert.equal((await request(locking, 'square:choose', { code, squareId: 1 })).ok, true);
    await choosing.getByRole('button', { name: 'استخدم بطاقة القفل', exact: true }).waitFor();
    assert.equal(await locking.getByLabel('بطاقة القفل فعالة', { exact: true }).count(), 0);
    await advance(8000);
    await locking.locator('#answer').fill('موز');
    await locking.getByRole('button', { name: 'إرسال', exact: true }).click();
    await locking.waitForFunction(() => document.querySelector('.q-m-me b')?.textContent === '1');
    assert.equal(api.rooms.get(code).chosen.lockedBy, null);
    assert.deepEqual(errors, []);
    console.log('PB-17 browser checks passed: permission, six layout sizes, one use, +2 feedback, host/phone badges, next-battle expiry, and PB-28 refresh with active Lock and Freeze.');
  } finally {
    for (const client of clients) client.disconnect();
    await browser?.close(); await vite?.close(); api?.dispose();
    if (api) await new Promise(resolve => api.io.close(resolve));
    if (oldOrigin === undefined) delete process.env.CLIENT_ORIGIN; else process.env.CLIENT_ORIGIN = oldOrigin;
    if (oldUrl === undefined) delete process.env.VITE_SERVER_URL; else process.env.VITE_SERVER_URL = oldUrl;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
