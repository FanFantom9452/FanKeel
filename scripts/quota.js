#!/usr/bin/env node
'use strict';

// spend-1: calibrate the profile's `quota.week` from TokenBar's readings.
//
//   node scripts/quota.js [--claude-dir <dir>] [--log <file>] [--dry-run]
//
// Reads `<claude dir>/tokenbar-usage.jsonl` — TokenBar's statusline writes
// one line per render, `rate_limits.seven_day` included — prices what every
// transcript spent between the two readings `lib/quota.js` picks, and writes
// `quota.week` and `quota.calibrated` into the machine profile. Exit 0 when
// written or, with --dry-run, printed; 1 when nothing can be calibrated and
// nothing was written; 2 on a usage error.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const profile = require('../lib/profile.js');
const { calibrate } = require('../lib/quota.js');

const USAGE = 'usage: quota.js [--claude-dir <dir>] [--log <file>] [--dry-run]';

function main(argv) {
    let values;
    try {
        ({ values } = parseArgs({ args: argv, options: { 'claude-dir': { type: 'string' }, log: { type: 'string' }, 'dry-run': { type: 'boolean' } } }));
    } catch (e) {
        return { text: 'quota.js: ' + e.message + '\n' + USAGE, code: 2 };
    }
    const dir = values['claude-dir'] || profile.configDirOf();
    if (!dir) return { text: 'quota.js: no Claude config directory; pass --claude-dir\n' + USAGE, code: 2 };
    const log = values.log || path.join(dir, 'tokenbar-usage.jsonl');
    let text;
    try {
        text = fs.readFileSync(log, 'utf8');
    } catch (e) {
        return { text: 'quota.js: cannot read ' + log + ' (TokenBar writes it); quota.week stays as it was', code: 1 };
    }
    const r = calibrate(dir, text);
    if (r.error) return { text: 'quota.js: ' + r.error + '; quota.week stays as it was', code: 1 };
    const line = 'quota.week ' + r.week + ' (calibrated ' + r.day + ': $' + r.usd.toFixed(2) + ' over ' + r.points + ' points'
        + (r.unpriced.length ? '; unpriced: ' + r.unpriced.join(', ') : '') + ')';
    const warn = r.skipped ? '\nquota.js: warning: ' + r.skipped + ' transcript file(s) or directories could not be read; their spend is missing, so quota.week is too low' : '';
    if (values['dry-run']) return { text: line + warn, code: 0 };
    const file = profile.machineFile(dir);
    const pairs = [['quota.week', r.week], ['quota.calibrated', r.day]];
    for (const [key, value] of pairs) {
        const p = profile.parseValue(key, value);
        if (p.error) return { text: 'quota.js: ' + p.error, code: 1 };
    }
    // The pair is all-or-nothing: a second write that fails must not leave
    // a file holding only quota.week.
    let prior = null;
    try {
        prior = fs.readFileSync(file, 'utf8');
    } catch (e) {
        if (e.code !== 'ENOENT') return { text: 'quota.js: cannot read ' + file + ': ' + e.message, code: 1 };
    }
    for (const [key, value] of pairs) {
        const w = profile.write(file, key, value);
        if (!w.ok) {
            try {
                if (prior === null) fs.rmSync(file, { force: true });
                else fs.writeFileSync(file, prior);
            } catch (e) {
                return { text: 'quota.js: ' + w.reason + '; could not restore ' + file + ': ' + e.message, code: 1 };
            }
            return { text: 'quota.js: ' + w.reason, code: 1 };
        }
    }
    return { text: line + warn + '\nwrote ' + file, code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main };
