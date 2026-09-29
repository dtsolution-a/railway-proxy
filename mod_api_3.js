const fs = require('fs');
let code = fs.readFileSync('src/routes/api.js', 'utf-8');

code = code.replace(/async function safeCall\(res, fn\) \{([\s\S]*?)const result = await fn\(\);/, 'async function safeCall(res, fn, lang="en") { result = await fn();\n    result = await deepTranslate(result, lang);');

code = code.replace('return safeCall(res, () => trackTrain(trainNo, date));', 'return safeCall(res, () => trackTrain(trainNo, date), req.query.lang);');
code = code.replace('return safeCall(res, () => liveAtStation(code.toUpperCase(), hours));', 'return safeCall(res, () => liveAtStation(code.toUpperCase(), hours), req.query.lang);');

// Use global replacement for res.json(...)
code = code.replace(/return res\.json\(\{ success: true, cached, \.\.\.data \}\);/g, 'return res.json(await deepTranslate({ success: true, cached, ...data }, req.query.lang));');

fs.writeFileSync('src/routes/api.js', code);
