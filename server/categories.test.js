import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalize } from './arabic.js';

const categories = JSON.parse(await readFile(new URL('../database/categories.json', import.meta.url), 'utf8'));

test('PB-11 supplies 30 unique categories with complete metadata', () => {
  assert.equal(categories.length, 30);
  assert.equal(new Set(categories.map(c => c._id)).size, categories.length);
  assert.equal(new Set(categories.map(c => normalize(c.title))).size, categories.length);
  for (const c of categories) {
    assert.match(c._id, /^[a-z][a-z-]*$/);
    assert.ok(c.title.trim());
    assert.ok(['easy', 'medium', 'hard'].includes(c.difficulty));
    assert.equal(c.lastUsedAt, null);
  }
});

for (const c of categories) {
  test(`${c._id}: 20+ distinct accepted answers and unambiguous aliases`, () => {
    assert.ok(c.answers.length >= 20);
    const accepted = new Map();
    for (const answer of c.answers) {
      assert.equal(typeof answer, 'string');
      assert.equal(answer, answer.trim());
      const n = normalize(answer);
      assert.ok(n.length > 0 && n.length <= 40);
      assert.ok(!accepted.has(n), `Duplicate normalized answer: ${answer}`);
      accepted.set(n, answer);
    }
    assert.equal(typeof c.aliases, 'object');
    for (const [canonical, aliases] of Object.entries(c.aliases)) {
      assert.ok(c.answers.includes(canonical));
      assert.ok(Array.isArray(aliases));
      for (const alias of aliases) {
        assert.equal(typeof alias, 'string');
        assert.equal(alias, alias.trim());
        const n = normalize(alias);
        assert.ok(n.length > 0 && n.length <= 40);
        assert.ok(!accepted.has(n), `Redundant or ambiguous alias: ${alias}`);
        accepted.set(n, canonical);
      }
    }
  });
}
