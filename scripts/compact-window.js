#!/usr/bin/env node
'use strict';

// Whether this machine has an auto-compact window, and the one write that
// gives it one:
//
//   node scripts/compact-window.js show
//   node scripts/compact-window.js set <n>
//   node scripts/compact-window.js decline
//
// `show` prints `set <n>`, `declined` or `unset`. `set` writes the variable
// under "env" in <configDir>/settings.json and leaves every other key as it
// was; `decline` leaves a marker so fankeel-init does not ask again.
// docs/90-agent/plans/2026-10-12-init-compact-window-design.md §1 and §2.
// The name and the positive-number rule are lib/context.js's, typed again
// here the way tests/render.test.js does: that module exports neither.

const fs = require('node:fs');
const path = require('node:path');

const profile = require('../lib/profile.js');

const WINDOW = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';

function windowOf(env) {
    const n = Number(env && env[WINDOW]);
    return Number.isFinite(n) && n > 0 ? n : null;
}

// A missing file is an empty one; a file that is there and does not hold a
// JSON object is `unreadable`, and nothing is written over it.
function readSettings(file) {
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return e.code === 'ENOENT' ? { values: {} } : { unreadable: true }; }
    try {
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { unreadable: true };
        return { values: parsed };
    } catch (e) {
        return { unreadable: true };
    }
}

const settingsFile = (configDir) => path.join(configDir, 'settings.json');
const declinedFile = (configDir) => path.join(path.dirname(profile.machineFile(configDir)), 'compact-window.declined');

function show(configDir, env) {
    const n = windowOf(env) || windowOf((readSettings(settingsFile(configDir)).values || {}).env);
    if (n) return 'set ' + n;
    return fs.existsSync(declinedFile(configDir)) ? 'declined' : 'unset';
}

// The read-then-write window against another writer is not closed and the
// file is re-serialised with two-space JSON; the .fankeel-bak copy covers both.
function set(configDir, raw) {
    const file = settingsFile(configDir);
    if (!/^[1-9]\d*$/.test(raw)) return { ok: false, reason: 'set <n>: a positive whole number of tokens, such as 450000' };
    const fix = '; fix it by hand first';
    const link = fs.lstatSync(file, { throwIfNoEntry: false });
    if (link && link.isSymbolicLink() && !fs.existsSync(file)) return { ok: false, reason: file + ' is a link to nothing' + fix };
    const current = readSettings(file);
    if (current.unreadable) return { ok: false, reason: file + ' does not parse' + fix };
    const env = current.values.env;
    if (env !== undefined && (!env || typeof env !== 'object' || Array.isArray(env))) return { ok: false, reason: file + ' has an "env" that is not an object' + fix };
    const next = Object.assign({}, current.values, { env: Object.assign({}, env, { [WINDOW]: raw }) });
    fs.mkdirSync(configDir, { recursive: true });
    const existed = fs.existsSync(file);
    const target = existed ? fs.realpathSync(file) : file;
    let backup;
    if (existed) {
        backup = target + '.fankeel-bak';
        fs.copyFileSync(target, backup);
    }
    const tmp = target + '.fankeel-tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
    fs.renameSync(tmp, target);
    return { ok: true, file, backup };
}

function decline(configDir) {
    const file = declinedFile(configDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, new Date().toISOString() + '\n');
    return file;
}

function main(argv, env) {
    const configDir = profile.configDirOf(env);
    if (!configDir) return { text: 'compact-window.js: no config directory to read', code: 1 };
    const [verb, n] = argv;
    if (verb === 'show' && argv.length === 1) return { text: show(configDir, env), code: 0 };
    if (verb === 'decline' && argv.length === 1) return { text: 'declined  → ' + decline(configDir), code: 0 };
    if (verb === 'set' && argv.length === 2) {
        const out = set(configDir, n);
        if (!out.ok) return { text: 'compact-window.js: ' + out.reason, code: 1 };
        return { text: ['set ' + n + '  → ' + out.file].concat(out.backup ? ['backup  → ' + out.backup] : [], 'Restart Claude Code for it to take effect.').join('\n'), code: 0 };
    }
    return { text: 'usage: compact-window.js show | set <n> | decline', code: 2 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2), process.env);
    process.stdout.write(text + '\n');
    process.exitCode = code;
}
