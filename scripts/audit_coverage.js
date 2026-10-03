// Lists the most frequent train-name words that are NOT in the dictionary and
// would be transliterated. Usage: node scripts/audit_coverage.js <trains.json> [N]
const fs = require('fs');
const { unknownWords, translateName } = require('../src/i18n');
const trains = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const freq = new Map();
let namesWithUnknown = 0;
for (const t of trains) {
  const u = unknownWords(t.name);
  if (u.length) namesWithUnknown++;
  for (const w of u) freq.set(w, (freq.get(w) || 0) + 1);
}
console.log(`train names: ${trains.length}, with >=1 transliterated word: ${namesWithUnknown} (${(100 * namesWithUnknown / trains.length).toFixed(1)}%), distinct unknown words: ${freq.size}`);
const n = +process.argv[3] || 80;
console.log([...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w, c]) => `${w}(${c})`).join('  '));
