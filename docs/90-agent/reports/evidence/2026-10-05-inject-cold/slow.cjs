'use strict';
// Preloaded with `node --require`: every synchronous fs call this process makes
// through these functions waits SLOW_FS_MS first, and the count of them is
// appended to SLOW_FS_COUNT_LOG at exit. A stand-in for a slow disk or an
// antivirus scan, not a measurement of one; with SLOW_FS_MS 0 it only counts.
// Module loading reads files through node's internals, not these, so require
// costs are not slowed.
const fs = require('node:fs');

const ms = Number(process.env.SLOW_FS_MS || 0);
const LOG = process.env.SLOW_FS_COUNT_LOG;
const cell = new Int32Array(new SharedArrayBuffer(4));
let calls = 0;

for (const k of ['readFileSync', 'writeFileSync', 'statSync', 'lstatSync', 'readdirSync', 'existsSync', 'mkdirSync', 'openSync', 'readSync', 'closeSync']) {
    const fn = fs[k];
    if (typeof fn !== 'function') continue;
    fs[k] = function () {
        calls++;
        if (ms > 0) Atomics.wait(cell, 0, 0, ms);
        return fn.apply(this, arguments);
    };
}

const append = fs.appendFileSync;
process.on('exit', () => {
    if (LOG) append(LOG, calls + '\n');
});
