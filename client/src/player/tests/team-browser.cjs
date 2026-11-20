// Reef's UI contract fixture. Run sequentially with client port 5175 / server port 3102.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { Server } = require(
  path.resolve(__dirname, "../../../../server/node_modules/socket.io"),
);
const { chromium } = require("playwright");
const output =
  process.env.QAFFELHA_TEST_OUTPUT ||
  path.join(require("node:os").tmpdir(), "qaffelha-teams");
fs.mkdirSync(output, { recursive: true });
const io = new Server(3102, { cors: { origin: "*" } });
const cards = { freeze: 1, lock: 1, mine: 1, steal: 1 };
const state = {
  status: "turn",
  gameMode: "teams",
  mode: "phone",
  hostId: "p1",
  players: Array.from({ length: 6 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `لاعب ${i + 1}`,
    team: i < 3 ? "A" : "B",
    connected: true,
    out: false,
  })),
  board: Array.from({ length: 16 }, (_, id) => ({
    id,
    owner: id === 15 ? "B" : null,
    category: {
      id: `cat${id}`,
      title: id === 0 ? "أكلات شعبية سعودية مشهورة" : `فئة ${id + 1}`,
    },
  })),
  teamPoints: { A: 3, B: -2 },
  cards: { A: { ...cards }, B: { ...cards } },
  sitout: { A: null, B: null },
  mines: [2],
  turn: { team: "A", endsAt: Date.now() + 60000 },
  scores: [],
  round: 1,
};
const requests = [];
io.on("connection", (socket) => {
  socket.on("room:rejoin", (identity, ack) => {
    socket.data.playerId = identity.playerId;
    const player = state.players.find(
      (entry) => entry.id === identity.playerId,
    );
    ack({
      ok: true,
      serverTime: Date.now(),
      state: {
        ...state,
        mines: player.team === "A" ? state.mines : [],
        me: {
          id: player.id,
          team: player.team,
          score: 0,
          sittingOut: state.sitout[player.team] === player.id,
        },
      },
    });
  });
  socket.on("square:choose", (payload, ack) => {
    requests.push({ event: "square:choose", ...payload });
    ack({ ok: true });
  });
  socket.on("card:play", (payload, ack) => {
    requests.push({ event: "card:play", ...payload });
    const player = state.players.find(
      (entry) => entry.id === socket.data.playerId,
    );
    state.cardChoices = { ...state.cardChoices, [player.team]: payload.card };
    state.cards[player.team][payload.card] = Math.max(
      0,
      state.cards[player.team][payload.card] - 1,
    );
    ack({ ok: true });
    io.emit("board:update", {
      board: state.board,
      cards: state.cards,
      teamPoints: state.teamPoints,
    });
  });
});

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const errors = [];
    async function phone(playerId) {
      const page = await browser.newPage({
        viewport: { width: 360, height: 640 },
        reducedMotion: "reduce",
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(
        (id) =>
          sessionStorage.setItem(
            "qaffelha",
            JSON.stringify({ code: "QAFL", playerId: id }),
          ),
        playerId,
      );
      await page.goto("http://127.0.0.1:5175/play/QAFL");
      await page
        .locator(".q-badge--team-a, .q-badge--team-b")
        .first()
        .waitFor();
      return page;
    }
    const page = await phone("p1");
    const rival = await phone("p4");
    await page.locator(".q-team-board__tile").first().waitFor();
    assert.equal(await page.locator(".q-team-board__tile").count(), 16);
    assert.equal(
      await rival.locator(".q-team-board__tile:not(:disabled)").count(),
      0,
    );
    assert.equal(
      await rival.locator('[aria-label*="لغم فريقك"]').count(),
      0,
      "private mines are not shown to the opponent",
    );
    assert.equal(
      await page.locator(".q-team-board__tile").nth(15).isDisabled(),
      true,
    );
    await page.locator(".q-team-board__tile").nth(1).click();
    await page.waitForTimeout(80);
    assert.deepEqual(requests[0], {
      event: "square:choose",
      code: "QAFL",
      squareId: 1,
    });
    assert.equal(
      await page.locator(".is-team-a").count(),
      0,
      "capture must wait for the server",
    );
    for (const [width, height] of [
      [320, 568],
      [360, 640],
      [390, 844],
      [768, 1024],
      [1280, 720],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow at ${width}`,
      );
      const boxes = await page
        .locator(".q-team-board__tile")
        .evaluateAll((tiles) =>
          tiles.map((tile) => ({
            width: tile.offsetWidth,
            height: tile.offsetHeight,
            bottom: tile.getBoundingClientRect().bottom,
          })),
        );
      assert.ok(
        boxes.every((box) => box.width >= 64 && box.height >= 64),
        `touch targets at ${width}`,
      );
      if (width === 360)
        assert.ok(
          boxes.every((box) => box.bottom <= height),
          "board fits 360×640",
        );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);
    await page.screenshot({
      path: path.join(output, "team-board.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(120);
    await page.screenshot({
      path: path.join(output, "team-board-wide.png"),
      fullPage: true,
    });
    io.emit("turn:start", { team: "A", endsAt: Date.now() - 1 });
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator(".q-team-board__tile:not(:disabled)").count(),
      0,
    );
    state.board.slice(0, 4).forEach((square) => {
      square.owner = "A";
    });
    io.emit("board:update", {
      board: state.board,
      teamPoints: state.teamPoints,
      cards: state.cards,
    });
    io.emit("game:over", {
      winnerTeam: "A",
      line: [0, 1, 2, 3],
      squares: { A: 4, B: 1 },
      teamPoints: state.teamPoints,
    });
    await page
      .getByRole("heading", { name: "فاز فريقك!", exact: true })
      .waitFor();
    await rival
      .getByRole("heading", { name: "خسر فريقك", exact: true })
      .waitFor();
    assert.equal(await page.locator(".is-winning").count(), 4);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(output, "team-win.png"),
      fullPage: true,
    });
    io.emit("game:over", {
      winnerTeam: null,
      line: null,
      squares: { A: 8, B: 8 },
      teamPoints: { A: 0, B: 0 },
    });
    await page
      .getByRole("heading", { name: "تعادل الفريقين!", exact: true })
      .waitFor();
    assert.equal(await page.locator(".is-winning").count(), 0);

    state.status = "turn";
    state.turn = { team: "A", endsAt: Date.now() + 60000 };
    state.sitout = { A: "p1", B: "p4" };
    state.cardChoices = {};
    io.emit("team:sitout", state.sitout);
    io.emit("turn:start", state.turn);
    await page.getByText("أنت تختار بطاقة فريقك", { exact: true }).waitFor();
    assert.equal(
      await page.locator(".q-team-board__tile:not(:disabled)").count(),
      0,
      "sitting-out player cannot choose a normal square",
    );
    await page
      .getByRole("button", { name: "لغم، المتبقي 1", exact: true })
      .click();
    assert.equal(
      await page.locator(".q-team-board__tile").nth(2).isDisabled(),
      true,
      "own mined square is not another mine target",
    );
    await page.locator(".q-team-board__tile").nth(4).click();
    await page
      .getByText("اختيارك: لغم — تم تثبيته لهالجولة", { exact: true })
      .waitFor();
    assert.deepEqual(requests.at(-1), {
      event: "card:play",
      code: "QAFL",
      card: "mine",
      target: 4,
    });
    assert.equal(
      await page
        .locator(".q-team-cards__buttons button:not(:disabled)")
        .count(),
      0,
      "choice is final",
    );

    state.turn = { team: "A", endsAt: Date.now() + 60000 };
    state.cardChoices = {};
    io.emit("turn:start", state.turn);
    await page
      .getByRole("button", { name: "سرقة، المتبقي 1", exact: true })
      .click();
    assert.equal(
      await page.locator(".q-team-board__tile:not(:disabled)").count(),
      1,
    );
    await page.locator(".q-team-board__tile").nth(15).click();
    await page
      .getByText("اختيارك: سرقة — تم تثبيته لهالجولة", { exact: true })
      .waitFor();
    assert.deepEqual(requests.at(-1), {
      event: "square:choose",
      code: "QAFL",
      squareId: 15,
      steal: true,
    });

    state.turn = { team: "B", endsAt: Date.now() + 60000 };
    state.cardChoices = {};
    state.chosen = {
      squareId: 5,
      team: "B",
      steal: false,
      cardWindowEndsAt: Date.now() + 5000,
    };
    io.emit("turn:start", state.turn);
    io.emit("battle:chosen", state.chosen);
    await page
      .getByRole("button", { name: "قفل، المتبقي 1", exact: true })
      .click();
    await page
      .getByText("اختيارك: قفل — تم تثبيته لهالجولة", { exact: true })
      .waitFor();
    state.turn = { team: "B", endsAt: Date.now() + 60000 };
    io.emit("turn:start", state.turn);
    state.status = "round";
    state.round = 2;
    state.endsAt = Date.now() + 20000;
    state.category = { id: "fruit", title: "فواكه" };
    state.locked = [];
    state.cardChoices = {};
    state.sitout = { A: "p2", B: "p5" };
    io.emit("team:sitout", state.sitout);
    io.emit("round:start", {
      round: state.round,
      endsAt: state.endsAt,
      category: state.category,
      squareId: 5,
      lockedBy: "A",
    });
    await page.locator("#answer").waitFor();
    const chooser = await phone("p2");
    await chooser.getByText("أنت تختار بطاقة فريقك", { exact: true }).waitFor();
    assert.equal(
      await chooser.locator("#answer").count(),
      0,
      "chooser cannot answer",
    );
    await chooser
      .getByRole("button", { name: "تجميد، المتبقي 1", exact: true })
      .click();
    await chooser
      .getByText("اختيارك: تجميد — تم تثبيته لهالجولة", { exact: true })
      .waitFor();
    await chooser.reload();
    await chooser
      .getByText("اختيارك: تجميد — تم تثبيته لهالجولة", { exact: true })
      .waitFor();
    assert.equal(await chooser.locator("#answer").count(), 0);
    await chooser.setViewportSize({ width: 390, height: 844 });
    await chooser.waitForTimeout(120);
    await chooser.screenshot({
      path: path.join(output, "team-card-choice.png"),
      fullPage: true,
    });
    assert.equal(
      await page.locator(".q-team-cards__buttons button").count(),
      0,
      "active teammate cannot take the chooser role",
    );
    await page.setViewportSize({ width: 390, height: 400 });
    await page.waitForTimeout(120);
    const dock = await page.locator("#answer").boundingBox();
    assert.ok(
      dock.bottom === undefined
        ? dock.y + dock.height <= 400
        : dock.bottom <= 400,
      "answer dock stays visible at keyboard height",
    );
    console.log(
      "PB-20 browser PASS: sit-out controls, mine target, Lock window, final choice, next-battle return, refresh, teammate restriction, reduced height",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PB-15 browser PASS: team permissions, server-only captures, deadlines, 7 sizes, 64px targets, winning line, loss, draw",
    );
  } finally {
    if (browser) await browser.close();
    io.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
