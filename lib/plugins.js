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

// There was a third export here, `available`, filtering a catalogue of three
// plugins down to the installed ones — each with a sentence on what it gives and
// how to call it. Nothing ever printed it. The injected block is the only place
// it could have gone and it has about two hundred characters of headroom, which
// is less than one of those entries. What the block can carry is a clause, and a
// clause needs `has`. The skills carry the rest in prose, where a paragraph costs
// nothing per turn.
module.exports = { installed, has };
