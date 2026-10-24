import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from './arabic.js';

const cases = [
  ['الأَرْز', 'ارز'], ['تفاحة', 'تفاحه'], ['مصطفى', 'مصطفي'],
  ['  موز  ', 'موز'], ['الفراوله', 'فراوله'], ['فراولة', 'فراوله'],
  ['  عبد\t\n الرحمن  ', 'عبد رحمن'], ['أإآٱ', 'اااا'],
  ['رُؤْيَة', 'رويه'], ['بيئة', 'بييه'], ['هٰـذا', 'هذا'],
  ['التفاح الموز', 'تفاح موز'], ['ال', 'ال'], ['الي', 'الي'], ['الف', 'الف'],
  ['٠١٢٣٤٥٦٧٨٩', '0123456789'], ['Apple MANGO', 'apple mango'],
  ['', ''], ['  \n\t ', ''], ['123 موز', '123 موز'],
];
for (const [input, expected] of cases) {
  test(`normalize ${JSON.stringify(input)}`, () => assert.equal(normalize(input), expected));
}
test('normalization is stable for supported words', () => {
  for (const [input] of cases) assert.equal(normalize(normalize(input)), normalize(input));
});
