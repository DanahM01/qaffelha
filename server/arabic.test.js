import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from './arabic.js';

test('hamza, diacritics, al-, taa marbuta', () => {
  assert.equal(normalize('الأَرْز'), normalize('ارز'));
  assert.equal(normalize('تفاحة'), normalize('تفاحه'));
  assert.equal(normalize('مصطفى'), normalize('مصطفي'));
});
