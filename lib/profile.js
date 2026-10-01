'use strict';

// One profile per project, committed beside docs.json, and one per machine
// under the config dir. Values merge per key — a project that sets only
// `land.push` still gets the machine's `guard`. Built-in defaults are the
// third layer, and `sources` says which layer each value came from.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registryLib = require('./registry.js');
const agentfile = require('./agentfile.js');

const PROJECT_FILE = ['.fankeel', 'profile.json'];
const MACHINE_FILE = ['fankeel', 'profile.json'];

// Every key, its allowed values, and the built-in default (null: ask).
const KEYS = {
    'land.integration': { values: ['merge', 'pr', 'keep'], builtin: null, desc: '收尾時怎麼整合：merge、pr 或 keep' },
    'land.push': { values: ['true', 'false'], builtin: null, desc: '收尾時要不要 push' },
    'land.archivePlan': { values: ['true', 'false'], builtin: null, desc: '計畫落地後直接封存，還是先問' },
    'class.default': { values: ['spike', 'bounded', 'architectural'], builtin: null, desc: '起任務沒指定類別時的預設（spike／bounded／architectural）' },
    guard: { values: ['ask', 'deny', 'off'], builtin: 'ask', desc: '別的 session 佔了檔案時：ask 問、deny 擋、off 只警告' },
    'dispatch.floor': { values: ['sonnet', 'opus', 'fable', 'haiku'], builtin: 'sonnet', desc: '派給實作者與 reader 的最低模型' },
    'judge.model': { values: ['sonnet', 'opus', 'fable', 'haiku'], builtin: 'fable', desc: '判官（/fankeel-ask）用哪個模型' },
    'design.mockup': { values: ['false', 'auto', 'sonnet', 'opus', 'fable'], builtin: false, desc: '有前端的專案，design 站先做頁面時用哪個模型；auto 前端工作不問就畫、畫完開頁面；false 不做' },
    'design.skill': { values: ['taste-skill:taste-skill', 'taste-skill:soft-skill', 'taste-skill:minimalist-skill', 'frontend-design:frontend-design', 'ui-ux-pro-max:ui-ux-pro-max', 'impeccable:impeccable'], builtin: null, desc: 'mockup 另外載入哪些 design skill，可多選（逗號分隔）；fankeel 指南一律載入' },
    'station.hide': { values: ['true', 'false'], builtin: 'false', desc: '這個專案要不要從監控站隱藏' },
    // `values` is the few a station button offers; `parseGateStation` below
    // accepts any whole number of seconds in range, the way `stage.agents`
    // accepts any list.
    'gate.station': { values: ['off', '60', '120', '300'], builtin: 'off', desc: 'gate 發出後，等監控站作答幾秒；off 不等，逾時照常在 terminal 問' },
    // `values` here is only the three fixed forms a station <select> lists —
    // `false`, `true`, `all`. The fourth form, a comma-separated stage list,
    // is validated and normalized by `parseStageAgents` below rather than by
    // this array, because it is not a small enumerable set.
    'stage.agents': { values: ['false', 'true', 'all'], builtin: 'false', desc: '哪幾站交給站 agent 在乾淨 context 裡跑，主控只轉路徑' },
    // Free text like `prompt.*`, but one token: an ollama model name, which
    // `scripts/security-local.js` sends verify's security lens to first.
    // `values` is empty for the same reason; `parseModelName` below is the check.
    'security.local': { values: [], builtin: null, free: '一個 ollama 模型名稱', desc: 'verify 的 security lens 先交給哪個本地 ollama 模型篩候選；沒設照原流程' },
    // Free text, one line each: the user's own sentence, appended last to the
    // rules of every stage (`prompt.all`) or of one (`prompt.<stage>`). `values`
    // is empty because nothing enumerates a sentence; `parsePrompt` below is the
    // check. Not in the station's wizard — `WIZARD_KEYS` — which has no
    // free-text field; `task.js profile set` is where they are set.
    'prompt.all': { values: [], builtin: null, desc: '每個 stage 的規則最後附上的一句自訂 prompt，每輪注入' },
    'prompt.survey': { values: [], builtin: null, desc: 'survey 站的規則最後附上的一句自訂 prompt' },
    'prompt.design': { values: [], builtin: null, desc: 'design 站的規則最後附上的一句自訂 prompt' },
    'prompt.plan': { values: [], builtin: null, desc: 'plan 站的規則最後附上的一句自訂 prompt' },
    'prompt.build': { values: [], builtin: null, desc: 'build 站的規則最後附上的一句自訂 prompt' },
    'prompt.verify': { values: [], builtin: null, desc: 'verify 站的規則最後附上的一句自訂 prompt' },
    'prompt.audit': { values: [], builtin: null, desc: 'audit 站的規則最後附上的一句自訂 prompt' },
    'prompt.land': { values: [], builtin: null, desc: 'land 站的規則最後附上的一句自訂 prompt' },
    // TODO 〔stage〕: the language a stage agent writes its report and gate in.
    // Free text like `prompt.*`, one line, checked by `parsePrompt`; unset, the
    // brief says nothing and the agent writes the brief's English.
    language: { values: [], builtin: null, free: '一種語言的名稱，例如 繁體中文', desc: '站 agent 寫報告與 gate 用的語言；不設就照 brief 的英文' },
    worktree: { values: ['true', 'false', 'bounded', 'architectural'], builtin: 'false', desc: '起任務時開自己的 git worktree（.fankeel/worktrees/<id 前 8 碼>，分支 fk/<id 前 8 碼>）：true 一律開，bounded 對 bounded 以上，architectural 只對 architectural' },
    // docs/90-agent/plans/2026-09-30-init-design.md §3: set by fankeel-init's
    // second skip gate; `task.js start` prints no `onboard:` line while true.
    'init.skip': { values: ['true', 'false'], builtin: 'false', desc: '跳過首次使用的 init 整理；true 時 task.js start 不再印 onboard: 行' },
    // §2c: what a `git commit` carrying a word from .fankeel/sensitive.txt gets.
    'sensitive.mode': { values: ['warn', 'block'], builtin: 'warn', desc: 'commit 帶到 .fankeel/sensitive.txt 的詞時：warn 只提醒、block 擋下' },
    'sensitive.review': { values: ['true', 'false'], builtin: 'false', desc: 'reviewer 審查時要不要多跑 ## Sensitive lens，確認敏感資料沒寫進去' },
    // commit-2: free text like `security.local` — a regular expression the first
    // line of every message scripts/commit.js commits must match. `values` is
    // empty because nothing enumerates a pattern; `parseFormat` below is the check.
    'commit.format': { values: [], builtin: null, free: '一個 JavaScript 正規式，比對訊息第一行', desc: 'commit.js 提交前，每則訊息第一行要符合的正規式；不設就不檢查' },
};

// The keys the station's wizard and its summary list: every one that offers a
// choice. A key with no `values` is free text — the prompts, `security.local` —
// and the wizard has no field type for it.
const WIZARD_KEYS = Object.fromEntries(Object.entries(KEYS).filter(([, spec]) => spec.values.length > 0));

// The key table on docs/01-guide/profile.md, generated: `意思` is each key's
// own `desc`, `可選值` lists its `values` (or, for a key with none, one line
// of free-text prose) plus the builtin when there is one, and `建議` is what
// `PRESETS.balanced.set` writes for it — a key balanced leaves alone falls
// back to naming its builtin, or "不設" when the builtin is null (ask).
// `prompt.*` is eight keys sharing one rule, so they collapse into the one
// row the page already gave them rather than eight identical-looking lines.
function profileTable() {
    const rows = [];
    for (const key of Object.keys(KEYS)) {
        const spec = KEYS[key];
        if (key.startsWith('prompt.')) {
            if (key === 'prompt.all') {
                rows.push(['`prompt.all`、`prompt.<站>`', '附在每一站（或某一站）規則最後的一句自訂 prompt', '一行文字', '需要時才設']);
            }
            continue;
        }
        const values = spec.values.length ? spec.values.map((v) => '`' + v + '`').join('、') : spec.free;
        const withBuiltin = spec.builtin !== null ? values + '；內建 `' + display(spec.builtin) + '`' : values;
        const suggested = Object.prototype.hasOwnProperty.call(PRESETS.balanced.set, key)
            ? '`' + display(PRESETS.balanced.set[key]) + '`'
            : spec.builtin !== null ? '不設，維持內建' : '不設';
        rows.push(['`' + key + '`', spec.desc, withBuiltin, suggested]);
    }
    return rows;
}

function profileTableMarkdown() {
    const header = '| key | 意思 | 可選值 | 建議 |\n|---|---|---|---|';
    return [header, ...profileTable().map((r) => '| ' + r.join(' | ') + ' |')].join('\n');
}

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
// the same set always compare equal. An empty string reads as `false`. The
// station's POST /profile never sends one here: it clears an empty value from
// the file instead, which is what "apply machine defaults" does for an off value.
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

// `gate.station`: `off`, or how many seconds hooks/gate.js holds a question
// for the station to answer before letting it reach the terminal.
const GATE_STATION_MAX = 600;
function parseGateStation(raw) {
    const s = String(raw).trim().toLowerCase();
    if (s === 'off' || s === '') return { value: 'off' };
    const n = /^\d+$/.test(s) ? Number(s) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= GATE_STATION_MAX) return { value: n };
    return { error: 'gate.station is off or a number of seconds from 1 to ' + GATE_STATION_MAX };
}

// `design.skill`: one or more of its values, as an array or a comma list, kept
// in `values` order so two profiles naming the same set compare equal. A
// single string is a list of one — every profile written before this.
function parseDesignSkill(raw) {
    const allowed = KEYS['design.skill'].values;
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    const names = list.map((n) => String(n).trim().toLowerCase()).filter(Boolean);
    if (!names.length || names.some((n) => !allowed.includes(n))) return { error: 'design.skill is one or more of: ' + allowed.join(', ') };
    return { value: allowed.filter((n) => names.includes(n)) };
}

// `prompt.*`: the sentence as typed, trimmed but not lowercased. One line,
// because it is injected as one rule; 200 characters at most, because it is
// paid for on every prompt and the blocks it joins sit near their cap.
const PROMPT_MAX = 200;
function parsePrompt(key, raw) {
    const s = String(raw).trim();
    if (!s || /[\r\n]/.test(s) || [...s].length > PROMPT_MAX) return { error: key + ' is one line of 1 to ' + PROMPT_MAX + ' characters' };
    return { value: s };
}

// `security.local`: an ollama model name as `ollama list` prints it —
// `qwen3:14b`, `library/llama3.1:8b-instruct-q4_K_M` — or `false` to switch it
// off. Case kept; no leading `-`, no whitespace, 100 characters before the tag.
const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}(?::[A-Za-z0-9._-]{1,100})?$/;
function parseModelName(key, raw) {
    const s = String(raw).trim();
    if (s.toLowerCase() === 'false') return { value: false };
    if (!MODEL_NAME.test(s)) return { error: key + ' is an ollama model name such as qwen3:14b, or false' };
    return { value: s };
}

// `commit.format`: the pattern as typed, trimmed but not lowercased. One line
// and 200 characters at most, and it has to compile, so scripts/commit.js can
// build it without a try.
const FORMAT_MAX = 200;
function parseFormat(key, raw) {
    const s = String(raw).trim();
    const bad = { error: key + ' is one line of 1 to ' + FORMAT_MAX + ' characters holding a JavaScript regular expression' };
    if (!s || /[\r\n]/.test(s) || [...s].length > FORMAT_MAX) return bad;
    try { new RegExp(s); } catch (e) { return bad; }
    return { value: s };
}

// `worktree`: whether `task.js start` opens a task's own checkout for a task of
// class `cls`. `true` always, `false` never, `bounded` from bounded up and
// `architectural` for that alone, lightest to heaviest in lib/stages.js's
// CLASSES order — the order lib/handoff.js's CLASS_ORDER copies, not a third
// list. A class that is none of the three (a hand-typed route) reaches no
// threshold. Required here rather than at the top for parseStageAgents' reason.
function wantsWorktree(value, cls) {
    if (value === true) return true;
    if (value !== 'bounded' && value !== 'architectural') return false;
    const order = Object.keys(require('./stages.js').CLASSES);
    const at = order.indexOf(String(cls || '').toLowerCase());
    return at >= 0 && at >= order.indexOf(value);
}

// One value as a shell word for a printed `profile set` line: bare when it
// holds nothing a POSIX shell reads, else single-quoted. `commit.format`'s
// `(`, `|` and `\` would otherwise be a subshell and a pipe.
function shellWord(value) {
    const s = String(value);
    return /^[A-Za-z0-9_.,:\/=+-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'";
}

// `agent.<name>.model|effort`: not rows of `KEYS`, because `<name>` ranges over
// the plugin's `agents/` directory rather than a fixed list. The model takes
// `dispatch.floor`'s values; the effort the five Claude Code accepts.
function parseAgentValue(key, agent, raw) {
    const names = agentfile.agentNames(agentfile.PLUGIN_ROOT);
    if (!names.includes(agent.name)) return { error: 'agent.<name> names one of the plugin\'s agents: ' + names.join(', ') };
    const allowed = agent.field === 'model' ? KEYS['dispatch.floor'].values : agentfile.EFFORTS;
    const s = String(raw).trim().toLowerCase();
    if (!allowed.includes(s)) return { error: key + ' is one of: ' + allowed.join(', ') };
    return { value: s };
}

function parseValue(key, raw) {
    const agent = agentfile.agentKey(key);
    if (agent) return parseAgentValue(key, agent, raw);
    const spec = KEYS[key];
    if (!spec) return { error: 'unknown key: ' + key + '. Keys: ' + Object.keys(KEYS).join(', ') };
    if (key === 'stage.agents') return parseStageAgents(raw);
    if (key === 'gate.station') return parseGateStation(raw);
    if (key === 'design.skill') return parseDesignSkill(raw);
    if (key.startsWith('prompt.')) return parsePrompt(key, raw);
    if (key === 'language') return parsePrompt(key, raw);
    if (key === 'security.local') return parseModelName(key, raw);
    if (key === 'commit.format') return parseFormat(key, raw);
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

// The profile a session's task reads: its project's file under the registry
// root, else the root's own, and the machine file under its config directory.
function profileFor(root, mine) {
    const projectRoot = require('./docs.js').projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
    return read(projectRoot, mine.configDir || configDirOf());
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

// What the history already answers: land's two questions from git and the
// registry's `land` records, and `class.default` from the class each of this
// project's sessions ran as. The registry never held `guard`, and
// `design.mockup` is not offered: the gates hold about one answer to it
// (docs/90-agent/plans/2026-10-01-todo-sweep-design.md §3).
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

    // docs/90-agent/plans/2026-10-02-worktree-habit-design.md §4: the last
    // fifty subjects that are not merges, and a pattern only when four in five
    // already read `type(scope): `. Only the types the log used: the plan gate
    // of 2026-10-02 ruled `merge` is not added on its own, so a repository that
    // never wrote `merge:` gets a pattern scripts/land.js's subject fails, and
    // init's step 7 says so. Offered like every value here, never written.
    const recent = (git(projectRoot, ['log', '--no-merges', '-n', '50', '--format=%s']) || '').split('\n').filter(Boolean);
    if (recent.length) {
        const shaped = recent.map((s) => /^([a-z]+)(\([^)]+\))?: /.exec(s)).filter(Boolean);
        evidence.push('commit subjects: ' + shaped.length + ' of ' + recent.length + ' read type(scope): ');
        if (shaped.length * 5 >= recent.length * 4) {
            const types = [...new Set(shaped.map((m) => m[1]))].sort();
            const candidate = '^(' + types.join('|') + ')(\\([^)]+\\))?: ';
            if (!parseValue('commit.format', candidate).error) values['commit.format'] = candidate;
        }
    }

    // The registry's own record of what `task.js land` was actually told, for
    // the same project — the only place `keep` ever shows up, since git's
    // merge history only speaks to `merge` and `pr`. A fallback, not an
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
        // `class` on each record, written by `task.js start --class`. Three at
        // least, and one class holding more than half of them, before it is
        // offered; the counts go on the evidence either way.
        const classes = entries
            .filter((e) => registryLib.projectOf(e.data) === rel)
            .map((e) => e.data.class)
            .filter((c) => KEYS['class.default'].values.includes(c));
        if (classes.length) {
            const tally = {};
            for (const c of classes) tally[c] = (tally[c] || 0) + 1;
            const order = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
            evidence.push('class records: ' + order.map((k) => tally[k] + ' ' + k).join(', '));
            if (classes.length >= 3 && tally[order[0]] * 2 > classes.length) values['class.default'] = order[0];
        }
    }
    return { values, evidence };
}

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
    if (!KEYS[key] && !agentfile.agentKey(key)) return { ok: false, reason: 'unknown key: ' + key };
    const current = readOne(file);
    if (current.unreadable) return { ok: false, reason: file + ' does not parse; fix it by hand first' };
    if (!current.values || !Object.prototype.hasOwnProperty.call(current.values, key)) return { ok: true, file, key };
    delete current.values[key];
    fs.writeFileSync(file, JSON.stringify(current.values, null, 2) + '\n');
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

// The clause `design.mockup`'s `when` rule fills with a token. Never falsy —
// `substitute` skips a falsy value and would ship the raw token — so the
// unset branch is spelled out in full, byte-for-byte what the rule read
// before `design.skill` existed. `auto` leads with what it changes: no
// question before drawing, and the tune page opened after.
function mockupClause(values) {
    const raw = values && values['design.skill'];
    const skills = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const auto = Boolean(values) && values['design.mockup'] === 'auto';
    const head = auto ? 'front-end work only, unasked, then `tune.js serve` opened in the browser; ' : '';
    if (skills.length) return head + 'naming ' + skills.map((s) => '`' + s + '`').join(', ') + ', under `.fankeel/build/`, path on `spec:`.';
    if (auto) return head + 'under `.fankeel/build/`, path on `spec:`.';
    return 'under `.fankeel/build/`, path on `spec:` — the gate approves the page, not the paragraph.';
}

// Only the keys somebody set. Built-in defaults are not news, and a line that
// listed them would be the same on every project.
function summary(values, sources) {
    const out = [];
    const land = landParts(values);
    if (land) out.push('land ' + land + tag(sources, 'land.integration', 'land.push'));
    if (values['land.archivePlan'] !== undefined) out.push('archive plan ' + values['land.archivePlan'] + tag(sources, 'land.archivePlan'));
    for (const key of ['guard', 'dispatch.floor', 'judge.model', 'design.mockup', 'design.skill']) {
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

module.exports = { KEYS, WIZARD_KEYS, PRESETS, projectFile, machineFile, configDirOf, read, profileFor, write, unset, suggest, wantsWorktree, shellWord, landClause, mockupClause, summary, parseValue, display, showLines, profileTable, profileTableMarkdown };
