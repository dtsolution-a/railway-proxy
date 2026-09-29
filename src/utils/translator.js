const { translate } = require('@vitalets/google-translate-api');

async function translateText(text, lang) {
  if (!text || lang !== 'hi') return text;
  try {
    const res = await translate(text, { to: 'hi' });
    return res.text;
  } catch (e) {
    return text;
  }
}

async function deepTranslate(obj, lang) {
  if (lang !== 'hi') return obj;
  if (!obj) return obj;
  
  if (Array.isArray(obj)) {
    return Promise.all(obj.map(item => deepTranslate(item, lang)));
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
