const { Server } = require(
  require("node:path").resolve(
    __dirname,
    "../../../../server/node_modules/socket.io",
  ),
);
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const io = new Server(3101, { cors: { origin: "*" } });
const path = require("node:path"),
  fs = require("node:fs");
const output =
  process.env.QAFFELHA_TEST_OUTPUT ||
  path.join(require("node:os").tmpdir(), "qaffelha-player-check");
fs.mkdirSync(output, { recursive: true });
let players = [],
  mode = "phone",
  hostId = null;
io.on("connection", (s) => {
  const list = () => ({ mode, hostId, players });
  s.on("room:create", ({ name }, ack) => {
    players = [{ id: "p1", name, connected: true, out: false }];
    hostId = "p1";
    ack({ ok: true, code: "QAFL", playerId: "p1", serverTime: Date.now() });
    s.emit("room:players", list());
  });
  s.on("room:join", ({ code, name }, ack) => {
    if (code === "ZZZZ") return ack({ ok: false, error: "NOT_FOUND" });
    if (name === "timeout") return;
    const failures = {
      taken: "NAME_TAKEN",
      invalid: "NAME_INVALID",
      started: "STARTED",
      full: "FULL",
    };
    if (failures[name]) return ack({ ok: false, error: failures[name] });
    players = [{ id: "p1", name, connected: true, out: false }];
    hostId = null;
    ack({ ok: true, playerId: "p1", serverTime: Date.now() });
    s.emit("room:players", list());
  });
  s.on("room:rejoin", (_, ack) =>
    ack({
      ok: true,
      serverTime: Date.now(),
      state: { ...list(), status: "lobby" },
    }),
  );
});
(async () => {
  let b;
  try {
    b = await chromium.launch({ headless: true, channel: "msedge" });
    const p = await b.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:5174/play");
    await p.locator("#room-code").fill("qafl");
    await p.getByRole("button", { name: "التالي", exact: true }).click();
    await p.locator("#player-name").fill("taken");
    await p.getByRole("button", { name: "ادخل", exact: true }).click();
    await p.getByRole("alert").waitFor();
    assert.match(await p.getByRole("alert").textContent(), /الاسم مأخوذ/);
    await p.locator("#player-name").fill("Reef");
    await p.getByRole("button", { name: "ادخل", exact: true }).click();
    await p.getByRole("heading", { name: "انتظر المضيف يبدأ" }).waitFor();
    await p.reload();
    await p.getByRole("heading", { name: "انتظر المضيف يبدأ" }).waitFor();
    assert.equal(await p.locator(".q-player-chip").count(), 1);
    await p.evaluate(() => sessionStorage.clear());
    await p.goto("http://127.0.0.1:5174/play/new");
    await p.locator("#player-name").fill("Reef");
    await p.getByRole("button", { name: "افتح الغرفة", exact: true }).click();
    await p.getByRole("heading", { name: "صوّروا وادخلوا!" }).waitFor();
    assert.equal(
      await p.getByRole("button", { name: "ابدأ", exact: true }).isDisabled(),
      true,
    );
    assert.equal(await p.locator(".q-m-qr svg").count(), 1);
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 720],
      [1440, 900],
      [1920, 1080],
    ]) {
      await p.setViewportSize({ width, height });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow ${width}`,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({
      path: path.join(output, "phone-lobby.png"),
      fullPage: true,
    });
    await p.evaluate(() => sessionStorage.clear());
    await p.goto("http://127.0.0.1:5174/play/QAFL");
    for (const [name, message] of [
      ["invalid", "الاسم غير صالح"],
      ["started", "اللعبة بدأت"],
      ["full", "الغرفة مليانة"],
      ["timeout", "ما وصلنا رد"],
    ]) {
      await p.locator("#player-name").fill(name);
      await p.getByRole("button", { name: "ادخل", exact: true }).click();
      await p
        .getByRole("alert")
        .filter({ hasText: message })
        .waitFor({ timeout: 10000 });
    }
    await p.getByRole("button", { name: "غيّر الكود", exact: true }).click();
    await p.locator("#room-code").fill("ZZZZ");
    await p.getByRole("button", { name: "التالي", exact: true }).click();
    await p.locator("#player-name").fill("Reef");
    await p.getByRole("button", { name: "ادخل", exact: true }).click();
    await p
      .getByRole("alert")
      .filter({ hasText: "الغرفة مو موجودة" })
      .waitFor();
    await p.goto("http://127.0.0.1:5174/play/new");
    await p.locator("#player-name").fill("WWWWWWWWWWWWWWW");
    await p.getByRole("button", { name: "افتح الغرفة", exact: true }).click();
    await p.getByRole("heading", { name: "صوّروا وادخلوا!" }).waitFor();
    players = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i + 1}`,
      name: i % 2 ? "WWWWWWWWWWWWWWW" : "عبدالرحمنمحمدعلي".slice(0, 15),
      connected: true,
      out: false,
    }));
    io.emit("room:players", { mode, hostId, players });
    await p.waitForFunction(
      () => document.querySelectorAll(".q-player-chip").length === 12,
    );
    await p.setViewportSize({ width: 320, height: 568 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      "12 long names overflow",
    );
    for (const s of io.sockets.sockets.values()) s.conn.close();
    await p.getByRole("heading", { name: "صوّروا وادخلوا!" }).waitFor();
    await p.waitForTimeout(2000);
    assert.equal(await p.locator(".q-player-chip").count(), 12);
    console.log(
      "PB-02 edge PASS: five error codes, timeout recovery, 15-character names, 12 players, transport reconnection",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PB-02 PASS: typed code, inline error, join, refresh, phone host, QR, minimum players, six widths, no page errors",
    );
  } finally {
    if (b) await b.close();
    io.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
