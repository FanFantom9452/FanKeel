'use strict';
// Every fankeel session on this machine, as data and as a page.
//
// Discovery is the part nothing else here does. A registry is per workspace and
// `findStateRoot` walks up from one directory, so no reader knows more than one.
// Five sources, unioned: the `root=` field of every lead under `modes/`, the
// `cwd` of every running Claude Code session walked up to its registry, the
// roots file every `write` below rewrites, any directory the caller asks to
// have walked, and whatever the caller names. Leads are pointers and die with
// the badge; the roots file is what remembers; the registry is the record.
//
// Liveness is asked of `runningSessions` directly rather than through `readLive`,
// whose self-check is right for a hook — a scan that cannot see the caller is
// a scan not to be trusted — and wrong for a page with no session of its own.
// A directory that cannot be read still counts as live, as `docs/collisions.md`
// says, and the row says `live?` so the doubt is visible.
const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const { posix } = require('./tracked.js');
const registry = require('./registry.js');
const badge = require('./badge.js');
const live = require('./live.js');
const prices = require('./prices.js');
const { positionIn, CLASSES } = require('./stages.js');
const profile = require('./profile.js');
const detail = require('./detail.js');
const handoff = require('./handoff.js');
const board = require('./board.js');
const gatereport = require('./gatereport.js');
const { runningAgents, sessionDirOf } = require('./usage.js');
const { queueState, statusOf } = require('./tune.js');
const todoFiles = require('./todo.js');
const ledger = require('./ledger.js');

// The same 20 minutes lib/usage.js calls AGENT_QUIET_MS: a mark older than this is not work.
const BUSY_MS = 20 * 60e3;

const resolved = (p) => {
    try {
        return path.resolve(String(p));
    } catch (e) {
        return null;
    }
};

const hasRegistry = (root) => {
    try {
        return fs.statSync(path.join(root, '.fankeel', 'sessions')).isDirectory();
    } catch (e) {
        return false;
    }
};

function rootsPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'roots.json');
}

// What the lead forgets. A lead is cleared with its badge — at `down`, `clear`,
// `adopt` and the prompt after a stand-down — so a registry with no task
// running in it has nothing pointing at it, and on 2026-09-05 the page found 3
// of at least 11. This file is rewritten by every `write`: a root seen with a
// `sessions/` directory is stamped now, and a root that has gone is stamped
// too — for as long as its directory still exists — it is already rendered
// as `gone`, and forgetting it too would mean the page silently stops
// mentioning a registry the user may still be looking for. A gone root whose
// directory has been deleted is not that registry — it is a scratch tree from
// a test run, and nothing will ever look for it again.

function readRawRoots(configDir) {
    return readObject(rootsPath(configDir)) || {};
}

// A root record is a key whose value is an ISO date string. Anything else in
// this file belongs to another writer — `scripts/station.js` keeps its
// `scannedAt` object here — and is not a root.
const isRootRecord = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));

function readRoots(configDir) {
    const out = {};
    for (const [root, seen] of Object.entries(readRawRoots(configDir))) {
        if (isRootRecord(seen)) out[root] = seen;
    }
    return out;
}

// Written to a sibling and renamed, the way `lib/registry.js` writes an entry:
// `task.js`, `inject.js` and `leave.js` can all write this in the same second,
// and a torn read here is the page forgetting every registry at once.
//
// This writer owns the root records and nothing else in the file. Every key
// that is not one is carried across untouched: `write()` runs on every
// `/fankeel` prompt, so a key rebuilt away here does not survive its first
// hook, and the CLI's `scannedAt` — the record that the once-only first-run
// walk already happened — is meant to be durable.
function rememberRoots(configDir, registries, now) {
    const old = readRawRoots(configDir);
    const next = {};
    for (const [key, value] of Object.entries(old)) {
        if (!isRootRecord(value)) next[key] = value;
    }
    for (const r of registries) {
        if (!r.gone) next[r.root] = new Date(now).toISOString();
        // A gone root that still exists is a registry the user may be looking
        // for, and the comment above is why it keeps a stamp — its old one,
        // and only its old one: a root never recorded before is not this
        // page's memory to grow, so a directory merely passed as `--root`
        // once gains no entry just because it happens to be gone now. A gone
        // root whose directory is not there at all is a scratch tree from
        // a test run — two landed on 2026-09-06 — and nothing will ever find
        // it again.
        else if (isRootRecord(old[r.root]) && fs.existsSync(r.root)) next[r.root] = old[r.root];
    }
    const file = rootsPath(configDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    registry.writeAtomic(file, JSON.stringify(next, null, 2) + '\n');
}

// The one-off walk behind `--scan`: every directory under `dir` that holds
// `.fankeel/sessions/`. Not a default and not a hook — a home directory is
// minutes, and %TEMP% held 297,088 test fixtures on 2026-09-05.
const SCAN_SKIP = new Set(['node_modules', '.git']);
const SCAN_DEPTH = 8;

// Depth is the backstop; the deadline is the control. Measured 2026-09-06, a
// depth-8 walk of one drive took 10.7 seconds and a home directory did not
// finish inside twenty, so a walk that only counts directories is not bounded
// by anything a user would wait for.
// `opts.now` is a seam and not a feature: with the real clock, the only
// reproducible deadline a test can set is one already spent, and that returns on
// the first line of `walk` — an implementation that checked the deadline once
// before the walk began would pass it identically. A counting clock lets a test
// spend the deadline *between* two directories, which is the only way to see
// that this check sits inside the recursion. Production passes no `now`.
function scanRoots(dir, depth, opts) {
    const deadline = opts && Number.isFinite(opts.deadline) ? opts.deadline : Infinity;
    const now = opts && typeof opts.now === 'function' ? opts.now : Date.now;
    const roots = [];
    let depthCuts = 0;
    let timedOut = false;
    const walk = (at, left) => {
        if (timedOut) return;
        if (now() > deadline) { timedOut = true; return; }
        if (left < 0) { depthCuts += 1; return; }
        let ents;
        try {
            ents = fs.readdirSync(at, { withFileTypes: true });
        } catch (e) {
            return;
        }
        if (hasRegistry(at)) roots.push(at);
        for (const e of ents) {
            if (!e.isDirectory()) continue;
            if (SCAN_SKIP.has(e.name) || e.name.startsWith('.')) continue;
            walk(path.join(at, e.name), left - 1);
            if (timedOut) return;
        }
    };
    walk(resolved(dir), typeof depth === 'number' ? depth : SCAN_DEPTH);
    return { roots, depthCuts, timedOut };
}

function discover(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const seen = new Set();
    const gone = new Set();
    const add = (root) => {
        const abs = root && resolved(root);
        if (!abs) return;
        (hasRegistry(abs) ? seen : gone).add(abs);
    };
    for (const lead of badge.readLeads(configDir)) add(lead.fields.root);
    for (const s of live.runningSessions(configDir) || []) {
        if (s.cwd) add(registry.findStateRoot(s.cwd));
    }
    for (const root of Object.keys(readRoots(configDir))) add(root);
    // One deadline shared by every `--scan` directory, the way `autoScan`
    // shares one across drives: a caller that budgeted the walk budgeted all
    // of it. Without this the deadline branch above is dead in production and
    // `timedOut` can only ever be true in a test that calls `scanRoots` itself.
    const deadline = Number.isFinite(opts.deadline) ? opts.deadline : undefined;
    let scanStats = null;
    for (const dir of opts.scan || []) {
        const found = scanRoots(dir, undefined, { deadline });
        if (!scanStats) scanStats = { depthCuts: 0, timedOut: false };
        scanStats.depthCuts += found.depthCuts;
        scanStats.timedOut = scanStats.timedOut || found.timedOut;
        for (const root of found.roots) add(root);
    }
    for (const root of opts.roots || []) add(root);
    if (opts.cwd) add(registry.findStateRoot(opts.cwd));
    if (opts.root) add(opts.root);
    const out = { roots: [...seen].sort(), gone: [...gone].sort() };
    if (scanStats) out.scanStats = scanStats;
    return out;
}


const sum = (data, of) => {
    let total = null;
    for (const stage of Array.isArray(data.route) ? data.route : []) {
        const v = of(data, stage);
        if (v !== null) total = (total || 0) + v;
    }
    return total;
};

// Files under one build directory, walked one level at a time rather than
// with `recursive: true`, which follows a Windows junction: one left under
// .fankeel/build pointing at ~/.claude/projects cost `write()` about three
// seconds on 2026-10-04. A link is never entered: a junction's Dirent says
// `isDirectory()` false, so the walk below never pushes it, and the junction
// test in tests/station-build-dirs.test.js holds that. `until` is `gather`'s
// own deadline; past it the count stops where it is.
function countFiles(dir, until) {
    let files = 0;
    const stack = [dir];
    while (stack.length && Date.now() < until) {
        const at = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(at, { withFileTypes: true });
        } catch (e) {
            continue;
        }
        for (const ent of entries) {
            if (ent.isDirectory()) stack.push(path.join(at, ent.name));
            else if (ent.isFile()) files += 1;
        }
    }
    return files;
}

// A build directory's count, held in the caller's `memo` (the server's
// `buildMemo`) for BUILD_MS: the walk was ~155 ms of every gather on
// 2026-10-21, and a count a minute old is still the page's answer. A count the
// deadline cut short is not held.
const BUILD_MS = 60000;

function buildDirs(root, until, memo) {
    const deadline = typeof until === 'number' && !Number.isNaN(until) ? until : Infinity;
    const held = memo instanceof Map ? memo : null;
    const dir = path.join(root, '.fankeel', 'build');
    let names;
    try {
        names = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
    const out = [];
    for (const d of names) {
        if (!d.isDirectory()) continue;
        const at = path.join(dir, d.name);
        const was = held ? held.get(at) : null;
        if (was && Date.now() - was.at < BUILD_MS) {
            out.push({ name: d.name, files: was.files });
            continue;
        }
        const files = countFiles(at, deadline);
        if (held && Date.now() < deadline) held.set(at, { at: Date.now(), files });
        out.push({ name: d.name, files });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

function mapDate(root) {
    try {
        return fs.statSync(path.join(root, '.fankeel', 'map.md')).mtime.toISOString();
    } catch (e) {
        return null;
    }
}

// The file itself, for `parseMapCard` — read once per registry write, the
// same file `mapDate` already stats for the footer's own line.
function mapDoc(dir) {
    try {
        const file = path.join(dir, '.fankeel', 'map.md');
        return { text: fs.readFileSync(file, 'utf8'), mtimeMs: fs.statSync(file).mtimeMs };
    } catch (e) {
        return null;
    }
}

// The indented lines under one of `map.js`'s own headers, each with its
// leading two spaces stripped, stopping at the first line that is not
// indented — a blank line included, since `map.js` always leaves one after
// a section.
function mapSection(lines, at) {
    if (at < 0) return [];
    const out = [];
    for (let i = at + 1; i < lines.length && lines[i].startsWith('  '); i++) out.push(lines[i].slice(2));
    return out;
}

// What `map.js` already computed for one project, quoted rather than
// re-derived — this reads `.fankeel/map.md`'s own text and never re-runs a
// docs scan. A section this does not recognise is simply left out of the
// card, so a `map.js` change that adds one shows up here only once this is
// taught to read it too. `null` means the text has no `documents:` line at
// all — the caller reads that as "no card," the same as a missing file.
function parseMapCard(text) {
    const lines = String(text == null ? '' : text).split('\n');
    const docLine = lines.find((l) => l.startsWith('documents: '));
    if (!docLine) return null;
    const dm = /^documents: (\d+) markdown files(?: — (.+))?$/.exec(docLine);
    if (!dm) return null;
    const total = Number(dm[1]);
    const buckets = (dm[2] || '').split(', ').filter(Boolean).map((part) => {
        const bm = /^(\d+) (\S+)$/.exec(part);
        return bm ? { label: bm[2], count: Number(bm[1]) } : null;
    }).filter(Boolean);

    const plannedAt = lines.findIndex((l) => /^planned, not built — \d+:$/.test(l));
    const plannedNotBuilt = mapSection(lines, plannedAt);

    const undeclaredAt = lines.findIndex((l) => /^undeclared — \d+, /.test(l));
    const um = undeclaredAt < 0 ? null : /^undeclared — (\d+), (.+):$/.exec(lines[undeclaredAt]);
    const undeclared = um ? { count: Number(um[1]), note: um[2], paths: mapSection(lines, undeclaredAt) }
        : { count: 0, note: null, paths: [] };

    // The whole-bucket notes from "retired, do not follow" — `map.js` writes
    // one such line per archive bucket ("docs/archive — 102, the whole
    // archive bucket"), and a loose individual retired page's own line has no
    // ` — ` in it, so it never matches here and is simply not surfaced by
    // this card, the same as it is not by the mockup this card follows.
    const retiredAt = lines.findIndex((l) => /^retired, do not follow — \d+:$/.test(l));
    const retiredNotes = {};
    for (const l of mapSection(lines, retiredAt)) {
        const rm = /^(\S.*?) — (.+)$/.exec(l);
        if (rm) retiredNotes[rm[1]] = rm[2];
    }

    const filingAt = lines.findIndex((l) => l.startsWith('filing: index: '));
    const filing = filingAt < 0 ? null : {
        index: lines[filingAt].slice('filing: index: '.length),
        rows: mapSection(lines, filingAt).map((l) => {
            const rm = /^(\S+) — (\S+)$/.exec(l);
            return rm ? { bucket: rm[1], role: rm[2], note: retiredNotes[rm[1]] || null } : null;
        }).filter(Boolean),
    };

    return { total, buckets, plannedNotBuilt, undeclared, filing };
}

// What `scripts/tune.js` has queued for one project: counts, the url its
// server recorded, and each request's id, block and status — the page compares
// two reads of this to say a block was changed. Read from the files tune.js
// writes under the project's own `.fankeel/build/tune/`; null with no queue.
const TUNE_ITEMS = 50;
function tuneOf(dir, now) {
    const state = path.join(dir, '.fankeel', 'build', 'tune');
    let text;
    try {
        text = fs.readFileSync(path.join(state, 'queue.jsonl'), 'utf8');
    } catch (e) {
        return null;
    }
    // A taken request nobody settled for 24 hours is `expired` (lib/tune.js
    // statusOf): listed, but not in progress, so no 編輯中 row is drawn for it.
    const clock = typeof now === 'number' ? now : Date.now();
    const rows = queueState(text).map((r) => Object.assign({}, r, { status: statusOf(r, clock) }));
    if (!rows.length) return null;
    let url = null;
    const rec = readObject(path.join(state, 'serve.json'));
    const port = rec && rec.port;
    if (Number.isInteger(port) && port > 0) url = 'http://127.0.0.1:' + port + '/';
    const count = (list) => rows.filter((r) => list.includes(r.status)).length;
    return {
        open: count(['queued', 'taken']), done: count(['done']), rejected: count(['rejected']), url,
        items: rows.slice(-TUNE_ITEMS).map((r) => ({ id: r.id, block: typeof r.block === 'string' ? r.block : '', status: r.status })),
    };
}

// The stage agent in flight, as `hooks/brief.js` marked it (`markInflight` in
// lib/registry.js); `lap` is the brief's business and stays behind.
function inflightOf(data) {
    const m = data && data.inflight;
    if (!m || typeof m !== 'object' || typeof m.stage !== 'string') return null;
    return {
        stage: m.stage,
        at: Number.isFinite(m.at) ? m.at : null,
        agentId: typeof m.agentId === 'string' && m.agentId ? m.agentId : null,
    };
}

// The subagents running now under one session, read beside its transcript.
function agentsNow(configDir, sessionId, now) {
    const transcript = detail.transcriptOf(configDir, sessionId);
    const dir = transcript ? sessionDirOf(transcript) : null;
    return dir ? runningAgents(dir, now) : [];
}

// What an inactive row is held against in `rowMemo`: its entry file's mtime and
// size, its transcript's (none once Claude Code deleted it), and the liveness
// facts the row reads. A stat of each file, never of a directory: a directory's
// mtime moves for its direct children only.
function rowKeyOf(root, sessionId, transcripts, running, since) {
    const stamp = (f) => {
        try {
            const st = fs.statSync(f);
            return st.mtimeMs + ':' + st.size;
        } catch (e) {
            return '-';
        }
    };
    const file = registry.sessionPath(root, sessionId);
    const t = transcripts instanceof Map ? transcripts.get(sessionId) : null;
    return [file ? stamp(file) : '-', t ? stamp(t) : '-', running, since].join('|');
}

const STATE_OF_SECTION = { Ready: 'ready', 'Needs a decision': 'decision', Blocked: 'blocked', Watch: 'watch' };

// One project directory's TODO entries for the project page, both modes
// through `load`: `open` always, in the index's order; `done` only where the
// project keeps entry files. null where the directory has neither. Every open
// entry carries `due` and `dueAt` from `todoFiles.dueOf` — the Blocked rule
// todo-check reads — so the page never re-derives it from the stamp.
function todoOf(dir, now) {
    const at = typeof now === 'number' ? now : Date.now();
    let loaded;
    try {
        loaded = todoFiles.load(dir);
    } catch (e) {
        return { mode: 'error', folder: null, open: [], done: [], error: String((e && e.message) || e) };
    }
    if (!loaded) return null;
    if (loaded.mode === 'folder') {
        const rank = new Map(loaded.entries.map((e, i) => [e.id, i]));
        const order = (e) => (rank.has(e.id) ? rank.get(e.id) : Infinity);
        const bodyOf = new Map(loaded.all.map((e) => [e.id, e.body || '']));
        return {
            mode: 'folder', folder: loaded.folder,
            open: loaded.all.filter((e) => e.state !== 'done').sort((a, b) => order(a) - order(b)).map((e) => Object.assign({
                id: e.id, label: e.label, title: e.title, description: e.description, state: e.state,
                condition: e.timing, stamp: e.stamp, body: e.body || '',
            }, todoFiles.dueOf(e.state, e.timing, e.stamp, at))),
            done: loaded.done.map((e) => ({ id: e.id, label: e.label, title: e.title, at: e.at, sha: e.sha,
                disposition: e.disposition, session: e.session, body: todoFiles.recordOf(bodyOf.get(e.id) || '') || bodyOf.get(e.id) || '' })),
        };
    }
    const byLine = new Map(loaded.timings.map((t) => [t.line, t]));
    return {
        mode: 'file', folder: null,
        open: loaded.entries.map((e) => {
            const f = todoFiles.fromLine(e.text, '', STATE_OF_SECTION[e.section] || '');
            const t = e.timing === null ? null : byLine.get(e.timing);
            const condition = t && t.kind ? t.kind + ': ' + (t.event || '') : '';
            const stamp = t && t.stamp !== null ? todoFiles.isoDay(t.stamp) : '';
            return Object.assign({ id: null, label: f.label, title: f.title, description: f.description, state: f.state,
                condition, stamp, body: '' }, todoFiles.dueOf(f.state, condition, stamp, at));
        }),
        done: [],
    };
}

// A registry root's architecture board: the one file the station's
// `/chartroom/<root folder name>/` route hands to Chartroom
// (scripts/station.js). Committed with the project like
// `.fankeel/profile.json`; the station never creates it.
function boardPath(root) {
    return path.join(root, '.fankeel', 'architecture.board');
}

// The completion record land filed (scripts/record.js), or null for a session
// that has none or one that does not have the shape the page reads.
function recordOf(data) {
    const r = data && data.record;
    if (!r || typeof r !== 'object' || !r.fields || typeof r.fields !== 'object') return null;
    return { at: r.at || null, file: r.file || null, anchor: r.anchor || null, fields: r.fields };
}

function gather(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const found = discover(opts);
    // How long this call may spend reading transcripts for the detail panel. A
    // changed session costs about half a second (measured 2026-09-11 on two
    // real sessions: 543 and 516 ms), and `hooks/inject.js` writes the page
    // inside a five-second hook — so `write()` hands a budget in, and every
    // session reached after it is spent reuses its cache as it stands. No
    // budget is no limit.
    const until = Number.isFinite(opts.detailBudgetMs) ? Date.now() + opts.detailBudgetMs : Infinity;
    // The server's holds across gathers (scripts/station.js): each inactive
    // session's row while `rowKeyOf` says nothing under it moved. Nothing but
    // liveness moves under a session that is not active, and that is in the key.
    const rowMemo = opts.rowMemo instanceof Map ? opts.rowMemo : null;
    // One liveness scan per config dir this page needs, for the life of this
    // call: each running session's id, and when the newest process running it
    // started — `statesOf` in lib/detail.js tells an agent that process runs
    // from one an earlier process of the same session left open. A Map answers
    // `has` the way the Set it replaced did.
    const scans = new Map();
    const rowsIn = new Map();
    const idsIn = (dir) => {
        if (!scans.has(dir)) {
            const rows = live.runningSessions(dir);
            rowsIn.set(dir, rows || []);
            const ids = rows ? new Map() : null;
            for (const r of rows || []) {
                ids.set(r.sessionId, Math.max(ids.get(r.sessionId) || 0, Number.isFinite(r.startedAt) ? r.startedAt : 0) || null);
            }
            scans.set(dir, ids);
        }
        return scans.get(dir);
    };
    // station-57: Remote Control attached to a running session, read off the
    // same scan.
    const bridged = (dir, id) => { idsIn(dir); return rowsIn.get(dir).some((r) => r.sessionId === id && r.bridge); };
    // One read of each config dir's projects/ per gather, not a stat in every
    // project directory for each session whose transcript is gone.
    const indexes = new Map();
    const indexIn = (dir) => {
        if (!indexes.has(dir)) indexes.set(dir, detail.transcriptIndex(dir));
        return indexes.get(dir);
    };
    // A running session missing from a held index most likely started after it
    // was read: the index is read again, once per config dir per gather.
    const refreshed = new Set();
    const indexFor = (dir, sessionId, running) => {
        const index = indexIn(dir);
        if (running && index && !index.has(sessionId) && !refreshed.has(dir)) {
            refreshed.add(dir);
            indexes.set(dir, detail.transcriptIndex(dir, { fresh: true }));
        }
        return indexes.get(dir);
    };
    const registries = [];
    for (const root of found.roots) {
        const all = registry.readAll(root);
        const sessions = [];
        for (const { sessionId, data } of all.entries) {
            const theirs = typeof data.configDir === 'string' && data.configDir ? data.configDir : configDir;
            const ids = idsIn(theirs);
            const running = ids ? ids.has(sessionId) : true;
            // When the process now running this session started, read once:
            // `since` on the row below and the third argument to `statesOf`
            // are the same fact and must not be computed twice.
            const since = running && ids ? (ids.get(sessionId) || null) : null;
            const bridge = Boolean(running && ids && bridged(theirs, sessionId));
            const at = positionIn(data.route, data.stage) || {};
            const usage = data.usage && typeof data.usage === 'object' ? data.usage : null;
            // The panel's detail, read and cached by `lib/detail.js`. `--json`
            // asks for none: it prints rows, and a replay is not a row. A
            // session id asks for that one alone — the served detail route,
            // which needs one session and not the machine. `memo` is the
            // server's, held across requests (`detailOf`).
            const wanted = opts.details === false ? false
                : typeof opts.details === 'string' ? opts.details === sessionId : true;
            // A held row stands for this one when its key matches and it was
            // built with a detail, or none is wanted now.
            const rowKey = rowMemo && data.active !== true ? rowKeyOf(root, sessionId, indexIn(theirs), running, since) : null;
            const held = rowKey ? rowMemo.get(root + '\0' + sessionId) : null;
            if (held && held.key === rowKey && (held.wanted || !wanted)) {
                sessions.push(Object.assign({}, held.row, { detailFresh: false, bridge }));
                continue;
            }
            const spent = Date.now() > until;
            const got = !wanted ? null
                : detail.detailOf(theirs, sessionId, data, { reuse: spent, memo: opts.memo, transcripts: indexFor(theirs, sessionId, Boolean(running && ids)) });
            const boardDir = handoff.dirFor(root, data);
            const row = {
                sessionId,
                bridge,
                // The task's Chartroom boards, `*.board` in its build
                // directory (lib/board.js); the board route reads `boardDir`.
                boardDir,
                boards: board.listBoards(boardDir),
                state: data.active !== true ? 'down' : running ? 'live' : 'stale',
                unknown: data.active === true && !ids,
                task: typeof data.task === 'string' ? data.task : '',
                project: registry.projectOf ? (registry.projectOf(data) || '') : (data.project || ''),
                stage: typeof data.stage === 'string' ? data.stage : '',
                route: Array.isArray(data.route) ? data.route : [],
                step: at.step || 0,
                steps: at.steps || 0,
                started: typeof data.started === 'string' ? data.started : null,
                updated: registry.updatedAt(data),
                ended: data.ended && typeof data.ended === 'object' ? data.ended : null,
                model: typeof data.model === 'string' ? data.model : null,
                version: typeof data.version === 'string' ? data.version : null,
                usage,
                cost: usage && usage.models ? prices.costOf(usage.models) : null,
                agents: usage && usage.subagents && typeof usage.subagents === 'object' ? usage.subagents : null,
                agentCost: usage && usage.subagents && usage.subagents.models ? prices.costOf(usage.subagents.models) : null,
                burn: sum(data, registry.burnOf),
                gates: Array.isArray(data.gates) ? data.gates : null,
                // `costOf` returns `usd: 0` for a stage whose models the table
                // does not price, which is indistinguishable from a stage that
                // genuinely cost nothing: the table would print `$0.00` and the
                // cumulative curve would count the stage as free. `row()`
                // already reads `priced.length` for the summary cell; an
                // unpriced stage is `null` here for the same reason, and the
                // table prints `—` while the curve steps over it.
                //
                // Both halves of the stage are priced and added: the parent's
                // own requests and, under `spend[stage].subagents`, whatever
                // its agents spent in that window. `usd` is therefore the one
                // number the cost cell above prints as `$X + $Y (N agents)`,
                // and a curve drawn from the parent alone was a third of it.
                // A stage priced on one side only still carries that side —
                // `null` means neither side had a rate, not that one did not.
                stages: registry.seriesOf(data).map((w) => {
                    const own = w.spend && w.spend.models ? prices.costOf(w.spend.models) : null;
                    const theirs = w.spend && w.spend.subagents && w.spend.subagents.models
                        ? prices.costOf(w.spend.subagents.models) : null;
                    const mine = own && own.priced.length ? own.usd : 0;
                    const agents = theirs && theirs.priced.length ? theirs.usd : 0;
                    const priced = Boolean((own && own.priced.length) || (theirs && theirs.priced.length));
                    return {
                        stage: w.stage,
                        from: w.from,
                        to: w.to,
                        burn: w.burn,
                        usd: priced ? mine + agents : null,
                        estimated: Boolean((own && own.estimated.length) || (theirs && theirs.estimated.length)),
                        waited: w.waited,
                    };
                }),
                clock: sum(data, registry.clockOf),
                waited: sum(data, registry.waitedOf),
                claims: registry.claimsOf(data), seen: registry.seenOf(data),
                pending: data.active === true ? handoff.readPending(root, data) : null,
                // When the question went out (`gateOpen`); the page counts a
                // gate's wait from here before `pending.at` or `updated`.
                gateAt: Number.isFinite(data.gateAt) ? data.gateAt : null,
                inflight: data.active === true ? inflightOf(data) : null,
                // A stage agent out on this stage, marked under 20 minutes ago: the glyph breathes.
                busy: data.active === true && registry.inflights(data).some((m) => m.stage === data.stage
                    && Number.isFinite(m.at) && now - m.at < BUSY_MS),
                // Only for a session whose process is running: the scan is a
                // readdir and a 256 KB tail per agent, every three seconds.
                subagents: data.active === true && running ? agentsNow(theirs, sessionId, now) : [],
                shells: data.active === true && running ? shellsNow(theirs, sessionId) : [],
                tune: data.active === true ? tuneOf(path.join(root, registry.projectOf ? (registry.projectOf(data) || '') : (data.project || ''))) : null,
                notes: registry.notesOf(data),
                next: registry.nextOf(data),
                record: recordOf(data),
                guard: typeof data.guard === 'string' ? data.guard : '',
                configDir: theirs,
                detail: got ? got.detail : null,
                detailFresh: Boolean(got && got.fresh),
                // Each agent's state read against when this process started
                // (`statesOf`); `states` is null without a detail, `since`
                // without a process to date.
                since,
                states: got ? detail.statesOf(got.detail, running, since) : null,
                tasks: detail.tasksOf(root, data, got ? got.detail.rows : []),
                // The report this session's current stage waits at its gate with,
                // for the 關卡 tab (lib/gatereport.js); none without a detail.
                gate: got ? gatereport.read(root, data) : null,
                // The detail's own sequence when there is a transcript, and the
                // entry's `moves` or clock when there is none — one
                // `stageSequence` either way, so the two cannot count apart.
                backtracks: got ? got.detail.backtracks
                    : detail.backtracksOf(detail.stageSequence([], data), data.route).length,
            };
            sessions.push(row);
            // A row read under a spent budget may hold a stale detail; it is not held.
            if (rowKey && !spent) rowMemo.set(root + '\0' + sessionId, { key: rowKey, wanted, row: Object.assign({}, row) });
        }
        sessions.sort((a, b) => (b.updated || 0) - (a.updated || 0));
        const projectDirs = [root].concat([...new Set(sessions.map((s) => s.project).filter(Boolean))]
            .map((p) => path.join(root, p)).filter((p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }));
        const profiles = {};
        for (const p of projectDirs) profiles[p] = profile.read(p, configDir);
        // One card per project directory that has a map.md — the registry
        // root's own plus every project under it, the same set `profiles`
        // just walked. A directory with none is simply not in this list.
        const docs = [];
        for (const dir of projectDirs) {
            const doc = mapDoc(dir);
            const card = doc && parseMapCard(doc.text);
            if (!card) continue;
            const rel = dir === root ? '' : posix(path.relative(root, dir));
            docs.push(Object.assign({ pkey: rel ? root + '/' + rel : root, generatedAt: new Date(doc.mtimeMs).toISOString() }, card));
        }
        // The same project directories' TODO entries, for each project page.
        const todos = [];
        for (const dir of projectDirs) {
            const t = todoOf(dir, now);
            if (!t) continue;
            const rel = dir === root ? '' : posix(path.relative(root, dir));
            todos.push(Object.assign({ pkey: rel ? root + '/' + rel : root }, t));
        }
        registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root, until, opts.buildMemo), mapAt: mapDate(root), board: fs.existsSync(boardPath(root)), sessions, profiles, docs, todos });
    }
    for (const root of found.gone) {
        registries.push({ root, gone: true, unreadable: 0, build: [], mapAt: null, board: false, sessions: [], profiles: {}, docs: [], todos: [] });
    }
    // station-57: a running session no registry lists — a Desktop tab or a
    // terminal that never ran /fankeel — read from this config dir's
    // sessions/<pid>.json, newest first, one row per session id. Whether a
    // hidden project keeps it off the page is serialize's call.
    const listed = new Set();
    const registered = new Set();
    for (const r of registries) for (const s of r.sessions) registered.add(s.sessionId);
    for (const r of registries) for (const s of r.sessions) if (s.state !== 'down') listed.add(s.sessionId);
    idsIn(configDir);
    // An ended ('down') registry entry whose process still runs with Remote
    // Control attached is a live tab the page would otherwise lose.
    const unregistered = rowsIn.get(configDir)
        .filter((r) => !listed.has(r.sessionId) && (r.bridge || !registered.has(r.sessionId)))
        .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
        .filter((r, i, all) => all.findIndex((x) => x.sessionId === r.sessionId) === i)
        .map((r) => ({ sessionId: r.sessionId, cwd: r.cwd, pid: r.pid, entrypoint: r.entrypoint, name: r.name, status: r.status, bridge: r.bridge, startedAt: r.startedAt }));
    // A caller that walked the machine itself — `scripts/station.js`'s
    // first-run `autoScan` — hands its own numbers in, and `discover` may have
    // walked again for `opts.scan` on the same call. They are two walks, not
    // two opinions of one, so neither is authoritative and the header adds
    // them: cuts summed, timed-out true if either ran out. Letting the handed
    // block win outright threw the `--scan` walk's own counts away and the
    // header then described a walk that was not the one that ran short.
    const handed = opts.scanStats && typeof opts.scanStats === 'object' ? opts.scanStats : null;
    const walked = found.scanStats || null;
    return {
        generatedAt: new Date(now).toISOString(),
        configDir,
        pricesVerified: prices.verified,
        registries,
        unregistered,
        machineProfile: profile.read(null, configDir),
        scanStats: handed && walked
            ? {
                depthCuts: (handed.depthCuts || 0) + walked.depthCuts,
                timedOut: Boolean(handed.timedOut) || walked.timedOut,
            }
            : handed || walked,
    };
}

// The shell and its two assets ship as files rather than as template literals,
// so the CSS has syntax highlighting and the view script can be unit tested.
// They are copied rather than referenced: the plugin directory carries its
// version in its path, so a page pointing into it breaks on the next update,
// and the copy under `<root>/.fankeel/` would point outside its own repository.
const ASSETS = path.join(__dirname, '..', 'assets', 'station');

// A project whose profile says `station.hide: 'true'` does not go on the page
// at all — not as a row, not inside a total, not as a detail file on disk.
// One function, because the page, the detail writer and the two CLI surfaces
// each filter separately and a second copy of this judgement is a second
// judgement that will drift.
//
// `r.profiles` is keyed by `path.join(root, project)` — backslashes on Windows
// — while `pkey` is `root + '/' + project`. Comparing the two raw is how this
// filter silently never fires, so the key is normalised to pkey's shape here.
function hiddenPkeys(model) {
    const hidden = new Set();
    for (const r of model.registries) {
        const profiles = r.profiles || {};
        for (const dir of Object.keys(profiles)) {
            const values = profiles[dir] && profiles[dir].values;
            if (!values || values['station.hide'] !== true) continue;
            if (dir === r.root) { hidden.add(r.root); continue; }
            const rel = posix(path.relative(r.root, dir));
            hidden.add(r.root + '/' + rel);
        }
    }
    return hidden;
}

// station-57: the running sessions no registry lists, as the page draws them.
// `station.hide` still holds: a session whose cwd is inside a hidden project
// is left off, the way that project's own rows are (hiddenPkeys above). A cwd
// with no profile above it has nothing that could hide it, so it shows.
function unregisteredOf(model, hidden) {
    const tops = [...hidden].map((p) => path.resolve(p));
    const inside = (dir, top) => {
        const rel = path.relative(top, dir);
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    };
    return (model.unregistered || [])
        .filter((u) => !u.cwd || !tops.some((t) => inside(path.resolve(u.cwd), t)))
        .map((u) => ({ id: u.sessionId, cwd: u.cwd, entrypoint: u.entrypoint, name: u.name, status: u.status, bridge: Boolean(u.bridge), started: u.startedAt }));
}

function pkeyOf(session) {
    return session.project ? session.root + '/' + session.project : session.root;
}

// Every registry's sessions in one array, each carrying the root it came from,
// which is what the facets, the charts and the sort all read. `gather` keeps
// its shape: `--json` and the tests read registries there.
function flatten(model) {
    const sessions = [];
    const hidden = hiddenPkeys(model);
    for (const r of model.registries) {
        for (const s of r.sessions) {
            const row = Object.assign({ root: r.root }, s);
            if (hidden.has(pkeyOf(row))) continue;
            sessions.push(row);
        }
    }
    return sessions;
}

// A session's spend when its detail has no `days`, a cache kept from before
// they existed: spent whole, at no stage, on the local day the session started.
// The cache's own `day` is `started` cut to ten characters, a UTC date, and
// `days` counts local ones.
function keptDays(s) {
    const started = Date.parse(s.started);
    return [{
        day: Number.isFinite(started) ? detail.dayOf(started) : null,
        stage: null, model: s.detail.model, who: 'main', tokens: null, cost: null, usd: s.detail.usd,
        estimated: Boolean(s.detail.estimated && s.detail.estimated.length),
    }];
}

// Which option-one wording most often loses. `labels` is in the order the
// question declared, so `labels[0]` is option one — the one whose description
// carries the approval. A wording that keeps losing is a wording to rewrite.
function gateSummary(model, hidden) {
    const lost = new Map();
    const total = new Map();
    for (const r of model.registries) {
        for (const s of r.sessions) {
            // This walks the model rather than `flatten()`'s output, so it
            // carries its own check, the same way `write()`'s detail loop
            // does. A session carries `project` but not `root`, so the pkey
            // has to be rebuilt from the registry it came from.
            if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;
            const events = s.detail && Array.isArray(s.detail.events) ? s.detail.events : [];
            const rows = [];
            for (const e of events) {
                if (e.kind !== 'gate' || !Array.isArray(e.qs)) continue;
                for (const q of e.qs) {
                    rows.push({ first: Array.isArray(q.labels) ? q.labels[0] : null, picked: q.a });
                }
            }
            // `detail` needs the transcript. When it is gone the entry's own
            // `gates` still has the wording, which is why Task 3 put it there:
            // without this the `swapped` denominator quietly shrinks as
            // transcripts age, and the page cannot show that it did.
            if (!rows.length) {
                for (const g of Array.isArray(s.gates) ? s.gates : []) {
                    rows.push({ first: Array.isArray(g.labels) ? g.labels[0] : null, picked: g.picked });
                }
            }
            for (const r of rows) {
                if (typeof r.first !== 'string' || r.picked === null) continue;
                total.set(r.first, (total.get(r.first) || 0) + 1);
                if (r.picked !== r.first) lost.set(r.first, (lost.get(r.first) || 0) + 1);
            }
        }
    }
    const swapped = [...lost.keys()]
        .map((label) => ({ label, lost: lost.get(label), total: total.get(label) }))
        .sort((a, b) => b.lost - a.lost);
    return { swapped };
}

// What the stage cell says for an entry a `/fankeel` prompt wrote and nothing
// has started yet: no task, no route, stage `init`.
const INIT_LABEL = '初始化中';

// The plugin's own version, from its package.json: not the `version` of a
// session row, which is Claude Code's. Absent when there is no plugin
// directory or no readable file.
function pluginVersion(dir) {
    if (!dir) return undefined;
    const got = readObject(path.join(dir, 'package.json'));
    return got && typeof got.version === 'string' ? got.version : undefined;
}

// station-39: what the detailed settings page's agents table and free keys
// draw from — every key's spec, every plugin agent with the model and effort
// its own frontmatter pins, and the agent.* values each profile file holds.
// profile.read drops agent.* keys, so those are read raw from the files.
function profileSpec(model) {
    const agentfile = require('./agentfile.js');
    const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
    const agents = agentfile.agentNames(agentfile.PLUGIN_ROOT).map((name) => {
        let head = '';
        try {
            const m = FRONT.exec(fs.readFileSync(path.join(agentfile.PLUGIN_ROOT, 'agents', name + '.md'), 'utf8'));
            head = m ? m[1] : '';
        } catch (e) {
            // listed a moment ago, gone now: it pins nothing
        }
        const field = (k) => {
            const m = new RegExp('^' + k + ':[ \\t]*(\\S+)', 'm').exec(head);
            return m ? m[1] : null;
        };
        return { name, model: field('model'), effort: field('effort') };
    });
    const raw = (file) => {
        const out = {};
        const o = (file && readObject(file)) || {};
        for (const k of Object.keys(o)) if (agentfile.agentKey(k)) out[k] = String(o[k]);
        return out;
    };
    const projects = {};
    for (const r of model.registries) for (const dir of Object.keys(r.profiles || {})) projects[dir] = raw(profile.projectFile(dir));
    return { keys: profile.KEYS, agents, efforts: agentfile.EFFORTS, set: { machine: raw(profile.machineFile(model.configDir)), projects } };
}

// The one generated file. `opts` carries what only a server knows — whether a
// clear button can post anywhere, the nonce it would post, and the count a
// redirect brought back — so the shell above can stay identical everywhere.
function serialize(model, opts) {
    opts = opts || {};
    const hidden = hiddenPkeys(model);
    const out = {
        generatedAt: model.generatedAt,
        configDir: model.configDir,
        pricesVerified: model.pricesVerified,
        // lib/prices.js's table itself, so the page's component notes read
        // their unit prices from it rather than from figures typed into a
        // station file (station-29).
        prices: prices.perMillion,
        scanStats: model.scanStats || null,
        serve: Boolean(opts.serve),
        projects: model.registries.map((r) => ({
            root: r.root, gone: Boolean(r.gone), unreadable: r.unreadable,
            build: r.build, mapAt: r.mapAt, board: Boolean(r.board),
            docs: (r.docs || []).filter((d) => !hidden.has(d.pkey)),
            todos: (r.todos || []).filter((t) => !hidden.has(t.pkey)),
        })),
        profiles: {
            machine: model.machineProfile || { values: {}, sources: {}, unreadable: [] },
            projects: Object.assign({}, ...model.registries.map((r) => {
                const keep = {};
                for (const dir of Object.keys(r.profiles || {})) {
                    const values = r.profiles[dir] && r.profiles[dir].values;
                    if (values && values['station.hide'] === true) continue;
                    keep[dir] = r.profiles[dir];
                }
                return keep;
            })),
        },
        profileKeys: profile.WIZARD_KEYS,
        profilePresets: profile.PRESETS,
        profileSpec: profileSpec(model),
        gates: gateSummary(model, hidden),
        unregistered: unregisteredOf(model, hidden),
        sessions: flatten(model).map((s) => ({
            id: s.sessionId, root: s.root, project: s.project, task: s.task,
            state: s.state, unknown: s.unknown, stage: s.stage === 'init' && !s.task ? INIT_LABEL : s.stage, route: s.route,
            step: s.step, steps: s.steps, started: s.started, updated: s.updated,
            ended: s.ended, model: s.model, bridge: Boolean(s.bridge),
            effort: s.detail && s.detail.effort ? s.detail.effort : null,
            version: s.version, burn: s.burn, clock: s.clock, waited: s.waited,
            usd: s.cost && s.cost.priced.length ? s.cost.usd : 0,
            agentUsd: s.agentCost && s.agentCost.priced.length ? s.agentCost.usd : 0,
            unpriced: s.cost && s.cost.unpriced ? s.cost.unpriced : [],
            // `usd` and `agentUsd` are both in the figures the page prints, so
            // an id priced from a family on either side marks them.
            estimated: [...new Set([].concat((s.cost && s.cost.estimated) || [], (s.agentCost && s.agentCost.estimated) || []))],
            agents: s.agents ? s.agents.agents : 0,
            requests: s.agents ? s.agents.requests : 0,
            // `w.burn` is the raw two-count pair `data.burn[stage]` carried
            // through unread by `gather()`; reading it apart from `burnOf`
            // let a stage sampled backwards reach the page as a negative
            // number. Wrapping it back into the shape `burnOf` reads reuses
            // the one place that already nulls a spend that is not positive.
            stages: s.stages.map((w) => {
                const b = registry.burnOf({ burn: { [w.stage]: w.burn } }, w.stage);
                return {
                    stage: w.stage, from: w.from, to: w.to,
                    burn: (b == null || b < 0) ? null : b,
                    usd: w.usd, waited: w.waited,
                };
            }),
            claims: s.claims, seen: s.seen || [], notes: s.notes, next: s.next, guard: s.guard, record: s.record || null,
            pending: s.pending || null,
            boards: Array.isArray(s.boards) ? s.boards : [],
            gateAt: s.gateAt, inflight: s.inflight, busy: Boolean(s.busy), subagents: s.subagents || [], shells: s.shells || [],
            tune: s.tune || null,
            backtracks: s.backtracks,
            hasDetail: Boolean(s.detail), peak: s.detail ? s.detail.peak : null,
            // How many of a live session's agents are running now, for the
            // list; null for a row that is not live or has no detail to count.
            running: s.state === 'live' && s.states ? Object.keys(s.states).filter((k) => s.states[k] === 'running').length : null,
            // What the overview and the project page add up, so neither loads a
            // detail file.
            days: !s.detail ? null : Array.isArray(s.detail.days) ? s.detail.days : keptDays(s),
            spans: s.detail && Array.isArray(s.detail.spans) ? s.detail.spans : null,
            // A project is a registry root and the session's `project` under it.
            pkey: s.project ? s.root + '/' + s.project : s.root,
        })),
    };
    // The three classes' routes by name, so the overview can group sessions by
    // route and call a route a class names by that class's name.
    out.classes = Object.fromEntries(Object.entries(CLASSES).map(([name, c]) => [name, c.route]));
    if (opts.nonce) out.nonce = opts.nonce;
    if (opts.plugin) out.plugin = opts.plugin;
    const fankeel = pluginVersion(opts.plugin);
    if (fankeel) out.fankeel = fankeel;
    if (Number.isFinite(opts.cleared)) out.cleared = opts.cleared;
    return 'window.STATION = ' + JSON.stringify(out) + ';\n';
}

// The background shells under one session (lib/shells.js): running first, at
// most three. Asked, like `agentsNow`, only for a session whose process runs.
// Required here rather than at the top so this file's edit stays in one span.
function shellsNow(configDir, sessionId) {
    const shells = require('./shells.js');
    const transcript = detail.transcriptOf(configDir, sessionId);
    return transcript ? shells.shellsOf(transcript, shells.tasksDirOf(transcript, sessionId)) : [];
}

// One session's detail as the script the panel loads when that session is
// opened, `station/detail/<id>.js`. Kept out of `station-data.js`, which every
// `/fankeel` prompt rewrites: a hundred sessions' replays in it would be
// megabytes rewritten per prompt for the one panel open at a time. The tasks
// ride along uncached, because the ledger moves without the transcript.
function serializeDetail(s) {
    // The agents' states and the running process's start ride along uncached
    // too: they move with liveness, not with the transcript. A static detail
    // file keeps the states of the moment it was written; the page reads
    // `lost` for a `running` one once the list says the session is not live.
    const body = Object.assign({}, s.detail, { tasks: s.tasks || [], states: s.states || {}, since: s.since || null, gate: s.gate || null, shells: s.shells || [] });
    return 'window.STATION_DETAIL = window.STATION_DETAIL || {};\n'
        + 'window.STATION_DETAIL[' + JSON.stringify(s.sessionId) + '] = ' + JSON.stringify(body) + ';\n';
}

// docs/90-agent/plans/2026-10-21-station-focus-design.md §1: the focus page,
// one session's plan or gate alone. `gather()` costs about a second because it
// reads every session and every transcript; the focus page needs one entry,
// its claimed plans with their ledgers, and its newest handoff. The row has
// gather()'s shape so `serialize` writes it as station-data.js would, with
// what only a transcript or a liveness scan knows left empty.
function focusRowOf(root, sessionId, data) {
    const at = positionIn(data.route, data.stage) || {};
    return {
        root,
        sessionId, boardDir: null, boards: [],
        state: data.active !== true ? 'down' : 'live',
        unknown: false,
        task: typeof data.task === 'string' ? data.task : '',
        project: registry.projectOf(data) || '',
        stage: typeof data.stage === 'string' ? data.stage : '',
        route: Array.isArray(data.route) ? data.route : [],
        step: at.step || 0,
        steps: at.steps || 0,
        started: typeof data.started === 'string' ? data.started : null,
        updated: registry.updatedAt(data),
        ended: data.ended && typeof data.ended === 'object' ? data.ended : null,
        model: typeof data.model === 'string' ? data.model : null,
        version: typeof data.version === 'string' ? data.version : null,
        usage: null, cost: null, agents: null, agentCost: null, burn: null,
        gates: Array.isArray(data.gates) ? data.gates : null,
        stages: [], clock: null, waited: null,
        claims: registry.claimsOf(data), seen: registry.seenOf(data),
        pending: null,
        gateAt: Number.isFinite(data.gateAt) ? data.gateAt : null,
        inflight: null, busy: false, subagents: [], tune: null,
        notes: registry.notesOf(data), next: registry.nextOf(data),
        record: recordOf(data),
        guard: typeof data.guard === 'string' ? data.guard : '',
        configDir: typeof data.configDir === 'string' ? data.configDir : '',
        detail: null, detailFresh: false, since: null, states: null,
        backtracks: detail.backtracksOf(detail.stageSequence([], data), data.route).length,
    };
}

// Every file `focusOf` read, each with its mtime: the entry, the directory the
// stage's handoff is looked for in (a new lap or group file changes it), each
// claimed plan where it may sit and its ledger, and the report it found.
function focusKey(root, id, data, gate) {
    const files = [registry.sessionPath(root, id)];
    const plain = handoff.handoffPath(root, data, data.stage);
    if (plain) files.push(path.dirname(plain));
    for (const claim of registry.claimsOf(data)) {
        if (!/\.md$/.test(claim)) continue;
        files.push(path.resolve(root, claim), ledger.ledgerPath(root, claim));
        if (data.project) files.push(path.resolve(root, data.project, claim));
    }
    if (gate && gate.path) files.push(path.resolve(root, gate.path));
    return files.map((f) => {
        let at = '-';
        try { at = String(fs.statSync(f).mtimeMs); } catch (e) { /* not there: its absence is the key */ }
        return f + '@' + at;
    }).join('|');
}

// One session's row and detail, or null for an id with no entry here. `memo`
// is the server's, held across requests: an answer is reused while every file
// it was read from keeps its mtime.
function focusOf(root, id, opts) {
    opts = opts || {};
    if (!registry.sessionPath(root, id)) return null;
    const memo = opts.memo instanceof Map ? opts.memo : null;
    const slot = root + '|' + id;
    const hit = memo ? memo.get(slot) : null;
    // Shells change without any file focusKey stats changing, so they are read
    // on every call (design §5); the held answer is reused only while they match.
    const shellsFor = (d) => (d.active === true ? shellsNow(typeof d.configDir === 'string' ? d.configDir : '', id) : []);
    // The held gate moves with the hook, not with any file focusKey stats: read on every call like the shells.
    const pendingFor = (d) => (d.active === true ? handoff.readPending(root, d) : null);
    // Set in place: a memo hit still answers the same object (tests/station-focus.test.js:55).
    const withPending = (o, d) => { o.row.pending = pendingFor(d); return o; };
    if (hit && hit.key === focusKey(root, id, hit.data, hit.out.detail.gate)) {
        const shells = shellsFor(hit.data);
        if (JSON.stringify(shells) === JSON.stringify(hit.out.detail.shells)) return withPending(hit.out, hit.data);
        hit.out = { row: hit.out.row, detail: Object.assign({}, hit.out.detail, { shells }) };
        return withPending(hit.out, hit.data);
    }
    const data = registry.readSession(root, id);
    if (!data) {
        if (memo) memo.delete(slot);
        return null;
    }
    const gate = gatereport.read(root, data);
    const out = {
        row: focusRowOf(root, id, data),
        detail: { tasks: detail.tasksOf(root, data, []), gate, states: {}, since: null, shells: shellsFor(data) },
    };
    if (memo) memo.set(slot, { key: focusKey(root, id, data, gate), data, out });
    return withPending(out, data);
}

// The focus script: `window.STATION` as station-data.js writes it, holding the
// one row, and the row's detail where `station/detail/<id>.js` would put it.
function serializeFocus(root, focus, opts) {
    opts = opts || {};
    const model = {
        generatedAt: new Date(Number.isFinite(opts.now) ? opts.now : Date.now()).toISOString(),
        configDir: String(opts.configDir == null ? '' : opts.configDir),
        pricesVerified: prices.verified,
        registries: [{ root, gone: false, unreadable: 0, build: [], mapAt: null, board: false, sessions: [focus.row], profiles: {}, docs: [], todos: [] }],
        machineProfile: null,
        scanStats: null,
    };
    return serialize(model, opts) + serializeDetail(Object.assign({ sessionId: focus.row.sessionId }, focus.detail));
}

// The tabs the focus page draws; scripts/station.js sends any other to the full station.
const FOCUS_TABS = ['plan', 'gate'];

// The focus page's HTML. Absolute asset paths: it is served at /f/<id>/<tab>,
// two directories below the station's own index. The data script goes before
// station.js, which reads `window.STATION` the moment it runs.
function focusShell(id, tab) {
    if (typeof id !== 'string' || !/^[0-9A-Za-z-]+$/.test(id) || !FOCUS_TABS.includes(tab)) return null;
    return '<!doctype html>\n<html lang="zh-Hant" data-style="keel"><head><meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        + '<title>fankeel ' + tab + ' · ' + id.slice(0, 8) + '</title>\n'
        + '<link rel="stylesheet" href="/station/station.css">\n'
        + '<link rel="stylesheet" href="/station/tip.css">\n'
        + '<link rel="stylesheet" href="/station/diagram.css">\n'
        + '<link rel="stylesheet" href="/station/gate-frame.css">\n'
        + '<link rel="stylesheet" href="/station/board-edit.css">\n'
        + '</head><body class="focus">\n<div id="focus"></div>\n'
        + '<script>window.STATION_FOCUS = ' + JSON.stringify({ id, tab }) + ';</script>\n'
        + '<script src="/station/focus/' + id + '.js"></script>\n'
        + '<script src="/station/i18n.js"></script>\n'
        + '<script src="/station/tip.js"></script>\n'
        + '<script src="/station/diagram.js"></script>\n'
        + '<script src="/station/board-edit.js"></script>\n'
        + '<script src="/station/gate-frame.js"></script>\n'
        + '<script src="/station/focus-page.js"></script>\n'
        + '<script src="/station/station.js"></script>\n'
        + '</body></html>\n';
}

// `render` keeps its name and its two callers, and now returns the shell. It
// takes the model so the signature does not change under `scripts/station.js`,
// and ignores it: nothing about a machine reaches this file any more.
function render() {
    return fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
}

// Carried through unchanged. It sat inside the span above because `render()`
// counted the header from it; `write()` still counts its return value from it,
// so deleting it with its neighbours would leave `counts` undefined at `:892`.
function tally(model, hidden) {
    const counts = { live: 0, stale: 0, down: 0 };
    for (const r of model.registries) {
        for (const s of r.sessions) {
            if (hidden.has(s.project ? r.root + '/' + s.project : r.root)) continue;
            counts[s.state]++;
        }
    }
    return counts;
}

function stationPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'index.html');
}

// Ten names — the last a directory — in one place, because `.gitignore` and the writer disagreeing is
// how a generated file gets committed. Constraint: `ensureIgnored` appends only
// what is missing, so growing this list is safe on a registry that already has
// the old single line.
// The shell's modules, read off assets/station/index.html — the one list
// (station-52): every `<script src="station/…">` but i18n.js and
// station.js, every stylesheet but station.css, and gate-frame, board-edit and focus-page, which only
// the focus shell loads. tests/station-module-lists.test.js holds the three
// places that list them to one another. `modulesOf` is the reading itself, so
// lib/serve.js `diskFingerprint` reads a shell on disk the same way (station-55).
function modulesOf(shell) {
    const text = String(shell == null ? '' : shell);
    return [
        ...[...text.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]).filter((n) => n !== 'i18n.js' && n !== 'station.js'),
        ...[...text.matchAll(/<link rel="stylesheet" href="station\/([^"]+)">/g)].map((m) => m[1]).filter((n) => n !== 'station.css'),
        'gate-frame.js', 'gate-frame.css', 'board-edit.js', 'board-edit.css', 'focus-page.js', 'vendor/pele.js'];
}
const SHELL = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const MODULES = modulesOf(SHELL);
const EMITTED = ['index.html', 'station/station.css', 'station/station.js', 'station/i18n.js', ...MODULES.map((n) => 'station/' + n), 'station/station-data.js', 'station/detail'];

// What one write spends on transcripts at most; see `until` in `gather()`. The
// CLI passes `Infinity`, and `serve` passes nothing: a person who typed a
// command can wait for it.
const DETAIL_BUDGET_MS = 1500;

function write(opts) {
    const configDir = String(opts.configDir == null ? '' : opts.configDir);
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const model = gather(Object.assign({ detailBudgetMs: DETAIL_BUDGET_MS }, opts, { now }));
    const html = render();
    const dir = path.dirname(stationPath(configDir));
    fs.mkdirSync(dir, { recursive: true });
    const data = serialize(model, { plugin: opts.plugin });
    const hidden = hiddenPkeys(model);
    // The eight copied files are compared before they are written, so a prompt
    // that changed nothing rewrites one file rather than nine. `hooks/inject.js`
    // calls this on every prompt.
    const emit = (into) => {
        fs.mkdirSync(path.join(into, 'station', 'vendor'), { recursive: true });
        const same = (file, text) => {
            try {
                return fs.readFileSync(file, 'utf8') === text;
            } catch (e) {
                return false;
            }
        };
        for (const [name, text] of [
            ['index.html', html],
            ['station/station.css', fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8')],
            ['station/station.js', fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8')],
            ['station/i18n.js', fs.readFileSync(path.join(ASSETS, 'i18n.js'), 'utf8')],
            ...MODULES.map((n) => ['station/' + n, fs.readFileSync(path.join(ASSETS, n), 'utf8')]),
        ]) {
            const at = path.join(into, name);
            if (!same(at, text)) fs.writeFileSync(at, text);
        }
        fs.writeFileSync(path.join(into, 'station', 'station-data.js'), data);
        // One script per session that has a detail, written when it was read
        // just now or is missing here — so an ended session's is written once.
        const details = path.join(into, 'station', 'detail');
        fs.mkdirSync(details, { recursive: true });
        for (const r of model.registries) {
            for (const s of r.sessions) {
                if (!s.detail) continue;
                if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;
                const at = path.join(details, s.sessionId + '.js');
                if (s.detailFresh || !fs.existsSync(at)) fs.writeFileSync(at, serializeDetail(s));
            }
        }
    };
    emit(dir);
    const file = stationPath(configDir);
    // The copy beside the user, and only into a registry that exists: a caller
    // handing over its launch directory must not grow a `.fankeel/` there.
    let copy = null;
    const root = opts.root ? resolved(opts.root) : null;
    if (root && hasRegistry(root)) {
        try {
            registry.ensureIgnored(root, ['index.html', 'station/']);
            const into = path.join(root, '.fankeel');
            emit(into);
            copy = path.join(into, 'index.html');
        } catch (e) {
            copy = null;
        }
    }
    try {
        rememberRoots(configDir, model.registries, now);
    } catch (e) { /* housekeeping; the page is written, the memory catches up next time */ }
    const counts = tally(model, hidden);
    return {
        file,
        copy,
        registries: model.registries.filter((r) => !r.gone).length,
        live: counts.live,
        stale: counts.stale,
        down: counts.down,
        hidden: hidden.size,
    };
}

module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, boardPath, rememberRoots, EMITTED, MODULES, modulesOf, hiddenPkeys, parseMapCard, DETAIL_BUDGET_MS, focusOf, serializeFocus, focusShell, FOCUS_TABS, todoOf, tuneOf };
