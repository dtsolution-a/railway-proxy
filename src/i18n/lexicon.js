// Curated Hindi vocabulary for the closed sets of display strings that the
// Rail Radar API returns (coach classes, berths, quotas, error messages).
// Open-ended text (station and train names) is handled by the dictionaries
// plus transliteration in index.js.

// Applied in order, case-insensitive, on word boundaries. Longest / most
// specific first so "AC 2-Tier Extra" wins over "AC 2-Tier".
const LABEL_PHRASES = [
  ['AC First Class', 'एसी प्रथम श्रेणी'],
  ['First Class AC', 'एसी प्रथम श्रेणी'],
  ['First Class', 'प्रथम श्रेणी'],
  ['AC 2[- ]Tier Extra', 'एसी 2-टियर (अतिरिक्त)'],
  ['AC 2[- ]Tier', 'एसी 2-टियर'],
  ['AC 3[- ]Tier Economy', 'एसी 3-टियर इकोनॉमी'],
  ['AC 3[- ]Economy', 'एसी 3 इकोनॉमी'],
  ['AC 3[- ]Tier', 'एसी 3-टियर'],
  ['Executive Chair Car', 'एक्ज़ीक्यूटिव चेयर कार'],
  ['Executive Anubhuti', 'एक्ज़ीक्यूटिव अनुभूति'],
  ['AC Chair Car', 'एसी चेयर कार'],
  ['Chair Car', 'चेयर कार'],
  ['Anubhuti', 'अनुभूति'],
  ['Vistadome', 'विस्टाडोम'],
  ['Second Sitting', 'सेकंड सिटिंग'],
  ['Second Class', 'द्वितीय श्रेणी'],
  ['Sleeper Class', 'स्लीपर श्रेणी'],
  ['Sleeper', 'स्लीपर'],
  ['Unreserved', 'अनारक्षित'],
  ['General', 'सामान्य'],
  ['Locomotive Engine', 'रेल इंजन'],
  ['Locomotive', 'रेल इंजन'],
  ['Engine', 'इंजन'],
  ['Power Generator Car', 'पावर जनरेटर कार'],
  ['Power Car', 'पावर कार'],
  ['Pantry ?/ ?Buffet Car', 'पैंट्री / बफे कार'],
  ['Pantry Car', 'पैंट्री कार'],
  ['Buffet Car', 'बफे कार'],
  ['Dining Car', 'डाइनिंग कार'],
  ['Guard ?(?:&|and) ?Luggage Van', 'गार्ड एवं सामान यान'],
  ['Luggage Van', 'सामान यान'],
  ['Parcel Van', 'पार्सल यान'],
  ['Brake Van', 'ब्रेक यान'],
  ['Side Lower Berth', 'साइड लोअर बर्थ'],
  ['Side Middle Berth', 'साइड मिडिल बर्थ'],
  ['Side Upper Berth', 'साइड अपर बर्थ'],
  ['Lower Berth', 'लोअर बर्थ'],
  ['Middle Berth', 'मिडिल बर्थ'],
  ['Upper Berth', 'अपर बर्थ'],
  ['Window Seat', 'खिड़की वाली सीट'],
  ['Aisle Seat', 'गलियारे की सीट'],
  ['Middle Seat', 'बीच की सीट'],
  ['Seat', 'सीट'],
  ['Berth', 'बर्थ'],
  ['Coach', 'कोच'],
  ['Tier', 'टियर'],
].map(([p, hi]) => [new RegExp(`(?<![A-Za-z])${p}(?![A-Za-z])`, 'gi'), hi]);

// Reservation quotas: both the 2-letter code and the spelled-out name occur.
const QUOTAS = {
  gn: 'सामान्य', general: 'सामान्य',
  tq: 'तत्काल', tatkal: 'तत्काल',
  pt: 'प्रीमियम तत्काल', 'premium tatkal': 'प्रीमियम तत्काल',
  ld: 'महिला', ladies: 'महिला',
  ss: 'वरिष्ठ नागरिक', 'senior citizen': 'वरिष्ठ नागरिक',
  hp: 'दिव्यांग', 'physically handicapped': 'दिव्यांग',
  df: 'रक्षा', defence: 'रक्षा',
  dp: 'ड्यूटी पास', 'duty pass': 'ड्यूटी पास',
  ph: 'संसद सदस्य', 'parliament house': 'संसद सदस्य',
  yu: 'युवा', yuva: 'युवा',
  ft: 'विदेशी पर्यटक', 'foreign tourist': 'विदेशी पर्यटक',
  lb: 'लोअर बर्थ', 'lower berth': 'लोअर बर्थ',
  ck: 'तत्काल', 'current booking': 'चालू बुकिंग',
  rs: 'ग्रामीण', 'rural': 'ग्रामीण',
};

// Rail Radar / proxy error messages -> Hindi. First match wins.
const MESSAGES = [
  [/invalid pnr/i, 'अमान्य PNR। PNR ठीक 10 अंकों का होना चाहिए।'],
  [/pnr.*(flushed|expired)/i, 'यात्रा पूरी होने के बाद यह PNR रिकॉर्ड हटा दिया गया है।'],
  [/pnr.*not found|no .*pnr/i, 'यह PNR नहीं मिला। कृपया नंबर जाँचें।'],
  [/invalid train number/i, 'अमान्य ट्रेन नंबर। ट्रेन नंबर ठीक 5 अंकों का होना चाहिए।'],
  [/train.*not found|no such train/i, 'यह ट्रेन नहीं मिली। कृपया ट्रेन नंबर जाँचें।'],
  [/(live|running|tracking).*(not available|unavailable|no data)|no live data/i, 'इस ट्रेन का लाइव डेटा अभी उपलब्ध नहीं है।'],
  [/station.*not found|invalid station/i, 'स्टेशन नहीं मिला। कृपया स्टेशन कोड जाँचें।'],
  [/'from' and 'to' are required/i, 'कृपया दोनों स्टेशन चुनें।'],
  [/'hours' must be/i, 'घंटे 2, 4 या 8 में से कोई एक होना चाहिए।'],
  [/availability feature is discontinued/i, 'सीट उपलब्धता की सुविधा अब उपलब्ध नहीं है।'],
  [/fare feature is discontinued/i, 'किराया जानकारी की सुविधा अब उपलब्ध नहीं है।'],
  [/route not found/i, 'अनुरोधित पेज नहीं मिला।'],
  [/rate.?limit|too many requests/i, 'बहुत अधिक अनुरोध। कृपया कुछ देर बाद प्रयास करें।'],
  [/timeout|timed out/i, 'अनुरोध में बहुत समय लग गया। कृपया पुनः प्रयास करें।'],
  [/rail ?radar api error|railkit api returned failure/i, 'रेल डेटा सेवा में समस्या है। कृपया बाद में प्रयास करें।'],
  [/internal server error/i, 'सर्वर में समस्या हुई। कृपया पुनः प्रयास करें।'],
];

module.exports = { LABEL_PHRASES, QUOTAS, MESSAGES };
