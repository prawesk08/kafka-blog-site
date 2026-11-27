const { parseHTML } = require('linkedom');
const fs = require('fs');
const SIG = require('./sig.cjs');
const { document } = parseHTML(fs.readFileSync(process.argv[2], 'utf8'));
process.stdout.write(SIG(document));
