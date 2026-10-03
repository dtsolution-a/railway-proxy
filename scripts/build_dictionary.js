#!/usr/bin/env node
/**
 * Builds the offline Hindi dictionaries used by src/i18n.
 *
 *   node scripts/build_dictionary.js [--refresh]
 *
 * Source: Wikidata (human-curated labels, keyed by the official Indian
 * Railways station code, property P5696). No translation service is used at
 * runtime - the output JSON files are committed and loaded at startup.
 *
 * Outputs (src/i18n/data):
 *   stations_hi.json  { CODE: "हिंदी नाम" }   only entries that agree with the
 *                     English name Indian Railways uses (see sanity check).
 *   words_hi.json     { "english word": "हिंदी शब्द" }  learned by aligning
 *                     English/Hindi station names word for word. Used for
 *                     train names and for stations missing from the above.
 *   report.json       what was rejected / ambiguous, for manual review.
 *
 * Inputs: src/i18n/data/stations_en.json  { CODE: "English name" }
 */
const fs = require('fs');
const path = require('path');
const { tokenize, canonToken, DEVANAGARI } = require('../src/i18n/normalize');
const { transliterateWord } = require('../src/i18n/translit');

const DATA = path.join(__dirname, '..', 'src', 'i18n', 'data');
const CACHE = path.join(__dirname, '.wikidata_cache.json');

const SPARQL = `
SELECT ?code ?hi ?en WHERE {
  ?s wdt:P5696 ?code .
  ?s rdfs:label ?hi . FILTER(LANG(?hi) = "hi")
  OPTIONAL { ?s rdfs:label ?en . FILTER(LANG(?en) = "en") }
}`;

async function fetchWikidata() {
  if (!process.argv.includes('--refresh') && fs.existsSync(CACHE)) {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  }
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(SPARQL);
  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'RaiilSaathiDictionaryBuilder/1.0 (offline Hindi station names)',
    },
  });
  if (!res.ok) throw new Error('Wikidata HTTP ' + res.status);
  const json = await res.json();
  fs.writeFileSync(CACHE, JSON.stringify(json));
  return json;
}

// "गोरखपुर जंक्शन रेलवे स्टेशन" -> "गोरखपुर जंक्शन"
const HI_SUFFIX = /\s*(रेलवे स्टेशन|रेल्वे स्टेशन|रेलवे स्थानक|रेल स्टेशन|रेलवे जंक्शन स्टेशन|स्टेशन|स्थानक)\s*$/;
const EN_SUFFIX = /\s*(railway station|rrts station|metro station)\b.*$/i;

function cleanHi(s) {
  return s.replace(HI_SUFFIX, '').replace(/\s+/g, ' ').trim();
}

function cleanEn(s) {
  return (s || '').replace(EN_SUFFIX, '').replace(/\s+/g, ' ').trim();
}

// Loose phonetic key so "Mahalaxmi" ~ "MAHALAKSHMI", "Gomti" ~ "Gomati".
const MIN_TRANSLIT_SIMILARITY = 0.4;
const QUALIFIERS = new Set(['jn', 'cantt', 'central', 'road', 'city', 'halt', 'terminus', 'town', 'east', 'west', 'north', 'south', '-']);

function phoneticKey(s) {
  return tokenize(s)
    .map(canonToken)
    .filter((t) => !QUALIFIERS.has(t))
    .join('')
    .replace(/[^a-z]/g, '')
    .replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u')
    .replace(/(.)\1/g, '$1')
    .replace(/w/g, 'v').replace(/x/g, 'ks').replace(/z/g, 'j')
    .replace(/[aeiouh]/g, '');
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

(async () => {
  const wd = await fetchWikidata();
  const irName = JSON.parse(fs.readFileSync(path.join(DATA, 'stations_en.json'), 'utf8'));

  const labels = {};
  for (const b of wd.results.bindings) {
    const code = b.code.value.trim();
    const hi = cleanHi(b.hi.value);
    if (!DEVANAGARI.test(hi)) continue;
    labels[code] = { hi, en: cleanEn(b.en && b.en.value) };
  }

  const stations = {};
  const rejected = [];
  for (const [code, { hi, en }] of Object.entries(labels)) {
    const ir = irName[code];
    if (ir) {
      const a = phoneticKey(ir), b = phoneticKey(en);
      // IR names often add a city prefix ("MUMBAI MAHIM JN" vs "Mahim"), so
      // one name containing the other still counts as the same station.
      // But the Hindi must not drop the distinguishing last word ("KOLKATA
      // CHITPUR" must not become just "Kolkata").
      const lastIr = tokenize(ir).filter((t) => t !== '-').map(canonToken)
        .filter((t) => !QUALIFIERS.has(t)).pop();
      const keepsLast = !lastIr || b.includes(phoneticKey(lastIr)) || phoneticKey(lastIr) === '';
      const contains = Math.min(a.length, b.length) >= 3 && keepsLast && (a.includes(b) || b.includes(a));
      const sim = contains ? 1 : similarity(a, b);
      // Wikidata sometimes carries a newer official name (Aurangabad ->
      // Sambhaji Nagar) or even a different station that shares the code.
      // The app displays the Indian Railways name, so the Hindi must agree.
      if (sim < 0.6) {
        rejected.push({ code, ir, wikidataEn: en, wikidataHi: hi, similarity: +sim.toFixed(2) });
        continue;
      }
    }
    stations[code] = hi;
  }

  // ── learn word-level dictionary by aligning equal-length names ──────────
  const votes = {};
  for (const [code, hi] of Object.entries(stations)) {
    const ir = irName[code];
    if (!ir) continue;
    const en = tokenize(ir).filter((t) => t !== '-').map(canonToken);
    const hiT = hi.split(' ');
    if (en.length !== hiT.length) continue;
    en.forEach((w, i) => {
      if (!/^[a-z]{2,}$/.test(w)) return;
      ((votes[w] ||= {})[hiT[i]] ||= 0);
      votes[w][hiT[i]]++;
    });
  }
  const words = {};
  const ambiguous = [];
  const misaligned = [];
  for (const [w, cands] of Object.entries(votes)) {
    const ranked = Object.entries(cands).sort((a, b) => b[1] - a[1]);
    const [best, bv] = ranked[0];
    const second = ranked[1] ? ranked[1][1] : 0;
    // Require a clear winner; one lone vote is fine when nothing contradicts it.
    if (bv <= second) continue;
    // Misaligned pairs ("patal" -> "इन्दौर") look nothing like a transliteration
    // of the English word. Drop them rather than ship a confidently wrong word.
    // Pairs seen several times are trusted; only lone votes are checked.
    if (bv < 2 && similarity(transliterateWord(w), best) < MIN_TRANSLIT_SIMILARITY) {
      misaligned.push({ word: w, hindi: best, votes: bv });
      continue;
    }
    words[w] = best;
    if (second && bv <= second * 2) ambiguous.push({ word: w, candidates: ranked.slice(0, 4) });
  }

  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  const out = (name, obj) =>
    fs.writeFileSync(path.join(DATA, name), JSON.stringify(sorted(obj)));
  out('stations_hi.json', stations);
  out('words_hi.json', words);
  fs.writeFileSync(
    path.join(DATA, 'report.json'),
    JSON.stringify({ rejected, misaligned, ambiguous: ambiguous.slice(0, 300) }, null, 1)
  );

  const total = Object.keys(irName).length;
  console.log(`stations_hi: ${Object.keys(stations).length} / ${total} Indian Railways stations`);
  console.log(`rejected (name disagrees with IR): ${rejected.length}`);
  console.log(`words_hi: ${Object.keys(words).length} learned words (${misaligned.length} dropped as misaligned)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
