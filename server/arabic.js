// Owner: Leena. Arabic text normalization used to compare answers.
// normalize('الأَرْز') === normalize('ارز')
export function normalize(text) {
  return text
    .trim()
    .replace(/[ً-ْـ]/g, '') // diacritics + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/^ال/, '')
    .replace(/\s+/g, ' ');
}
