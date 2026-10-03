// Measures the fallback transliterator against the Wikidata-learned word
// list. Usage: node scripts/eval_translit.js [--show N]
const path = require('path');
const words = require('../src/i18n/data/words_hi.json');
const { transliterateWord } = require('../src/i18n/translit');

function sim(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}
let exact = 0, total = 0, s = 0; const bad = [];
for (const [en, hi] of Object.entries(words)) {
  if (!/^[a-z]{3,}$/.test(en)) continue;
  total++;
  const out = transliterateWord(en);
  if (out === hi) exact++; else bad.push([en, hi, out]);
  s += sim(out, hi);
}
console.log(`words ${total}  exact ${(100 * exact / total).toFixed(1)}%  mean-similarity ${(100 * s / total).toFixed(1)}%`);
const k = process.argv.includes('--show') ? +process.argv[process.argv.indexOf('--show') + 1] : 0;
bad.sort(() => Math.random() - 0.5).slice(0, k).forEach(([e, h, o]) => console.log(e.padEnd(18), h.padEnd(16), o));
