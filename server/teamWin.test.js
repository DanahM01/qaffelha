// Reef / PB-15 acceptance cases. Classic rules are tested separately.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findWinningLine, teamGameResult } from "./game.js";

const board = () =>
  Array.from({ length: 16 }, (_, id) => ({ id, owner: null }));
const full = (owners) => owners.split("").map((owner, id) => ({ id, owner }));

for (const team of ["A", "B"])
  for (let index = 0; index < 4; index++) {
    for (const direction of ["row", "column"])
      test(`${team} wins ${direction} ${index}`, () => {
        const squares = board();
        const line = Array.from({ length: 4 }, (_, i) =>
          direction === "row" ? index * 4 + i : i * 4 + index,
        );
        line.forEach((id) => {
          squares[id].owner = team;
        });
        const before = structuredClone(squares);
        assert.deepEqual(findWinningLine([...squares].reverse()), {
          team,
          line,
        });
        assert.deepEqual(squares, before);
        assert.equal(
          teamGameResult(squares, { A: -2, B: 50 }, { A: { steal: 1 } })
            .winnerTeam,
          team,
        );
      });
  }

test("empty, partial lines and both diagonals do not win", () => {
  const squares = board();
  assert.equal(findWinningLine(squares), null);
  [0, 5, 10, 15].forEach((id) => {
    squares[id].owner = "A";
  });
  [3, 6, 9, 12].forEach((id) => {
    squares[id].owner = "B";
  });
  assert.equal(findWinningLine(squares), null);
  assert.equal(teamGameResult(squares), null);
});

test("full board uses squares, then team points, then a draw", () => {
  const tied = full("AABBBBAAAABBBBAA");
  assert.equal(findWinningLine(tied), null);
  assert.equal(teamGameResult(tied, { A: 5, B: 2 }).winnerTeam, "A");
  assert.equal(teamGameResult(tied, { A: -5, B: -2 }).winnerTeam, "B");
  assert.equal(teamGameResult(tied, { A: 5, B: 5 }).winnerTeam, null);
  const moreA = structuredClone(tied);
  moreA[2].owner = "A";
  assert.equal(findWinningLine(moreA), null);
  assert.equal(teamGameResult(moreA, { A: -50, B: 50 }).winnerTeam, "A");
});

test("a full board stays open while a steal remains possible", () => {
  const squares = full("AABBBBAAAABBBBAA");
  assert.equal(
    teamGameResult(squares, { A: 0, B: 0 }, { B: { steal: 1 } }),
    null,
  );
  assert.equal(
    teamGameResult(squares, { A: 0, B: 0 }, { A: { steal: 1 } }),
    null,
  );
  assert.equal(
    teamGameResult(
      squares,
      { A: 0, B: 0 },
      { A: { steal: 0 }, B: { steal: 0 } },
    ).winnerTeam,
    null,
  );
});

test("malformed or duplicate square IDs cannot declare a winner", () => {
  assert.equal(findWinningLine(null), null);
  assert.equal(teamGameResult(board().slice(0, 15)), null);
  const duplicate = board();
  duplicate[15] = { id: 0, owner: "A" };
  assert.equal(teamGameResult(duplicate), null);
});
