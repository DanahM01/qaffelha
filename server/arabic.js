// Owner: Leena. Shared normalization for names, answers and aliases.
export function normalize(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // Three remaining letters are allowed: SPEC explicitly requires الأرز → ارز.
    .split(' ').map(word => word.startsWith('ال') && word.length >= 5 ? word.slice(2) : word).join(' ')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .toLowerCase();
}
