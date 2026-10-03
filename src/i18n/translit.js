// Rule-based Latin -> Devanagari transliteration for Indian place names.
//
// Last-resort fallback only: names and words found in the curated /
// Wikidata-learned dictionaries never reach this. It is tuned (see
// scripts/eval_translit.js) against thousands of real station names, but a
// Latin spelling cannot encode vowel length or dental/retroflex, so treat the
// output as a readable approximation, not a canonical spelling.

const MATRA = {
  a: '', aa: 'ा', i: 'ि', ii: 'ी', u: 'ु', uu: 'ू', e: 'े', ai: 'ै', o: 'ो', au: 'ौ',
};
const INDEP = {
  a: 'अ', aa: 'आ', i: 'इ', ii: 'ई', u: 'उ', uu: 'ऊ', e: 'ए', ai: 'ऐ', o: 'ओ', au: 'औ',
};

// Longest match first.
const VOWELS = [
  ['aa', 'aa'], ['ai', 'ai'], ['au', 'au'], ['ou', 'au'], ['ee', 'ii'], ['ii', 'ii'],
  ['oo', 'uu'], ['uu', 'uu'], ['ae', 'ai'], ['ay', 'ai'], ['a', 'a'], ['e', 'e'],
  ['i', 'i'], ['o', 'o'], ['u', 'u'],
];

const CONSONANTS = [
  ['chh', 'छ'], ['ksh', 'क्ष'], ['shr', 'श्र'], ['gya', null], ['kh', 'ख'], ['gh', 'घ'],
  ['ch', 'च'], ['jh', 'झ'], ['th', 'थ'], ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'],
  ['sh', 'श'], ['ng', 'ंग'], ['tr', 'त्र'], ['ck', 'क'], ['ll', 'ल्ल'], ['k', 'क'],
  ['g', 'ग'], ['c', 'क'], ['j', 'ज'], ['t', 'त'], ['d', 'द'], ['n', 'न'], ['p', 'प'],
  ['b', 'ब'], ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'], ['w', 'व'],
  ['s', 'स'], ['h', 'ह'], ['f', 'फ़'], ['z', 'ज़'], ['q', 'क'], ['x', 'क्स'],
];

// Cluster joined with a virama instead of an implied schwa.
const JOIN = new Set([
  'स्त', 'स्थ', 'स्क', 'स्प', 'स्न', 'स्म', 'स्व', 'श्व', 'श्च', 'क्त', 'क्ष', 'ज्य', 'त्य',
  'प्र', 'क्र', 'ग्र', 'द्र', 'ब्र', 'भ्र', 'फ्र', 'त्र', 'श्र', 'ट्र', 'ड्र', 'ध्य', 'न्य',
  'ल्य', 'व्य', 'क्य', 'म्य', 'र्य', 'ल्ल', 'ट्ट', 'ड्ड', 'त्त', 'द्द', 'न्न', 'म्म', 'च्च',
  'ज्ज', 'प्प', 'क्क', 'ग्ग', 'ब्ब', 'स्स', 'र्र', 'ल्ह', 'न्ह', 'म्ह', 'द्व', 'ट्व', 'त्व',
  'ख्य', 'ग्य', 'ह्य', 'स्य', 'श्य', 'स्ट', 'स्ड', 'ष्ट',
]);
const NASAL_BEFORE = new Set(['क', 'ख', 'ग', 'घ', 'च', 'छ', 'ज', 'झ', 'ट', 'ठ', 'ड', 'ढ', 'त', 'थ', 'द', 'ध', 'ब', 'भ']);

function tokenize(word) {
  const units = [];
  let i = 0;
  while (i < word.length) {
    const rest = word.slice(i);
    let hit = null;
    for (const [lat, v] of VOWELS) {
      if (rest.startsWith(lat)) { hit = { t: 'V', v, len: lat.length }; break; }
    }
    if (!hit) {
      for (const [lat, dev] of CONSONANTS) {
        if (dev && rest.startsWith(lat)) { hit = { t: 'C', dev, lat, len: lat.length }; break; }
      }
    }
    if (!hit) { units.push({ t: 'X', ch: word[i] }); i += 1; continue; }
    units.push(hit);
    i += hit.len;
  }
  return units;
}

// An 'a' in an open, non-final syllable (ba-la-jan) is usually long in Hindi
// spellings; one closed by a consonant cluster or the word end stays short.
function LONG_A(units, k) {
  const c = units[k + 1], v = units[k + 2];
  if (!c || c.t !== 'C' || !v || v.t !== 'V') return false;
  return k > 0; // the first syllable is short about as often as long
}

function transliterateWord(raw) {
  const word = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return raw;
  const units = tokenize(word);
  // Dental vs retroflex t/d cannot be read off the spelling; dentals scored
  // best against real station names, so that is the default.
  let out = '';
  let prevC = null; // last consonant emitted that has not yet received a vowel
  for (let k = 0; k < units.length; k++) {
    const u = units[k];
    const next = units[k + 1];
    const last = k === units.length - 1;
    if (u.t === 'X') { out += u.ch; prevC = null; continue; }

    if (u.t === 'V') {
      let v = u.v;
      if (prevC === null) {
        out += INDEP[v];
      } else {
        // Final 'a'/'i'/'u' are long in Indian place names (Kota, Delhi, Peru).
        if (last && v === 'a') v = 'aa';
        if (last && v === 'i') v = 'ii';
        if (!last && v === 'a' && LONG_A(units, k)) v = 'aa';
        out += MATRA[v];
      }
      prevC = null;
      continue;
    }

    // Consonant
    let dev = u.dev;
    if (u.lat === 'ng') {
      // "ng" is a nasal + g: Rangpur -> रंगपुर, not रनग्पुर.
      out += prevC === null && out === '' ? 'न' : dev;
      prevC = 'ग';
      continue;
    }
    // n/m before a stop, after a vowel: anusvara (Ambala -> अंबाला).
    if ((u.lat === 'n' || u.lat === 'm') && prevC === null && out !== '' && next && next.t === 'C' && NASAL_BEFORE.has(next.dev[0])) {
      out += 'ं';
      continue;
    }

    if (prevC !== null) {
      const pair = prevC + dev;
      if (JOIN.has(pair) || prevC === dev) {
        out += '्' + dev;
      } else {
        out += dev; // implied schwa between the two
      }
    } else {
      out += dev;
    }
    prevC = dev;
  }
  return out;
}

module.exports = { transliterateWord };
