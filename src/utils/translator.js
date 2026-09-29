const { translate } = require('@vitalets/google-translate-api');
const fs = require('fs');
const path = require('path');

// ─── Persistent disk cache for Google translations ─────────────────────────
const cachePath = path.join(__dirname, 'translation_cache.json');
let transCache = {};
if (fs.existsSync(cachePath)) {
  try { transCache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch(e) {}
}

// ─── Static Hindi dictionary (instant, no API needed) ─────────────────────
let hiDict = { stations: {}, train_name_suffixes: {} };
const dictPath = path.join(__dirname, 'hi_dictionary.json');
if (fs.existsSync(dictPath)) {
  try { hiDict = JSON.parse(fs.readFileSync(dictPath, 'utf8')); } catch(e) {}
}

// ─── Serial queue to avoid rate-limiting on Google Translate ──────────────
const queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;
  while (queue.length > 0) {
    const { text, resolve } = queue.shift();
    const cacheKey = `${text}_hi`;
    if (transCache[cacheKey]) { resolve(transCache[cacheKey]); continue; }
    try {
      const res = await translate(text, { to: 'hi' });
      transCache[cacheKey] = res.text;
      fs.writeFileSync(cachePath, JSON.stringify(transCache));
      resolve(res.text);
    } catch (e) {
      resolve(text); // fallback: return original on error
    }
    await new Promise(r => setTimeout(r, 80)); // throttle: 1 call per 80ms
  }
  isProcessing = false;
}

/**
 * Translate a single string to Hindi.
 * Priority: 1) static dictionary  2) disk cache  3) Google (queued)
 */
async function translateText(text, lang) {
  if (!text || typeof text !== 'string' || lang !== 'hi') return text;
  if (!text.trim()) return text;

  // 1. Exact match in static dictionary
  if (hiDict.stations[text]) return hiDict.stations[text];

  // 2. Disk/memory cache from previous Google translations
  const cacheKey = `${text}_hi`;
  if (transCache[cacheKey]) return transCache[cacheKey];

  // 3. Queue for Google Translate (rate-limited serial calls)
  return new Promise(resolve => {
    queue.push({ text, resolve });
    processQueue();
  });
}

/**
 * Translate train name: replace common English suffixes with Hindi equivalents.
 * E.g. "Surat Mahuva Express" → "सूरत माहुवा एक्सप्रेस"
 */
function translateTrainName(name) {
  if (!name) return name;
  let result = name;
  // Replace station name parts
  for (const [en, hi] of Object.entries(hiDict.stations)) {
    if (result.includes(en)) result = result.replaceAll(en, hi);
  }
  // Replace suffix keywords
  for (const [en, hi] of Object.entries(hiDict.train_name_suffixes)) {
    if (result.includes(en)) result = result.replaceAll(en, hi);
  }
  return result;
}

/**
 * Deep-translate an API response object.
 */
async function deepTranslate(obj, lang) {
  if (lang !== 'hi') return obj;
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    const res = [];
    for (const item of obj) res.push(await deepTranslate(item, lang));
    return res;
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      const val = obj[key];

      if (key === 'trainName' && typeof val === 'string') {
        // Try dictionary-based translation first (instant)
        const dictResult = translateTrainName(val);
        if (dictResult !== val) {
          result[key] = dictResult;
        } else {
          // Fall back to Google Translate
          result[key] = await translateText(val, lang);
        }
      } else if (['name', 'stationName', 'boardingPoint', 'reservationUpto'].includes(key) && typeof val === 'string') {
        result[key] = await translateText(val, lang);
      } else if (['from', 'to'].includes(key) && typeof val === 'object' && val !== null) {
        result[key] = await deepTranslate(val, lang);
      } else if (['route', 'trains', 'history'].includes(key)) {
        result[key] = await deepTranslate(val, lang);
      } else if (key === 'currentLocation' && typeof val === 'object') {
        result[key] = await deepTranslate(val, lang);
      } else if (typeof val === 'object' && val !== null && key !== 'coaches') {
        result[key] = await deepTranslate(val, lang);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  return obj;
}

module.exports = { deepTranslate };
