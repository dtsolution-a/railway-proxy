const { translate } = require('@vitalets/google-translate-api');
const fs = require('fs');
const path = require('path');

const cachePath = path.join(__dirname, 'translation_cache.json');
let transCache = {};
if (fs.existsSync(cachePath)) {
  try {
    transCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch(e) {}
}

const queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;
  
  while (queue.length > 0) {
    const { text, lang, resolve } = queue.shift();
    const cacheKey = \\_\\;
    
    if (transCache[cacheKey]) {
      resolve(transCache[cacheKey]);
      continue;
    }
    
    try {
      const res = await translate(text, { to: lang });
      transCache[cacheKey] = res.text;
      fs.writeFileSync(cachePath, JSON.stringify(transCache));
      resolve(res.text);
    } catch (e) {
      resolve(text);
    }
    // Rate limit prevention
    await new Promise(r => setTimeout(r, 50));
  }
  isProcessing = false;
}

async function translateText(text, lang) {
  if (!text || lang !== 'hi') return text;
  
  const cacheKey = \\_\\;
  if (transCache[cacheKey]) return transCache[cacheKey];
  
  return new Promise(resolve => {
    queue.push({ text, lang, resolve });
    processQueue();
  });
}

async function deepTranslate(obj, lang) {
  if (lang !== 'hi') return obj;
  if (!obj) return obj;
  
  if (Array.isArray(obj)) {
    // Process sequentially instead of Promise.all to avoid huge parallel blasts
    const res = [];
    for(const item of obj) {
      res.push(await deepTranslate(item, lang));
    }
    return res;
  }
  
  if (typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      if (['name', 'stationName', 'trainName', 'status', 'boardingPoint', 'reservationUpto', 'from', 'to'].includes(key) && typeof obj[key] === 'string') {
        result[key] = await translateText(obj[key], lang);
      } else if (key === 'route' || key === 'trains' || key === 'history') {
        result[key] = await deepTranslate(obj[key], lang);
      } else if (key === 'currentLocation' && typeof obj[key] === 'object') {
        result[key] = await deepTranslate(obj[key], lang);
      } else if (typeof obj[key] === 'object' && obj[key] !== null && key !== 'coaches') {
        result[key] = await deepTranslate(obj[key], lang);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  }
  
  return obj;
}

module.exports = { deepTranslate };
