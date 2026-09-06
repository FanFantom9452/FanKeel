'use strict';

// The suite leaked a temporary directory per fixture from the day it was
// written until 2026-09-07, by which point 957,746 of them stood under %TEMP%
// on one machine. `tests/tmp.js` stops new ones; this removes the old.
//
// The prefix is a constant rather than an argument on purpose: a cleaner that
// can be pointed at an arbitrary name is a cleaner that can be pointed at the
// wrong one, and this one runs against the user's temp directory.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PREFIX = 'fankeel-';

function clean(dir) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return { scanned: 0, removed: 0, failed: 0 };
    }
    let removed = 0;
    let failed = 0;
    let scanned = 0;
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!entry.name.startsWith(PREFIX)) continue;
        scanned++;
        try {
            fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
            removed++;
        } catch (e) {
            // A directory a running test still holds. Counted, not fatal.
            failed++;
        }
    }
    return { scanned, removed, failed };
}

function main(dir) {
    dir = dir || os.tmpdir();
    const started = Date.now();
    const { scanned, removed, failed } = clean(dir);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    return `tmp-clean — ${removed} removed, ${failed} left, ${scanned} matched ${PREFIX}* in ${dir} (${secs}s)`;
}

if (require.main === module) {
    process.stdout.write(main() + '\n');
}

module.exports = { clean, main, PREFIX };
