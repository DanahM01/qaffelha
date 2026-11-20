import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectTeamSitouts,
  prepareTeamSitouts,
  teamCardPermission,
  recordTeamCardChoice,
  submitTeamAnswer,
} from "./game.js";
import { publishTeamSitouts } from "./index.js";

function fixture() {
  const players = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    team: i < 3 ? "A" : "B",
    score: i % 3,
    lastCorrectAt: null,
    connected: true,
    submitted: new Set(),
    submissionTimes: [],
  }));
  return {
    gameMode: "teams",
    status: "battleEnd",
    round: 1,
    players: new Map(players.map((p) => [p.id, p])),
    joinOrder: players.map((p) => p.id),
    sitout: { A: null, B: null },
    cards: { A: { freeze: 1, lock: 1 }, B: { freeze: 1 } },
  };
}

test("lowest scorer sits out for each team without mutating the room", () => {
  const room = fixture();
  const next = prepareTeamSitouts(room);
  assert.deepEqual(next.sitout, { A: "p0", B: "p3" });
  assert.deepEqual(room.sitout, { A: null, B: null });
  assert.deepEqual(next.cardChoices, {});
});

test("ties use slower correct answer, then no correct answer, then latest join", () => {
  const room = fixture();
  const a = [...room.players.values()]
    .slice(0, 3)
    .map((p) => ({ ...p, score: 0, lastCorrectAt: 10 }));
  a[0].lastCorrectAt = 20;
  assert.equal(selectTeamSitouts(a, room.joinOrder).A, "p0");
  a[1].lastCorrectAt = null;
  assert.equal(selectTeamSitouts(a, room.joinOrder).A, "p1");
  a.forEach((p) => {
    p.lastCorrectAt = null;
  });
  assert.equal(selectTeamSitouts(a, room.joinOrder).A, "p2");
});

test("two-player teams never sit out; the previous chooser returns to play", () => {
  const room = fixture();
  const members = [...room.players.values()];
  assert.deepEqual(
    selectTeamSitouts(
      members.filter((p) => !["p2", "p5"].includes(p.id)),
      room.joinOrder,
    ),
    { A: null, B: null },
  );
  assert.deepEqual(
    selectTeamSitouts(members, room.joinOrder, { A: "p0", B: "p3" }),
    { A: "p1", B: "p4" },
  );
});

test("only the sitting-out teammate can choose; success is final and teams stay isolated", () => {
  const room = prepareTeamSitouts(fixture());
  assert.equal(teamCardPermission(room, "p1"), "NOT_ALLOWED");
  assert.equal(teamCardPermission(room, "missing"), "NOT_ALLOWED");
  assert.equal(recordTeamCardChoice(room, "p0", "mine").error, "NO_CARD");
  assert.equal(recordTeamCardChoice(room, "p0", "invalid").error, "BAD_TARGET");
  const first = recordTeamCardChoice(room, "p0", "lock");
  assert.equal(first.error, null);
  assert.equal(first.room.cardChoices.A, "lock");
  assert.equal(room.cardChoices.A, undefined);
  assert.equal(
    first.room.cards.A.lock,
    1,
    "the card owner, not PB-20, consumes the card",
  );
  assert.equal(
    recordTeamCardChoice(first.room, "p0", "freeze").error,
    "NOT_ALLOWED",
  );
  assert.equal(recordTeamCardChoice(first.room, "p3", "freeze").error, null);
});

test("without a sitting-out member, any connected teammate retains normal card permissions", () => {
  const room = fixture();
  assert.equal(teamCardPermission(room, "p1"), null);
  room.players.get("p1").connected = false;
  assert.equal(teamCardPermission(room, "p1"), "NOT_ALLOWED");
});

test("sitting-out answer is closed without changing points or claiming a word", () => {
  const room = {
    ...prepareTeamSitouts(fixture()),
    status: "round",
    endsAt: 2000,
  };
  const result = submitTeamAnswer(room, "p0", "تفاح", 1000);
  assert.equal(result.room, room);
  assert.deepEqual(result.ack, { result: "closed", delta: 0, score: 0 });
  assert.equal(result.word, null);
});

test("sit-out delivery is room-scoped and idempotent for the same battle", () => {
  const rooms = new Map([["QAFL", fixture()]]),
    messages = [];
  const io = {
    to: (code) => ({
      emit: (event, payload) => messages.push({ code, event, payload }),
    }),
  };
  assert.equal(publishTeamSitouts(io, rooms, "QAFL"), true);
  assert.equal(publishTeamSitouts(io, rooms, "QAFL"), false);
  assert.deepEqual(messages, [
    { code: "QAFL", event: "team:sitout", payload: { A: "p0", B: "p3" } },
  ]);
});
