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
let hiDict = { stations: {}, train_suffixes: {} };
const dictPath = path.join(__dirname, 'hi_dictionary.json');
if (fs.existsSync(dictPath)) {
  try { hiDict = JSON.parse(fs.readFileSync(dictPath, 'utf8')); } catch(e) {}
}

// Sort suffixes by length descending so longer phrases match first
const sortedSuffixes = Object.entries(hiDict.train_suffixes || {})
  .sort((a, b) => b[0].length - a[0].length);

const sortedStations = Object.entries(hiDict.stations || {})
  .sort((a, b) => b[0].length - a[0].length);

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
      resolve(text);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  isProcessing = false;
}

async function googleTranslate(text) {
  const cacheKey = `${text}_hi`;
  if (transCache[cacheKey]) return transCache[cacheKey];
  return new Promise(resolve => {
    queue.push({ text, resolve });
    processQueue();
  });
}

// ─── Dictionary-based translation ─────────────────────────────────────────

/**
 * Translate a station/place name using the static dictionary.
 * Falls back to Google if not found.
 */
async function translateStation(text) {
  if (!text || typeof text !== 'string') return text;
  // Exact match
  if (hiDict.stations[text]) return hiDict.stations[text];
  // Partial replacement: try replacing known station substrings
  let result = text;
  for (const [en, hi] of sortedStations) {
    if (result.includes(en)) result = result.split(en).join(hi);
  }
  if (result !== text) return result;
  // Fallback to Google Translate
  return googleTranslate(text);
}

/**
 * Translate a train name using dictionary-based word replacement.
 * Handles names like "Palitana Weekly SF Express" or "Kutch SF Express".
 */
function translateTrainNameDict(name) {
  if (!name) return name;
  let result = name;
  // Replace station name parts (longer matches first)
  for (const [en, hi] of sortedStations) {
    if (result.includes(en)) result = result.split(en).join(hi);
  }
  // Replace train suffix keywords (longer matches first)
  for (const [en, hi] of sortedSuffixes) {
    if (result.includes(en)) result = result.split(en).join(hi);
  }
  return result;
}

/**
 * Translate a train name: dictionary first, Google fallback.
 */
async function translateTrainName(name) {
  if (!name) return name;
  const dictResult = translateTrainNameDict(name);
  // If dictionary changed something useful, use it
  if (dictResult !== name) return dictResult;
  // Otherwise Google
  return googleTranslate(name);
}

/**
 * Detect if a `name` field is a train name (contains train keywords).
 */
function isTrainName(text) {
  if (!text) return false;
  const trainKeywords = ['Express', 'Mail', 'Rajdhani', 'Shatabdi', 'Duronto',
    'Garib Rath', 'Humsafar', 'Tejas', 'Vande Bharat', 'Amrit Bharat',
    'Intercity', 'Passenger', 'Special', 'Superfast', 'Jan Shatabdi'];
  return trainKeywords.some(k => text.includes(k));
}

// ─── Deep translate an API response object ─────────────────────────────────
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

      if (typeof val === 'string') {
        if (['stationName', 'boardingPoint', 'reservationUpto'].includes(key)) {
          result[key] = await translateStation(val);
        } else if (key === 'trainName') {
          result[key] = await translateTrainName(val);
        } else if (key === 'name') {
          // Could be train name or station name — detect and handle
          if (isTrainName(val)) {
            result[key] = await translateTrainName(val);
          } else {
            result[key] = await translateStation(val);
          }
        } else {
          result[key] = val;
        }
      } else if (['route', 'trains', 'history'].includes(key)) {
        result[key] = await deepTranslate(val, lang);
      } else if (['from', 'to', 'currentLocation', 'train'].includes(key) && typeof val === 'object' && val !== null) {
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
