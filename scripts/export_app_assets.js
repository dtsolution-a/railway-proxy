#!/usr/bin/env node
// Exports Hindi names for the app's bundled station/train lists so its offline
// autocomplete can show (and search) Hindi without any network call.
//
//   node scripts/export_app_assets.js <app>/assets/data
//
// Reads stations.json / trains.json from that folder and writes
// stations_hi.json ({ CODE: "हिंदी" }) and trains_hi.json ({ "12951": "हिंदी" }).
const fs = require('fs');
const path = require('path');
const { translateName, STATIONS } = require('../src/i18n');

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/export_app_assets.js <assets/data dir>');
  process.exit(1);
}
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const write = (f, o) => fs.writeFileSync(path.join(dir, f), JSON.stringify(o));

const stations = {};
for (const s of read('stations.json')) {
  stations[s.code] = STATIONS[s.code] || translateName(s.name);
}
const trains = {};
for (const t of read('trains.json')) {
  trains[t.number] = translateName(t.name);
}
write('stations_hi.json', stations);
write('trains_hi.json', trains);
console.log(`stations_hi: ${Object.keys(stations).length}, trains_hi: ${Object.keys(trains).length}`);
