const fs = require('fs');
const path = require('path');

let hiDict = { stations: {}, train_suffixes: {} };
const dictPath = path.join('src/utils', 'hi_dictionary.json');
hiDict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));

const sortedSuffixes = Object.entries(hiDict.train_suffixes || {}).sort((a,b) => b[0].length - a[0].length);
const sortedStations = Object.entries(hiDict.stations || {}).sort((a,b) => b[0].length - a[0].length);

function translateTrainNameDict(name) {
  if (!name) return name;
  let result = name;
  for (const [en, hi] of sortedStations) {
    if (result.includes(en)) result = result.split(en).join(hi);
  }
  for (const [en, hi] of sortedSuffixes) {
    if (result.includes(en)) result = result.split(en).join(hi);
  }
  return result;
}

function translateStation(text) {
  if (!text) return text;
  if (hiDict.stations[text]) return hiDict.stations[text];
  let result = text;
  for (const [en, hi] of sortedStations) {
    if (result.includes(en)) result = result.split(en).join(hi);
  }
  return result;
}

const trainNames = [
  'Palitana Weekly SF Express',
  'Surat - Mahuva Express',
  'Kutch SF Express',
  'Sayaji Nagari Superfast Express',
  'Hisar SF Express',
  'Bhagat Ki Kothi SF Express',
  'Mumbai Central Rajdhani Express',
  'Ahmedabad Shatabdi Express',
  'Vande Bharat Express'
];

const stationNames = ['Surat', 'Ahmedabad Jn', 'Vapi', 'Vadodara Jn', 'Bandra Terminus', 'Borivali', 'Mahuva'];

console.log('=== TRAIN NAMES ===');
trainNames.forEach(n => console.log(n, '->', translateTrainNameDict(n)));

console.log('\n=== STATION NAMES ===');
stationNames.forEach(n => console.log(n, '->', translateStation(n)));
