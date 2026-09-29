const fs = require('fs');
let code = fs.readFileSync('src/routes/api.js', 'utf-8');

code = code.replace(
  sync function safeCall(res, fn) {
  try {
    const result = await fn();,
  sync function safeCall(res, fn, lang = 'en') {
  try {
    let result = await fn();
    result = await deepTranslate(result, lang);
);

code = code.replace(
  eturn safeCall(res, () => trackTrain(trainNo, date));,
  eturn safeCall(res, () => trackTrain(trainNo, date), req.query.lang);
);
code = code.replace(
  eturn safeCall(res, () => liveAtStation(code.toUpperCase(), hours));,
  eturn safeCall(res, () => liveAtStation(code.toUpperCase(), hours), req.query.lang);
);

// We need to also hook into the cached responses
code = code.replace(
  eturn res.json({ success: true, cached, ...data });,
  eturn res.json(await deepTranslate({ success: true, cached, ...data }, req.query.lang));
); // Note: this replaces globally, so we'll do all of them

fs.writeFileSync('src/routes/api.js', code);
