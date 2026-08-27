'use strict';

// Which other plugins are installed, so a stage rule can say "use theirs" when
// theirs is there and "here is ours" when it is not.
//
// The alternative was to depend on them and degrade badly, or to reimplement
// what they do and be worse at it. Reading the manifest costs one file and makes
// the rule honest in both directions: a user with ponytail gets ponytail, a user
// without gets told plainly that the code half of the audit is not running
// rather than being left to wonder.
//
// It never fails. A missing or unreadable manifest means "nothing detected",
// which produces the same advice as "nothing installed" — the fallback — and
// that is the safe direction to be wrong in.

const fs = require('node:fs');
const path = require('node:path');

function manifestPath(env) {
    const e = env || process.env;
    if (e.CLAUDE_CONFIG_DIR) return path.join(e.CLAUDE_CONFIG_DIR, 'plugins', 'installed_plugins.json');
    const home = e.HOME || e.USERPROFILE;
    return home ? path.join(home, '.claude', 'plugins', 'installed_plugins.json') : null;
}

// Names come back without the marketplace suffix, because that is how a user
// refers to them and how a skill is invoked. Two marketplaces shipping the same
// plugin name collapse to one entry, which is the right answer to "is it
// available".
function installed(env) {
    const file = manifestPath(env);
    if (!file) return new Set();
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return new Set();
    }
    let data;
    try {
        data = JSON.parse(raw.replace(/^﻿/, ''));
    } catch (e) {
        return new Set();
    }
    const plugins = data && data.plugins;
    if (!plugins || typeof plugins !== 'object') return new Set();

    const out = new Set();
    for (const key of Object.keys(plugins)) {
        const entries = plugins[key];
        if (!Array.isArray(entries) || !entries.length) continue;
        const name = String(key).split('@')[0].trim().toLowerCase();
        if (name) out.add(name);
    }
    return out;
}

const has = (name, env) => installed(env).has(String(name || '').trim().toLowerCase());

// What the `audit` stage can call on. Kept to plugins whose scope genuinely
// overlaps a stage of this pipeline — a list of everything installed would be a
// list nobody could act on, and fankeel is not a plugin directory.
const KNOWN = [
    { name: 'ponytail', gives: 'over-engineering audit', how: '/ponytail-audit for the whole repository, /ponytail-review for a diff' },
    { name: 'graphify', gives: 'code and document knowledge graph', how: '/graphify, then query the graph instead of grepping' },
    { name: 'codegraph', gives: 'pre-indexed code graph', how: 'query the index instead of grepping' },
];

function available(env) {
    const set = installed(env);
    return KNOWN.filter((k) => set.has(k.name));
}

module.exports = { installed, has, available };
