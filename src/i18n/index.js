// Hindi localisation of Rail Radar API responses.
//
// Everything here is offline and synchronous: station names come from a
// Wikidata-derived dictionary keyed by station code, train names are composed
// from a learned + curated word dictionary, and anything unknown falls back
// to rule-based transliteration. Nothing blocks on a network call, so Hindi
// responses are as fast as English ones.
//
// Only human-readable display text is rewritten. Machine values the app
// branches on (status, trackingMode, provenance, class/berth codes, slugs,
// timestamps, numbers) are always passed through untouched.

const stationsEn = require('./data/stations_en.json');
const stationsHiRaw = require('./data/stations_hi.json');
const wordsHiRaw = require('./data/words_hi.json');
const trainWords = require('./data/train_words_hi.json');
const overrides = require('./data/overrides_hi.json');
const { nameKey, canonToken } = require('./normalize');
const { transliterateWord } = require('./translit');
const { LABEL_PHRASES, QUOTAS, MESSAGES } = require('./lexicon');

// Wikidata mixes old and new Hindi orthography; normalise to what readers expect.
const ORTHOGRAPHY = [
  [/न्यु/g, 'न्यू'], [/नियु/g, 'न्यू'], [/रोड़/g, 'रोड'], [/नोर्थ/g, 'नॉर्थ'],
  [/ट्रमिनस/g, 'टर्मिनस'], [/केविन/g, 'केबिन'],
];
const fixHi = (s) => ORTHOGRAPHY.reduce((acc, [re, to]) => acc.replace(re, to), s);

const STATIONS = {};
for (const [code, hi] of Object.entries(stationsHiRaw)) STATIONS[code] = fixHi(hi);
Object.assign(STATIONS, overrides.stations);

const WORDS = {};
for (const [en, hi] of Object.entries(wordsHiRaw)) WORDS[en] = fixHi(hi);
Object.assign(WORDS, trainWords, overrides.words, { bi: 'द्वि', tri: 'त्रि' });

// Indian Railways station name (normalised) -> Hindi. Multi-word spans are
// how "New Delhi" becomes नई दिल्ली rather than न्यू दिल्ली inside train names.
const NAME_INDEX = new Map();
const MAX_SPAN = 6;
for (const [code, en] of Object.entries(stationsEn)) {
  const hi = STATIONS[code];
  if (!hi) continue;
  const key = nameKey(en);
  if (key && !NAME_INDEX.has(key)) NAME_INDEX.set(key, hi);
}
// Overrides win for names whose code we curate (e.g. LKO "Lucknow" -> लखनऊ).
for (const code of Object.keys(overrides.stations)) {
  const en = stationsEn[code];
  if (en) NAME_INDEX.set(nameKey(en), STATIONS[code]);
}

const ABBREV = new Set(['jn', 'cantt', 'exp', 'expr', 'spl', 'spcl', 'psgr', 'pass', 'rd', 'dr']);
const WORD_RE = /(?<![A-Za-z0-9])[A-Za-z][A-Za-z'’]*(?![A-Za-z0-9])/g;

const LETTERS = {
  a: 'ए', b: 'बी', c: 'सी', d: 'डी', e: 'ई', f: 'एफ', g: 'जी', h: 'एच', i: 'आई', j: 'जे',
  k: 'के', l: 'एल', m: 'एम', n: 'एन', o: 'ओ', p: 'पी', q: 'क्यू', r: 'आर', s: 'एस', t: 'टी',
  u: 'यू', v: 'वी', w: 'डब्ल्यू', x: 'एक्स', y: 'वाई', z: 'ज़ेड',
};

// "jammutawi" -> जम्मू + तवी, "newdelhi" -> न्यू + दिल्ली. Both halves must be
// known words, otherwise a chance split would produce nonsense.
// Place-name endings are written joined to the stem in Hindi (चित + पुर).
const JOINED_SUFFIXES = new Set([
  'pur', 'pura', 'nagar', 'ganj', 'garh', 'gadh', 'abad', 'bad', 'gaon', 'gram', 'wadi', 'palli',
  'halli', 'konda', 'kot', 'puri', 'dham', 'pally', 'palle', 'peta', 'pet', 'pettai', 'kheda',
]);

function splitCompound(lower) {
  for (let i = lower.length - 3; i >= 3; i--) {
    const rest = lower.slice(i);
    const a = WORDS[lower.slice(0, i)];
    const b = WORDS[rest];
    if (a && b) return JOINED_SUFFIXES.has(rest) ? a + b : `${a} ${b}`;
  }
  return null;
}

function translateWord(raw, keepCaps) {
  const lower = canonToken(raw.toLowerCase().replace(/['’]/g, ''));
  if (WORDS[lower]) return WORDS[lower];
  // Short ALL-CAPS tokens in labels are codes (SL, EOG, SLR) - leave them be.
  if (keepCaps && /^[A-Z]{1,4}$/.test(raw)) return raw;
  if (/^[IVX]+$/.test(raw)) return raw; // roman numerals
  // Vowel-less capitals are initialisms (MMTS, CST): read out the letters.
  if (/^[B-DF-HJ-NP-TV-Z]{1,5}$/.test(raw) && raw === raw.toUpperCase()) {
    return [...lower].map((c) => LETTERS[c]).join('');
  }
  return splitCompound(lower) || transliterateWord(raw);
}

function translateText(text, { keepCaps = false } = {}) {
  const matches = [...text.matchAll(WORD_RE)];
  if (matches.length === 0) return text;

  let out = '';
  let cursor = 0;
  let i = 0;
  while (i < matches.length) {
    // Longest multi-word span that is a known station name.
    let spanLen = 0;
    let spanHi = null;
    for (let n = Math.min(MAX_SPAN, matches.length - i); n >= 2; n--) {
      let contiguous = true;
      for (let j = i; j < i + n - 1; j++) {
        const gap = text.slice(matches[j].index + matches[j][0].length, matches[j + 1].index);
        if (!/^\s+$/.test(gap)) { contiguous = false; break; }
      }
      if (!contiguous) continue;
      const key = nameKey(matches.slice(i, i + n).map((m) => m[0]).join(' '));
      if (NAME_INDEX.has(key)) { spanLen = n; spanHi = NAME_INDEX.get(key); break; }
    }

    const first = matches[i];
    out += text.slice(cursor, first.index);
    if (spanLen) {
      const last = matches[i + spanLen - 1];
      out += spanHi;
      cursor = last.index + last[0].length;
      i += spanLen;
    } else {
      const word = first[0];
      const lower = word.toLowerCase();
      out += translateWord(word, keepCaps);
      cursor = first.index + word.length;
      // Swallow the full stop of abbreviations ("Jn.", "Exp.") - the Hindi
      // form carries its own punctuation where needed.
      if (ABBREV.has(lower) && text[cursor] === '.') cursor += 1;
      i += 1;
    }
  }
  return out + text.slice(cursor);
}

const memo = new Map();
function memoised(kind, text, fn) {
  const k = kind + '\u0000' + text;
  let v = memo.get(k);
  if (v === undefined) {
    v = fn();
    if (memo.size > 20000) memo.clear();
    memo.set(k, v);
  }
  return v;
}

// A whole-string station name ("Kota Jn", "MUMBAI CENTRAL") or free text.
function translateName(text) {
  if (!text || !/[A-Za-z]/.test(text)) return text;
  return memoised('name', text, () => {
    const hi = NAME_INDEX.get(nameKey(text));
    return hi || fixHi(translateText(text));
  });
}

function stationLabel(code, en) {
  if (code && STATIONS[code]) return STATIONS[code];
  return translateName(en);
}

function translateLabel(text) {
  if (!text || !/[A-Za-z]/.test(text)) return text;
  return memoised('label', text, () => {
    let s = text;
    for (const [re, hi] of LABEL_PHRASES) s = s.replace(re, hi);
    return fixHi(translateText(s, { keepCaps: true }));
  });
}

function translateQuota(text) {
  const hi = QUOTAS[text.trim().toLowerCase()];
  if (!hi) return translateLabel(text);
  return /^[A-Za-z]{2}$/.test(text.trim()) ? `${hi} (${text.trim().toUpperCase()})` : hi;
}

function translateMessage(text) {
  for (const [re, hi] of MESSAGES) if (re.test(text)) return hi;
  return text;
}

const isCode = (s) => /^[A-Z0-9]{1,6}$/.test(s) && Object.prototype.hasOwnProperty.call(STATIONS, s);

// ── response walker ────────────────────────────────────────────────────────
function localizeString(key, value, obj, parentKey) {
  switch (key) {
    case 'stationName':
      return stationLabel(obj.stationCode, value);
    case 'fromStationName':
      return stationLabel(obj.fromStation, value);
    case 'toStationName':
      return stationLabel(obj.toStation, value);
    case 'sourceStationName':
      return stationLabel(obj.sourceStation, value);
    case 'destinationStationName':
      return stationLabel(obj.destinationStation, value);
    case 'trainName':
    case 'train_name':
      return translateName(value);
    case 'name':
      if (parentKey === 'train') return translateName(value); // { number, name, type, ... }
      if (/\b(berth|seat)\b/i.test(value)) return translateLabel(value);
      return stationLabel(obj.code || obj.stationCode, value);
    case 'type':
    case 'category':
      // Only the train's own type/category; "type" also holds codes like "LB".
      return parentKey === 'train' ? translateLabel(value) : value;
    case 'className':
      return translateLabel(value);
    case 'city':
      return translateName(value);
    case 'boardingPoint':
    case 'boardingStation':
    case 'reservationUpto':
    case 'reservationUptoName':
      return isCode(value) ? STATIONS[value] : translateName(value);
    case 'quota':
    case 'journeyQuota':
      return translateQuota(value);
    case 'message':
      return translateMessage(value);
    default:
      return value;
  }
}

function walk(node, key, parentKey) {
  if (Array.isArray(node)) return node.map((v) => walk(v, key, parentKey));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = typeof v === 'string' ? localizeString(k, v, node, key) : walk(v, k, key);
    }
    return out;
  }
  return node;
}

function isHindi(lang) {
  return typeof lang === 'string' && lang.toLowerCase().startsWith('hi');
}

// Returns a localised copy of an API response (or the object unchanged for
// English / unknown languages).
function localize(payload, lang) {
  if (!isHindi(lang) || payload == null) return payload;
  return walk(payload, '', '');
}

// Words in `text` that would fall through to transliteration. Used by
// scripts/audit_coverage.js to find vocabulary worth adding to the dictionary.
function unknownWords(text) {
  const out = [];
  for (const m of String(text).matchAll(WORD_RE)) {
    const lower = canonToken(m[0].toLowerCase().replace(/['’]/g, ''));
    if (WORDS[lower] || /^[IVX]+$/.test(m[0]) || splitCompound(lower)) continue;
    if (/^[B-DF-HJ-NP-TV-Z]{1,5}$/.test(m[0]) && m[0] === m[0].toUpperCase()) continue;
    out.push(lower);
  }
  return out;
}

module.exports = {
  unknownWords,
  localize,
  isHindi,
  translateName,
  translateLabel,
  translateMessage,
  stationLabel,
  STATIONS,
};
