const fs = require('fs');
let code = fs.readFileSync('src/routes/api.js', 'utf-8');

if (!code.includes("const { deepTranslate } = require('../utils/translator');")) {
    code = "const { deepTranslate } = require('../utils/translator');\n" + code;
    
    // Replace safeCall definition in api.js if it exists? 
    // Wait, safeCall is probably defined at the top of api.js.
    // Let's check how safeCall is defined.
}
fs.writeFileSync('src/routes/api.js', code);
console.log('Modified imports');
