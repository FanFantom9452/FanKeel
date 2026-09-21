'use strict';

// One profile per project, committed beside docs.json, and one per machine
// under the config dir. Values merge per key — a project that sets only
// `land.push` still gets the machine's `guard`. Built-in defaults are the
// third layer, and `sources` says which layer each value came from.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registryLib = require('./registry.js');

const PROJECT_FILE = ['.fankeel', 'profile.json'];
const MACHINE_FILE = ['fankeel', 'profile.json'];

// Every key, its allowed values, and the built-in default (null: ask).
const KEYS = {
    'land.integration': { values: ['merge', 'pr', 'keep'], builtin: null, desc: '收尾時怎麼整合：merge、pr 或 keep' },
    'land.push': { values: ['true', 'false'], builtin: null, desc: '收尾時要不要 push' },
    'land.archivePlan': { values: ['true', 'false'], builtin: null, desc: '計畫落地後直接封存，還是先問' },
    'class.default': { values: ['spike', 'bounded', 'architectural'], builtin: null, desc: '起任務沒指定類別時的預設（spike／bounded／architectural）' },
    guard: { values: ['ask', 'deny', 'off'], builtin: 'ask', desc: '別的 session 佔了檔案時：ask 問、deny 擋、off 只警告' },
    'dispatch.floor': { values: ['sonnet', 'opus', 'fable', 'haiku'], builtin: 'sonnet', desc: '派給實作者的最低模型' },
    'judge.model': { values: ['sonnet', 'opus', 'fable', 'haiku'], builtin: 'fable', desc: '判官（/fankeel-ask）用哪個模型' },
    'design.mockup': { values: ['false', 'sonnet', 'opus', 'fable'], builtin: false, desc: '有前端的專案，design 站先做頁面時用哪個模型；false 不做' },
    'station.hide': { values: ['true', 'false'], builtin: 'false', desc: '這個專案要不要從監控站隱藏' },
    // `values` here is only the three fixed forms a station <select> lists —
    // `false`, `true`, `all`. The fourth form, a comma-separated stage list,
    // is validated and normalized by `parseStageAgents` below rather than by
    // this array, because it is not a small enumerable set.
    'stage.agents': { values: ['false', 'true', 'all'], builtin: 'false', desc: '哪幾站交給站 agent 在乾淨 context 裡跑，主控只轉路徑' },
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

// `stage.agents`: `false` is none, `true` keeps its old meaning of survey
// alone — every doc and the A/B mean survey by `true` — `all` is every
// canonical stage, and anything else is a comma-separated list of stage
// names, lowercased and re-ordered to the canonical order below regardless
// of what order or how many repeats they arrived in, so two profiles naming
// the same set always compare equal. An empty string reads as `false`: the
// station's "apply machine defaults" control round-trips an off value
// through `String([])`, which is empty.
//
// The canonical seven is reused rather than retyped, from `lib/stages.js` —
// required here, inside the function, rather than at this module's own top
// level: that file already requires this one at ITS top level (`rulesFor`'s
// fallback reads `profile.read`), so requiring it back up here at
// module-load time would hand that file an empty object before this one
// finishes. A require inside the function defers it to call time, well
// after both modules have loaded — this only ever runs from `read` or
// `write`, at runtime.
function parseStageAgents(raw) {
    const s = String(raw).trim().toLowerCase();
    if (s === 'false' || s === '') return { value: [] };
    if (s === 'true') return { value: ['survey'] };
    const canon = require('./stages.js').FULL_ROUTE;
    if (s === 'all') return { value: canon.slice() };
    // Both refusals below share one message rather than each wording its
    // own: `key + ' is one of: ' + values.join(', ')` is the shape every
    // other bad value in this file returns (`tests/profile.test.js` pins it
    // for `guard`), and neither an empty list nor an unrecognised name is an
    // exception worth a shape of its own.
    const bad = { error: 'stage.agents is one of: false, true, all, or a comma-separated list of: ' + canon.join(', ') };
    const names = s.split(',').map((n) => n.trim()).filter(Boolean);
    if (!names.length) return bad;
    if (names.some((n) => !canon.includes(n))) return bad;
    const set = new Set(names);
    return { value: canon.filter((n) => set.has(n)) };
}

function parseValue(key, raw) {
    const spec = KEYS[key];
    if (!spec) return { error: 'unknown key: ' + key + '. Keys: ' + Object.keys(KEYS).join(', ') };
    if (key === 'stage.agents') return parseStageAgents(raw);
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
function suggest(projectRoot, registryRoot) {
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

    // The registry's own record of what `task.js land` was actually told, for
    // the same project — the only place `pr` and `keep` ever show up, since
    // git's merge history only speaks to `merge`. A fallback, not an
    // override: it fills a key git left unset, never replaces one git set.
    if (registryRoot) {
        const rel = path.relative(registryRoot, projectRoot).split(path.sep).join('/');
        const { entries } = registryLib.readAll(registryRoot);
        const lands = entries
            .filter((e) => registryLib.projectOf(e.data) === rel)
            .map((e) => e.data.land)
            .filter((l) => l && typeof l === 'object' && typeof l.integration === 'string');
        if (lands.length) {
            const counts = {};
            for (const l of lands) counts[l.integration] = (counts[l.integration] || 0) + 1;
            const ranked = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
            evidence.push('land records: ' + ranked.map((k) => counts[k] + ' ' + k).join(', '));
            if (values['land.integration'] === undefined && lands.length >= 3) {
                values['land.integration'] = ranked[0];
            }
            const pushed = lands.filter((l) => l.push === true).length;
            const noPush = lands.filter((l) => l.push === false).length;
            if (values['land.push'] === undefined && pushed + noPush >= 3) {
                values['land.push'] = pushed > noPush;
            }
        }
    }
    return { values, evidence };
}

// The two strings the injected block carries. `landClause` is what fills
// {{PROFILE_LAND}} and is never empty: `substitute` skips a falsy value and
// would ship the raw token.
// The habits the station's home page offers as one card each. `set` is what a
// preset writes: a value is written as if typed at `profile set`, and `null`
// clears the key from the file it is applied to, so the layer below answers.
const PRESETS = {
    manual: {
        label: '手動',
        blurb: '每個關卡都問我。不熟的 repo，或不想讓它替你決定的時候用這組。',
        set: { 'land.integration': null, 'land.push': null, 'land.archivePlan': null, 'class.default': null, guard: 'ask', 'stage.agents': 'false' },
    },
    balanced: {
        label: '平衡',
        blurb: '這個 repo 今天的習慣：收尾照現在的做法走，只在值得停的地方停。',
        set: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true', guard: 'ask', 'stage.agents': 'survey' },
    },
    lean: {
        label: '省 context',
        blurb: '主控只轉路徑。在「平衡」之上，把 survey、build、verify 三站交給站 agent 在自己的乾淨 context 裡跑。',
        set: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true', guard: 'ask', 'stage.agents': 'survey,build,verify' },
    },
};

// Removes one key from one file. A key that is not there is not an error, and
// nothing is written for it: a file is never created just to say it is empty.
function unset(file, key) {
    if (!KEYS[key]) return { ok: false, reason: 'unknown key: ' + key };
    const current = readOne(file);
    if (current.unreadable) return { ok: false, reason: file + ' does not parse; fix it by hand first' };
    if (!current.values || !Object.prototype.hasOwnProperty.call(current.values, key)) return { ok: true, file, key };
    const next = Object.assign({}, current.values);
    delete next[key];
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    return { ok: true, file, key };
}

// The one text form of a value: what `profile show` prints and what the
// station's <select> matches its options against. `stage.agents` is the array;
// String([]) is '', which would read as blank rather than as the off it means.
function display(v) {
    if (v === undefined) return '(ask)';
    if (Array.isArray(v)) return v.length ? v.join(',') : 'false';
    return String(v);
}

// One line per key for `task.js profile show`: the key, its value and the layer
// it came from, each column as wide as its longest cell, then what the key means.
function showLines(values, sources) {
    const rows = Object.keys(KEYS).map((key) => [key, display(values[key]), sources[key] || '', KEYS[key].desc]);
    const wide = [0, 1, 2].map((c) => Math.max(...rows.map((r) => r[c].length)));
    return rows.map((r) => '  ' + [0, 1, 2].map((c) => r[c].padEnd(wide[c])).join('  ') + '  ' + r[3]);
}

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
    for (const key of ['guard', 'dispatch.floor', 'judge.model', 'design.mockup']) {
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

module.exports = { KEYS, PRESETS, projectFile, machineFile, configDirOf, read, write, unset, suggest, landClause, summary, parseValue, display, showLines };
