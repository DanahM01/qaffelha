// Contract fixture for browser verification. No production game logic is implemented here.
const path = require("node:path"),
  fs = require("node:fs");
const output =
  process.env.QAFFELHA_TEST_OUTPUT ||
  path.join(require("node:os").tmpdir(), "qaffelha-player-check");
fs.mkdirSync(output, { recursive: true });
const { Server } = require(
  require("node:path").resolve(
    __dirname,
    "../../../../server/node_modules/socket.io",
  ),
);
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const io = new Server(3101, { cors: { origin: "*" } });
const clock = () => Date.now() + 60000;
const players = [
  { id: "p1", name: "Reef", out: false, connected: true },
  { id: "p2", name: "Leena", out: false, connected: true },
  { id: "p3", name: "Danah", out: false, connected: true },
];
let state = { status: "lobby", mode: "phone", hostId: "p1", players },
  submits = 0;
io.on("connection", (s) => {
  s.on("game:restart", (_, ack) => {
    state = {
      status: "lobby",
      mode: "phone",
      hostId: "p1",
      players: players.map((x) => ({ ...x, out: false })),
    };
    ack({ ok: true });
    io.emit("room:players", state);
  });
  s.on("room:create", (_, ack) => {
    ack({ ok: true, code: "QAFL", playerId: "p1", serverTime: clock() });
    s.emit("room:players", state);
  });
  s.on("room:rejoin", (_, ack) =>
    ack({ ok: true, state, serverTime: clock() }),
  );
  s.on("game:start", (_, ack) => {
    ack({ ok: true });
    state = {
      ...state,
      status: "countdown",
      round: 1,
      startsAt: clock() + 3000,
    };
    io.emit("round:countdown", { round: 1, startsAt: state.startsAt });
  });
  s.on("answer:submit", ({ text }, ack) => {
    submits++;
    const result =
      ["correct", "locked", "wrong", "repeat"][submits - 1] || "correct";
    const delta = result === "correct" ? 1 : result === "locked" ? -1 : 0;
    ack({ result, delta, score: delta });
    if (result === "correct")
      io.emit("answer:locked", { word: text, by: { id: "p1", name: "Reef" } });
    io.emit("score:update", {
      scores: [
        { id: "p1", score: delta },
        { id: "p2", score: 0 },
        { id: "p3", score: 0 },
      ],
    });
  });
});
(async () => {
  let b;
  try {
    b = await chromium.launch({ channel: "msedge", headless: true });
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:5174/play/new");
    await p.locator("#player-name").fill("Reef");
    await p.getByRole("button", { name: "افتح الغرفة", exact: true }).click();
    await p.getByRole("button", { name: "ابدأ", exact: true }).click();
    await p.getByLabel("العد التنازلي").waitFor();
    assert.match(await p.getByLabel("العد التنازلي").textContent(), /[123]/);
    state = {
      ...state,
      status: "round",
      endsAt: clock() + 20000,
      category: { id: "fruits", title: "فواكه" },
      locked: [],
      scores: players.map((x) => ({ id: x.id, score: 0 })),
    };
    io.emit("round:start", {
      round: 1,
      endsAt: state.endsAt,
      category: state.category,
    });
    await p.locator("#answer").waitFor();
    assert.match(await p.getByRole("timer").textContent(), /20|19/);
    for (const [i, word] of ["تفاح", "موز", "طماطم", "تفاح"].entries()) {
      await p.locator("#answer").fill(word);
      await p.getByRole("button", { name: "إرسال", exact: true }).click();
      await p.locator(".q-feedback").waitFor();
      await p
        .locator(".q-feedback__msg")
        .filter({ hasText: ["صح!", "مقفولة!", "مو من الفئة", "كتبتها قبل"][i] })
        .waitFor();
      assert.equal(await p.locator("#answer").inputValue(), "");
      assert.equal(
        await p
          .locator("#answer")
          .evaluate((e) => e === document.activeElement),
        true,
      );
      await p.waitForTimeout(50);
    }
    assert.equal(submits, 4);
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
      );
      const box = await p.locator("#answer").boundingBox();
      assert.ok(box.y + box.height <= height + 1, `input cutoff ${width}`);
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({ path: path.join(output, "phone-round.png") });
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.screenshot({ path: path.join(output, "wide-round.png") });
    io.emit("room:players", {
      mode: "phone",
      hostId: "p1",
      players: Array.from({ length: 12 }, (_, i) => ({
        id: `p${i + 1}`,
        name: "عبدالرحمنمحمدعلي".slice(0, 15),
        out: false,
        connected: true,
      })),
    });
    await p.setViewportSize({ width: 390, height: 400 });
    await p.waitForTimeout(100);
    const keyboardDock = await p.locator("#answer").boundingBox();
    assert.ok(
      keyboardDock.y + keyboardDock.height <= 400,
      "keyboard-height dock cutoff",
    );
    await p.setViewportSize({ width: 390, height: 844 });
    state = {
      ...state,
      status: "roundEnd",
      scores: players.map((x, i) => ({ ...x, score: i })),
      eliminated: { id: "p1", name: "Reef" },
    };
    io.emit("round:end", {
      round: 1,
      scores: state.scores,
      eliminated: state.eliminated,
    });
    await p
      .getByRole("heading", { name: "طلعت من اللعبة", exact: true })
      .waitFor();
    assert.equal(await p.locator("#answer").count(), 0);
    state.players = players.map((x) => ({ ...x, out: x.id === "p1" }));
    state = { ...state, status: "round", round: 2, endsAt: clock() + 20000 };
    io.emit("round:start", {
      round: 2,
      endsAt: state.endsAt,
      category: state.category,
    });
    await p.getByText("طلعت من اللعبة — تتفرج", { exact: true }).waitFor();
    assert.equal(await p.locator("#answer").count(), 0);
    await p.reload();
    await p.getByText("طلعت من اللعبة — تتفرج", { exact: true }).waitFor();
    assert.equal(await p.locator("#answer").count(), 0);
    console.log(
      "PB-10 PASS: elimination, no input, next-round spectating, refresh restores spectating",
    );
    state = {
      ...state,
      status: "over",
      winner: { id: "p2", name: "Leena" },
      ranking: [
        { id: "p2", name: "Leena", place: 1 },
        { id: "p3", name: "Danah", place: 2 },
        { id: "p1", name: "Reef", place: 3 },
      ],
    };
    io.emit("game:over", { winner: state.winner, ranking: state.ranking });
    await p.getByRole("heading", { name: "بطل قفّلها", exact: true }).waitFor();
    assert.equal(await p.locator(".q-score-row").count(), 3);
    assert.match(await p.locator(".q-my-score").textContent(), /3\/3/);
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
        `results overflow ${width}`,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(1600);
    await p.screenshot({
      path: path.join(output, "phone-results.png"),
      fullPage: true,
    });
    io.emit("room:players", {
      mode: "phone",
      hostId: "p2",
      players: state.players,
    });
    await p.getByText("انتظر المضيف يعيد اللعبة", { exact: true }).waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: "العب مرة ثانية", exact: true })
        .count(),
      0,
    );
    io.emit("room:players", {
      mode: "phone",
      hostId: "p1",
      players: state.players,
    });
    await p
      .getByRole("button", { name: "العب مرة ثانية", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "صوّروا وادخلوا!", exact: true })
      .waitFor();
    assert.match(p.url(), /QAFL/);
    assert.equal(await p.locator(".q-player-chip").count(), 3);
    state = { ...state, status: "over" };
    io.emit("game:over", {
      winner: { id: "p2", name: "Leena" },
      ranking: [{ id: "p2", name: "Leena", place: 1 }],
    });
    await p.getByRole("heading", { name: "بطل قفّلها", exact: true }).waitFor();
    io.emit("room:players", {
      mode: "phone",
      hostId: "p2",
      players: players.map((x) => ({ ...x, out: false })),
    });
    await p
      .getByRole("heading", { name: "انتظر المضيف يبدأ", exact: true })
      .waitFor();
    console.log(
      "PB-12 PASS: winner, own place, ranking, host-only restart, same room and players, all clients return to lobby",
    );
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.screenshot({
      path: path.join(output, "wide-lobby.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PB-05 PASS: server clock offset, countdown, four feedback results, retained focus, six sizes and dock visibility",
    );
  } finally {
    if (b) await b.close();
    io.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
