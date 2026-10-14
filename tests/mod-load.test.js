'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Claude Code refuses to load a module where $ is passed to a function
// imported from another file; the whole mod (band, Pane, auto-compact) is gone.
test('no hooks/*.ts passes $ to a function it imports', () => {
    const dir = path.join(__dirname, '..', 'hooks');
    const bad = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        const names = new Set();
        for (const m of src.matchAll(/import\s+(?!type\b)([^;]*?)\s+from\s+['"][^'"]+['"]/g)) {
            for (const n of m[1].replace(/[{}*]/g, ' ').split(/[,\s]+/)) if (/^[A-Za-z_]\w*$/.test(n) && n !== 'as') names.add(n);
        }
        for (const n of names) {
            // $ as any bare argument, also through a namespace import: ns.fn(a, $); not a template's ${
            if (new RegExp(String.raw`(?<![\w.])${n}(?:\.\w+)*\([^()]*(?<![\w.$])\$(?![\w.$]|\{)`).test(src)) bad.push(`${f}: ${n}(… $`);
        }
    }
    assert.deepEqual(bad, []);
});
