// PB-28: real server + browser regression checks, without MongoDB or production rooms.
// Requires Playwright on NODE_PATH (same setup as the other browser checks).
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '../../../..');
const { io: connect } = require(path.join(repo, 'client/node_modules/socket.io-client'));
const output = process.env.QAFFELHA_TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'qaffelha-rejoin-check');
fs.mkdirSync(output, { recursive: true });

(async () => {
  let api, vite, browser, time = Date.now(), sequence = 0;
  const jobs = new Map(), clients = [], errors = [];
  const previousOrigin = process.env.CLIENT_ORIGIN;
  const previousUrl = process.env.VITE_SERVER_URL;
  const advance = milliseconds => {
    const target = time + milliseconds;
    while (true) {
      const next = [...jobs].filter(([, job]) => job.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      jobs.delete(next[0]); time = next[1].at; next[1].callback();
    }
    time = target;
  };
  async function rpc(socket, event, input) { return socket.timeout(5000).emitWithAck(event, input); }
  async function guest(url, code, name) {
    const socket = connect(url, { transports: ['websocket'] }); clients.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    const ack = await rpc(socket, 'room:join', { code, name });
    assert.equal(ack.ok, true); return { socket, id: ack.playerId };
  }
  const identity = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('qaffelha')));
  try {
    const { createGameServer } = await import(pathToFileURL(path.join(repo, 'server/index.js')));
    const { prepareCategories } = await import(pathToFileURL(path.join(repo, 'server/game.js')));
    const { createServer } = await import(pathToFileURL(path.join(repo, 'client/node_modules/vite/dist/node/index.js')));
    process.env.CLIENT_ORIGIN = 'http://127.0.0.1:5188';
    api = createGameServer({ categories: prepareCategories([{ _id: 'fruit', title: 'فواكه', answers: ['موز', 'تفاح', 'برتقال'] }]),
      now: () => time, random: () => 0, log: () => {},
      schedule(callback, delay) { const id = ++sequence; jobs.set(id, { callback, at: time + delay }); return id; },
      cancel(id) { jobs.delete(id); } });
    await new Promise(resolve => api.http.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${api.http.address().port}`;
    process.env.VITE_SERVER_URL = url;
    vite = await createServer({ root: path.join(repo, 'client'), server: { host: '127.0.0.1', port: 5188, strictPort: true }, logLevel: 'error' });
    await vite.listen();
    browser = await chromium.launch({ channel: process.env.QAFFELHA_TEST_BROWSER || 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5188/play/new');
    await page.locator('#player-name').fill('لينا');
    await page.getByRole('button', { name: 'افتح الغرفة', exact: true }).click();
    await page.getByRole('button', { name: 'ابدأ', exact: true }).waitFor();
    const original = await identity(page), { code, playerId } = original;
    await guest(url, code, 'ريف');
    const eliminated = await guest(url, code, 'دانة');
    await page.reload();
    await page.getByRole('button', { name: 'ابدأ', exact: true }).waitFor();
    assert.deepEqual(await identity(page), original);
    await page.getByRole('button', { name: 'ابدأ', exact: true }).click();
    await page.getByLabel('العد التنازلي').waitFor();
    await page.reload();
    await page.getByLabel('العد التنازلي').waitFor();
    advance(3000);
    await page.locator('#answer').fill('موز');
    await page.getByRole('button', { name: 'إرسال', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.q-m-me b')?.textContent === '1');
    const deadline = api.rooms.get(code).endsAt;
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.q-m-me b')?.textContent === '1');
    assert.deepEqual(await identity(page), original);
    assert.equal(api.rooms.get(code).players.size, 3);
    assert.equal(api.rooms.get(code).endsAt, deadline);
    assert.equal(api.rooms.get(code).players.get(playerId).name, 'لينا');
    await page.locator('.q-lock-chip').filter({ hasText: 'موز' }).waitFor();
    // Closing the transport, unlike socket.disconnect(), exercises Socket.IO's automatic reconnect.
    await page.evaluate(async () => { const { socket } = await import('/src/socket.js'); socket.io.engine.close(); });
    await page.waitForFunction(async () => { const { socket } = await import('/src/socket.js'); return socket.connected; });
    await page.waitForFunction(() => !document.body.textContent.includes('نرجعك للعبة…') && document.querySelector('.q-m-me b')?.textContent === '1');
    advance(20000);
    await page.getByText('انتهى الوقت!', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('انتهى الوقت!', { exact: true }).waitFor();
    await page.getByText('طلع دانة', { exact: true }).waitFor();
    advance(8000);
    await page.locator('#answer').waitFor();
    const spectator = await browser.newPage({ viewport: { width: 390, height: 844 } });
    spectator.on('pageerror', error => errors.push(error.message));
    await spectator.addInitScript(value => sessionStorage.setItem('qaffelha', JSON.stringify(value)), { code, playerId: eliminated.id });
    await spectator.goto(`http://127.0.0.1:5188/play/${code}`);
    await spectator.getByText('طلعت من اللعبة — تتفرج', { exact: true }).waitFor();
    assert.equal(await spectator.locator('#answer').count(), 0);
    await page.locator('#answer').fill('تفاح');
    await page.getByRole('button', { name: 'إرسال', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.q-m-me b')?.textContent === '1');
    advance(25000);
    await page.getByText('أنت البطل!', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('أنت البطل!', { exact: true }).waitFor();
    assert.equal(await page.getByRole('list', { name: 'الترتيب النهائي', exact: true }).locator('li').count(), 3);
    await page.screenshot({ path: path.join(output, 'phone-restored-results.png'), fullPage: true, animations: 'disabled' });
    await spectator.close();
    const host = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    host.on('pageerror', error => errors.push(error.message));
    await host.goto('http://127.0.0.1:5188/host');
    await host.getByRole('button', { name: 'ابدأ', exact: true }).waitFor();
    const display = await identity(host);
    await guest(url, display.code, 'لينا'); await guest(url, display.code, 'ريف'); await guest(url, display.code, 'دانة');
    await host.getByRole('button', { name: 'ابدأ', exact: true }).click();
    await host.getByRole('timer').waitFor();
    advance(23000);
    await host.getByText('انتهى الوقت', { exact: false }).first().waitFor();
    await host.reload();
    await host.getByText('انتهى الوقت', { exact: false }).first().waitFor();
    advance(33000);
    await host.getByRole('button', { name: 'العب مرة ثانية', exact: true }).waitFor();
    await host.reload();
    await host.getByRole('button', { name: 'العب مرة ثانية', exact: true }).waitFor();
    assert.deepEqual(await identity(host), display);
    await host.screenshot({ path: path.join(output, 'host-restored-results.png'), fullPage: true, animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log('PB-28 browser checks passed: lobby, countdown, live score/deadline, network reconnect, round result, spectator, final ranking, host results; no browser errors.');
  } finally {
    for (const client of clients) client.disconnect();
    await browser?.close();
    await vite?.close();
    api?.dispose();
    if (api) await new Promise(resolve => api.io.close(resolve));
    if (previousOrigin === undefined) delete process.env.CLIENT_ORIGIN; else process.env.CLIENT_ORIGIN = previousOrigin;
    if (previousUrl === undefined) delete process.env.VITE_SERVER_URL; else process.env.VITE_SERVER_URL = previousUrl;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
