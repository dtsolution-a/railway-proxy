const test = require('node:test');
const assert = require('node:assert/strict');
const { localize, translateName, translateLabel } = require('../src/i18n');

const hi = (x) => localize(x, 'hi');

test('English and unknown languages are returned untouched', () => {
  const body = { data: { trainName: 'Kota Jn' } };
  assert.equal(localize(body, 'en'), body);
  assert.equal(localize(body, undefined), body);
  assert.deepEqual(localize(body, 'hi-IN'), { data: { trainName: 'कोटा जंक्शन' } });
});

test('station names resolve by code, not by spelling', () => {
  const out = hi({ route: [{ stationCode: 'NDLS', stationName: 'New Delhi' }, { stationCode: 'LKO', stationName: 'Lucknow' }] });
  assert.equal(out.route[0].stationName, 'नई दिल्ली');
  assert.equal(out.route[1].stationName, 'लखनऊ');
});

test('{code, name} objects, search cities and leg names are localised', () => {
  const out = hi({
    from: { code: 'MMCT', name: 'Mumbai Central', city: 'Mumbai' },
    legs: [{ fromStation: 'MMCT', fromStationName: 'Mumbai Central', toStation: 'NDLS', toStationName: 'New Delhi' }],
  });
  assert.equal(out.from.name, 'मुंबई सेंट्रल');
  assert.equal(out.from.city, 'मुंबई');
  assert.equal(out.legs[0].toStationName, 'नई दिल्ली');
});

test('train names are composed from station names and railway vocabulary', () => {
  assert.equal(translateName('Mumbai Central - New Delhi Tejas Rajdhani Express'), 'मुंबई सेंट्रल - नई दिल्ली तेजस राजधानी एक्सप्रेस');
  assert.equal(translateName('Palitana Weekly SF Express'), 'पालीताणा साप्ताहिक सुपरफास्ट एक्सप्रेस');
  assert.equal(translateName('Hisar Passenger'), 'हिसार पैसेंजर');
});

test('train type/category translate only inside the train object', () => {
  const out = hi({ train: { type: 'Rajdhani Express', category: 'Premium' }, berth: { type: 'LB', name: 'Lower Berth' } });
  assert.equal(out.train.type, 'राजधानी एक्सप्रेस');
  assert.equal(out.train.category, 'प्रीमियम');
  assert.equal(out.berth.type, 'LB'); // code, must stay machine-readable
  assert.equal(out.berth.name, 'लोअर बर्थ');
});

test('coach class names keep their class code', () => {
  assert.equal(translateLabel('AC 3-Tier (3A)'), 'एसी 3-टियर (3A)');
  assert.equal(translateLabel('Guard & Luggage Van (SLR)'), 'गार्ड एवं सामान यान (SLR)');
  assert.equal(translateLabel('Sleeper (SL)'), 'स्लीपर (SL)');
});

test('values the app branches on are never rewritten', () => {
  const src = {
    status: 'at-station', trackingMode: 'real-time', provenance: 'predicted',
    classType: '3A', category: '3a', coachPosition: 'ENG-B1', code: 'ENG',
    scheduledArrival: '2026-10-03T17:01:00+05:30', delayMinutes: 5, platform: '1',
    runDays: ['mon', 'tue'], currentLocation: { status: 'departed', stationCode: 'KOTA', stationName: 'Kota Jn' },
  };
  const out = hi(src);
  for (const k of ['status', 'trackingMode', 'provenance', 'classType', 'category', 'coachPosition', 'code', 'scheduledArrival', 'delayMinutes', 'platform', 'runDays']) {
    assert.deepEqual(out[k], src[k], k);
  }
  assert.equal(out.currentLocation.status, 'departed');
  assert.equal(out.currentLocation.stationName, 'कोटा जंक्शन');
});

test('the input object is not mutated (cached responses are shared)', () => {
  const src = { data: { trainName: 'Kota Jn', route: [{ stationCode: 'NDLS', stationName: 'New Delhi' }] } };
  const copy = JSON.parse(JSON.stringify(src));
  hi(src);
  assert.deepEqual(src, copy);
});

test('error messages are localised', () => {
  assert.match(hi({ success: false, message: 'Invalid PNR. Must be exactly 10 digits.' }).message, /अमान्य PNR/);
  assert.equal(hi({ success: false, message: 'Something unexpected' }).message, 'Something unexpected');
});

test('unknown place names fall back to transliteration instead of staying English', () => {
  assert.doesNotMatch(translateName('Zzyzxville Jn'), /[A-Za-z]/);
});

test('quota text', () => {
  assert.equal(hi({ quota: 'GN' }).quota, 'सामान्य (GN)');
  assert.equal(hi({ quota: 'TATKAL' }).quota, 'तत्काल');
});
