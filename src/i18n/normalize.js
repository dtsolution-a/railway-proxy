// Shared text normalisation used both by the dictionary build script and at
// runtime, so keys built offline always match keys looked up online.

const DEVANAGARI = /[ऀ-ॿ]/;

// Spelling variants that appear for the same word across Indian Railways
// station names, Wikidata labels and train names.
const CANON = {
  junction: 'jn',
  'jn.': 'jn',
  jcn: 'jn',
  cantonment: 'cantt',
  'cant.': 'cantt',
  cant: 'cantt',
  terminal: 'terminus',
  'trm': 'terminus',
  'tmt': 'terminus',
  rd: 'road',
  'rd.': 'road',
  'st.': 'saint',
};

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[()\[\],;:/]+/g, ' ')
    .replace(/[-–—]+/g, ' - ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function canonToken(t) {
  return CANON[t] || t;
}

// Key for looking up a (multi-word) name, order preserved.
function nameKey(text) {
  return tokenize(text)
    .filter((t) => t !== '-')
    .map(canonToken)
    .join(' ');
}

module.exports = { DEVANAGARI, tokenize, canonToken, nameKey };
