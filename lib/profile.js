'use strict';

// One profile per project, committed beside docs.json, and one per machine
// under the config dir. Values merge per key — a project that sets only
// `land.push` still gets the machine's `guard`. Built-in defaults are the
// third layer, and `sources` says which layer each value came from.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PROJECT_FILE = ['.fankeel', 'profile.json'];
const MACHINE_FILE = ['fankeel', 'profile.json'];

// Every key, its allowed values, and the built-in default (null: ask).
const KEYS = {
    'land.integration': { values: ['merge', 'pr', 'keep'], builtin: null },
    'land.push': { values: ['true', 'false'], builtin: null },
    'land.archivePlan': { values: ['true', 'false'], builtin: null },
    guard: { values: ['ask', 'deny', 'off'], builtin: 'ask' },
    'dispatch.floor': { values: ['sonnet', 'opus', 'fable'], builtin: 'sonnet' },
    'judge.model': { values: ['sonnet', 'opus', 'fable'], builtin: 'fable' },
};

function projectFile(projectRoot) {
    return path.join(projectRoot, ...PROJECT_FILE);
}
function machineFile(configDir) {
    return configDir ? path.join(configDir, ...MACHINE_FILE) : null;
}
// The same answer `scripts/task.js claudeDir()` gives without an --claude-dir:
// the variable first, then the home directory. Kept here so hooks can use it
// without reaching into scripts/.
function configDirOf(env) {
    const e = env || process.env;
    if (e.CLAUDE_CONFIG_DIR) return e.CLAUDE_CONFIG_DIR;
    const home = e.HOME || e.USERPROFILE;
    return home ? path.join(home, '.claude') : null;
}

// Parse-or-null, like registry.readFile: a missing file is silence, a file
// that does not parse is reported so the injected line can say so once.
function readOne(file) {
    if (!file) return { values: null, unreadable: false };
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return { values: null, unreadable: false }; }
    try {
        const parsed = JSON.parse(raw.replace(/^﻿/, ''));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { values: null, unreadable: true };
        return { values: parsed, unreadable: false };
    } catch (e) {
        return { values: null, unreadable: true };
    }
}

function parseValue(key, raw) {
    const spec = KEYS[key];
    if (!spec) return { error: 'unknown key: ' + key + '. Keys: ' + Object.keys(KEYS).join(', ') };
    const s = String(raw).trim().toLowerCase();
    if (!spec.values.includes(s)) return { error: key + ' is one of: ' + spec.values.join(', ') };
    return { value: s === 'true' ? true : s === 'false' ? false : s };
}

function read(projectRoot, configDir) {
    const pFile = projectRoot ? projectFile(projectRoot) : null;
    const mFile = machineFile(configDir);
    const project = readOne(pFile);
    const machine = readOne(mFile);
    const values = {};
    const sources = {};
    const unreadable = [];
    if (project.unreadable) unreadable.push(pFile);
    if (machine.unreadable) unreadable.push(mFile);
    const pick = (obj, key) => (obj && Object.prototype.hasOwnProperty.call(obj, key) ? parseValue(key, obj[key]) : null);
    for (const key of Object.keys(KEYS)) {
        const p = pick(project.values, key);
        const m = pick(machine.values, key);
        // A value the table refuses is read as absent: the file is somebody's
        // hand edit, and less guidance beats a refused hook.
        if (p && !p.error) { values[key] = p.value; sources[key] = 'project'; continue; }
        if (m && !m.error) { values[key] = m.value; sources[key] = 'machine'; continue; }
        if (KEYS[key].builtin !== null) { values[key] = parseValue(key, KEYS[key].builtin).value; sources[key] = 'builtin'; }
    }
    return { values, sources, unreadable };
}

function write(file, key, raw) {
    const parsed = parseValue(key, raw);
    if (parsed.error) return { ok: false, reason: parsed.error };
    const current = readOne(file);
    if (current.unreadable) return { ok: false, reason: file + ' does not parse; fix it by hand first' };
    const next = Object.assign({}, current.values || {}, { [key]: parsed.value });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    return { ok: true, file, key, value: parsed.value };
}

function git(cwd, args) {
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
        return null;
    }
}

// What the history already answers. Only land's two questions have evidence
// on disk — the registry never held `guard` and class is per task.
function suggest(projectRoot) {
    const values = {};
    const evidence = [];
    const merges = git(projectRoot, ['log', '--merges', '--format=%s']);
    if (merges === null) return { values, evidence: ['not a git repository, or git is not on PATH'] };
    const subjects = merges.split('\n').filter(Boolean);
    const pr = subjects.filter((s) => /^Merge pull request/i.test(s)).length;
    const local = subjects.length - pr;
    evidence.push('merges: ' + local + ' local, ' + pr + ' pull request');
    if (subjects.length >= 3) values['land.integration'] = pr > local ? 'pr' : 'merge';
    const remotes = (git(projectRoot, ['remote']) || '').split('\n').filter(Boolean);
    const unpushed = (git(projectRoot, ['log', '--oneline', '--branches', '--not', '--remotes']) || '').split('\n').filter(Boolean).length;
    evidence.push(remotes.length ? 'remotes: ' + remotes.join(', ') + '; ' + unpushed + ' commits on no remote' : 'no remote');
    if (!remotes.length || unpushed >= 3) values['land.push'] = false;
    else if (remotes.length && unpushed === 0) values['land.push'] = true;
    return { values, evidence };
}

// The two strings the injected block carries. `landClause` is what fills
// {{PROFILE_LAND}} and is never empty: `substitute` skips a falsy value and
// would ship the raw token.
function landClause(values) {
    const parts = [];
    if (values && values['land.integration']) parts.push(values['land.integration']);
    if (values && values['land.push'] === true) parts.push('push');
    if (values && values['land.push'] === false) parts.push('no push');
    if (!parts.length) return 'no land answer in the profile: open the menu';
    return 'profile: land ' + parts.join(', ') + ' — do that, say so, skip the menu';
}

// Only the keys somebody set. Built-in defaults are not news, and a line that
// listed them would be the same on every project.
function summary(values, sources) {
    const out = [];
    const land = landParts(values);
    if (land) out.push('land ' + land + tag(sources, 'land.integration', 'land.push'));
    if (values['land.archivePlan'] !== undefined) out.push('archive plan ' + values['land.archivePlan'] + tag(sources, 'land.archivePlan'));
    for (const key of ['guard', 'dispatch.floor', 'judge.model']) {
        if (sources[key] && sources[key] !== 'builtin') out.push(key + ' ' + values[key] + tag(sources, key));
    }
    return out.join(' · ');
}
function landParts(values) {
    const parts = [];
    if (values['land.integration']) parts.push(values['land.integration']);
    if (values['land.push'] === true) parts.push('push');
    if (values['land.push'] === false) parts.push('no push');
    return parts.join(', ');
}
function tag(sources, ...keys) {
    return keys.some((k) => sources[k] === 'machine') && !keys.some((k) => sources[k] === 'project') ? ' (machine)' : '';
}

module.exports = { KEYS, projectFile, machineFile, configDirOf, read, write, suggest, landClause, summary };
