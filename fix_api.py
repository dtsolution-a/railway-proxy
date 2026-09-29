import codecs

with codecs.open('src/routes/api.js', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace('async function safeCall(res, fn, lang="en") { result = await fn();', 'async function safeCall(res, fn, lang="en") {\n  try {\n    let result = await fn();')

with codecs.open('src/routes/api.js', 'w', 'utf-8') as f:
    f.write(content)
