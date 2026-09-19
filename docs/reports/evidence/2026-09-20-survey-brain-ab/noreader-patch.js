// ab2: turn the brain's fan-out off in a copy of the plugin tree — the one variable
// the control arm changes. Every edit has to match exactly once, or nothing is written.
// usage: node noreader-patch.js <copy root>
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
const EDITS = [
    ['agents/fankeel-brain.md',
        'tools: [Read, Grep, Glob, Bash, Write, Agent]',
        'tools: [Read, Grep, Glob, Bash, Write]'],
    ['agents/fankeel-brain.md',
        '`Agent` is for `fankeel:fankeel-reader`, at most four in one response: the\nraw reading happens in their contexts, and what reaches yours is what they\nreturn. Open every `path:line` a reader cites before you keep it.',
        'You have no `Agent`: do the reading yourself.'],
    ['lib/render.js',
        '\'  - You cannot run Workflow. Dispatch `fankeel:fankeel-reader` with the Agent tool, at most four in one response, and open every path:line one cites before you keep it: this replaces "one workflow" below.\'',
        '\'  - You cannot run Workflow or dispatch agents. Do the reading yourself: this replaces "one workflow" below.\''],
];

const texts = {};
for (const [file, from] of EDITS) {
    const text = texts[file] || (texts[file] = fs.readFileSync(path.join(root, file), 'utf8'));
    const n = text.split(from).length - 1;
    if (n !== 1) { console.error(file + ': expected 1 match, found ' + n + ' for: ' + from.slice(0, 60)); process.exit(1); }
}
for (const [file, from, to] of EDITS) texts[file] = texts[file].split(from).join(to);
for (const [file, text] of Object.entries(texts)) fs.writeFileSync(path.join(root, file), text);
console.log('patched: ' + EDITS.length + ' edits in ' + Object.keys(texts).join(', '));
