'use strict';

// Where a stage agent leaves its report, and where the user's answer to its
// gate is left for it. One directory per task, keyed by `started`: `task.js
// adopt` carries it over (`started: source.started`) and `task` keeps it, so a
// renamed or adopted task keeps its handoffs. docs/archive/2026-09-19-survey-brain-design.md §5.

const fs = require('node:fs');
const path = require('node:path');

function dirFor(root, data) {
    const started = data && typeof data.started === 'string' ? data.started : '';
    const stamp = started.replace(/[-:]/g, '').slice(0, 15);
    if (!root || !/^\d{8}T\d{6}$/.test(stamp)) return null;
    return path.join(root, '.fankeel', 'build', 'task-' + stamp).replace(/\\/g, '/');
}

// A rename keeps `started`, so the new task's files sit in the old task's directory.
// `lapped` is the highest lap the old task used, written by `task.js task`; the new
// task's laps are numbered from there. 0 for a task that was never renamed.
const lappedOf = (data) => (data && Number.isInteger(data.lapped) && data.lapped > 0 ? data.lapped : 0);

// How many times a task has entered `stage`, counted from the registry's `moves` — the
// order it entered stages in, stamped by `task.js stage` before anything is dispatched,
// so the visit in progress is already in it.
const visitsOf = (data, stage) => (data && Array.isArray(data.moves) ? data.moves : [])
    .filter((m) => Array.isArray(m) && m[0] === stage).length;

// The lap of a stage: `lapped` plus its visits, and at least the first. `moves` keeps the
// newest 60, so a stage entered more often than that within them repeats a number: a
// known limit, not handled.
function lapOf(data, stage) {
    return lappedOf(data) + Math.max(1, visitsOf(data, stage));
}

// The highest lap number this record has used, for `task.js task` to store as `lapped`
// before it forgets `moves`. At least 1: a record with no moves may still have written
// the first lap of its stage.
function lapsUsed(data) {
    const moves = data && Array.isArray(data.moves) ? data.moves : [];
    const most = Math.max(0, ...moves.filter(Array.isArray).map((m) => visitsOf(data, m[0])));
    return lappedOf(data) + Math.max(1, most);
}

// The first visit keeps the name a stage has always had; the n-th, n >= 2, is
// `<stage>-<n>`, so a return to a stage is a file of its own and never the last lap's.
function fileFor(root, data, stage, suffix) {
    const dir = dirFor(root, data);
    if (!dir || !stage) return null;
    const lap = lapOf(data, stage);
    return dir + '/' + stage + (lap > 1 ? '-' + lap : '') + suffix;
}

function handoffPath(root, data, stage) {
    return fileFor(root, data, stage, '.md');
}

function commitPath(root, data, stage) {
    return fileFor(root, data, stage, '-commit.md');
}

function answerPath(root, data, stage) {
    return fileFor(root, data, stage, '-answer.md');
}

// The build stage's own ledger directory — `.fankeel/build/<plan file's
// basename>/`, the same path `ledgerPath` in lib/ledger.js keys `progress.md`
// under — with `<stage>-commit.md` in it instead. A stage agent following the
// build skill's own convention (that is where its task briefs, `progress.md`
// and every `task-N-brief.md` already live) can write its commit file there
// out of habit rather than at the exact path `commitPath()` named. On
// 2026-09-23 the build stage's brain did exactly that, four times in a row,
// and `scripts/await.js` never once caught the `commit` state because it only
// ever looked at `commitPath()`'s task-stamp directory.
// docs/reports/2026-09-23-brain-wakeup.md.
function ledgerCommitPath(root, planFile, stage) {
    if (!root || !planFile || !stage) return null;
    const base = path.basename(String(planFile), '.md');
    if (!base) return null;
    return path.join(root, '.fankeel', 'build', base, stage + '-commit.md').replace(/\\/g, '/');
}

// The last `json gate` block in the report. The last, because a stage agent
// sent back rewrites its report, and a stale block above the new one must not
// win. Null for anything that is not a list of questions: the gate hook then
// leaves the question alone, which is all it did before this file existed.
const BLOCK = /`{3}json gate\r?\n([\s\S]*?)\r?\n`{3}/g;

// Terminal columns rather than characters: a CJK or full-width character takes
// two. Moved here from scripts/todo-check.js so readGate can hold a gate's
// header to AskUserQuestion's cap; todo-check imports it back.
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

function width(s) {
    let n = 0;
    for (const c of String(s).replace(/`/g, '')) n += WIDE.test(c) ? 2 : 1;
    return n;
}

// AskUserQuestion's own cap: twelve characters, six in CJK.
const MAX_HEADER_WIDTH = 12;

// The first field of a gate AskUserQuestion would reject, as a path into it
// with the measured reason beside it, or null. `next` undefined skips option
// one; a string is the stage option one must name; null is the route's end,
// where option one stands the task down. The reason is what the deny quotes:
// "missing or wrong" sent a stage agent back twice on 2026-09-23 for a header
// that was sixteen columns wide.
function gateProblem(gate, next) {
    for (const [i, q] of gate.questions.entries()) {
        const at = 'questions[' + i + '].';
        if (!q || typeof q.header !== 'string' || !q.header.trim()) return { at: at + 'header', detail: 'header is missing or empty' };
        const w = width(q.header);
        if (w > MAX_HEADER_WIDTH) {
            return { at: at + 'header', detail: 'header "' + q.header + '" is ' + w + ' columns, ' + MAX_HEADER_WIDTH + ' is the cap (a CJK character counts two)' };
        }
        if (typeof q.question !== 'string' || !q.question.trim()) return { at: at + 'question', detail: 'question is missing or empty' };
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
            return { at: at + 'options', detail: 'options must be 2 to 4, found ' + (Array.isArray(q.options) ? q.options.length : 'none') };
        }
        for (const [j, o] of q.options.entries()) {
            if (!o || typeof o.label !== 'string' || !o.label.trim() || typeof o.description !== 'string') {
                return { at: at + 'options[' + j + ']', detail: 'option ' + (j + 1) + ' needs a label and a description' };
            }
        }
        if ('multiSelect' in q && typeof q.multiSelect !== 'boolean') return { at: at + 'multiSelect', detail: 'multiSelect must be true or false' };
    }
    if (next !== undefined) {
        const label = gate.questions[0].options[0].label;
        const want = next ? [String(next).toLowerCase()] : ['down', '收工'];
        if (!want.some((w) => label.toLowerCase().includes(w))) {
            return { at: 'questions[0].options[0].label', detail: 'option one "' + label + '" names none of: ' + want.join(', ') };
        }
    }
    return null;
}

function readGate(file, next) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    let last = null;
    for (const m of text.matchAll(BLOCK)) last = m[1];
    if (last === null) return null;
    let gate;
    try { gate = JSON.parse(last); } catch (e) { return null; }
    if (!gate || !Array.isArray(gate.questions) || !gate.questions.length) return null;
    // `next` rides along so a pause (`task.js next --from-gate`) still works on
    // a gate the user cannot be shown.
    const bad = gateProblem(gate, next);
    return bad ? { invalid: bad.at, detail: bad.detail, next: gate.next } : gate;
}

// The `reads:` block a report ends with: one `<path> — <why>` per line, from the last
// line that is exactly `reads:` to the next blank line or fence. The last, for the reason
// `readGate` reads the last block: a rewritten report can carry an older one above it.
function readsOf(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
    const marks = [...text.matchAll(/^reads:[ \t]*$/gm)];
    if (!marks.length) return [];
    const out = [];
    for (const raw of text.slice(marks[marks.length - 1].index).split(/\r?\n/).slice(1)) {
        const l = raw.trim();
        if (!l || l.startsWith('```')) break;
        out.push(l.replace(/^[-*]\s+/, ''));
    }
    return out;
}

// The newest report an earlier stage left for the stage being entered: walk `moves` back
// from the entry before the current one and take the first stage whose report is on disk.
// Each entry is judged as of its own lap, so `moves` is cut at that entry. Null when
// nothing exists — a route whose earlier stages ran in the session itself.
function previousHandoff(root, data) {
    const moves = (data && Array.isArray(data.moves) ? data.moves : []).filter((m) => Array.isArray(m) && typeof m[0] === 'string');
    for (let i = moves.length - 2; i >= 0; i--) {
        const file = handoffPath(root, { started: data.started, lapped: data.lapped, moves: moves.slice(0, i + 1) }, moves[i][0]);
        if (file && fs.existsSync(file)) return file;
    }
    return null;
}

function writeAnswer(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(text));
}

// A file's mtime in milliseconds, or null when there is no such file.
function mtimeOf(file) {
    try { return fs.statSync(file).mtimeMs; } catch (e) { return null; }
}

// One or more candidate commit files, flattened and with the empty ones dropped —
// `commit` is a bare path everywhere this file predates 2026-09-23, and an array
// where a caller also has a ledger-convention candidate to watch for.
function commitFiles(commit) {
    return (Array.isArray(commit) ? commit : [commit]).filter(Boolean);
}

// The newest of a set of candidate commit files with mtime strictly after `since`,
// or null when none qualifies. This is what actually landed, so a caller that only
// knows the state is `commit` can still name the one file to run `commit.js` on.
function newestCommit(commit, since) {
    let best = null;
    for (const file of commitFiles(commit)) {
        const at = mtimeOf(file);
        if (at !== null && at > (since || 0) && (!best || at > best.at)) best = { file, at };
    }
    return best ? best.file : null;
}

// The newest of `started` and every file's mtime: when the stage agent, or an
// agent it dispatched, last wrote a line. Its own transcript alone stands still
// while it waits on a child — 52 seconds without a tool call on 2026-09-23 —
// so the caller passes the whole subagents directory, not one file.
function lastActivity(files, started) {
    return Math.max(started || 0, ...files.map(mtimeOf).filter((t) => t !== null));
}

// What a controller waiting on its stage agent does next, read off the disk
// alone, or null while none of it holds. In order: `commit` — a commit file
// written after `since` (scripts/commit.js renames the file once it has
// committed it, so one on disk is a commit nobody has made yet) — `commit` may
// be a bare path or an array of candidate paths, so a stage agent that wrote to
// a different convention than the exact one it was told still wakes the
// controller; `handoff` — the report written after `since`; `lost` — neither,
// and nothing in `activity` has moved for `idleMs`. An empty `activity` is an
// agent nobody can see, and never reads as lost. `now` and `started` are
// passed in, so a test sets the clock rather than waiting two minutes for it.
// docs/plans/2026-09-23-controller-await-design.md §1.
function awaitState(o) {
    const since = o.since || 0;
    if (newestCommit(o.commit, since)) return 'commit';
    const handoff = mtimeOf(o.handoff);
    if (handoff !== null && handoff > since) return 'handoff';
    const activity = o.activity || [];
    if (activity.length && o.now - lastActivity(activity, o.started) >= o.idleMs) return 'lost';
    return null;
}

// Resolves with what `awaitState` says, or `timeout` after `timeoutMs`. Nothing
// here loops: a change in the handoff's directory, or any commit candidate's
// directory, wakes it (fs.watch), and so does one timer set for the moment the
// agent would count as lost — which reads the disk again and re-arms rather
// than trusting its own arithmetic. The first check runs before anything is
// watched, because the file may already be there. `activity` is a function
// returning paths, so an agent the stage agent dispatches after the wait began
// is counted too.
function awaitHandoff(o) {
    const started = Date.now();
    const files = () => (o.activity ? o.activity() : []);
    return new Promise((resolve) => {
        const watchers = [];
        let idle = null;
        let done = false;
        const finish = (state) => {
            if (done) return;
            done = true;
            for (const w of watchers) w.close();
            clearTimeout(idle);
            clearTimeout(hard);
            resolve(state);
        };
        const check = () => {
            if (done) return;
            const activity = files();
            const state = awaitState({ handoff: o.handoff, commit: o.commit, since: o.since, activity, idleMs: o.idleMs, started, now: Date.now() });
            if (state) return finish(state);
            clearTimeout(idle);
            if (activity.length) idle = setTimeout(check, Math.max(0, lastActivity(activity, started) + o.idleMs - Date.now()) + 1);
        };
        const hard = setTimeout(() => finish('timeout'), o.timeoutMs);
        const dirs = new Set([path.dirname(o.handoff), ...commitFiles(o.commit).map((f) => path.dirname(f))]);
        for (const dir of dirs) {
            fs.mkdirSync(dir, { recursive: true });
            const w = fs.watch(dir, check);
            w.on('error', () => finish('timeout'));
            watchers.push(w);
        }
        check();
    });
}

module.exports = { handoffPath, commitPath, answerPath, ledgerCommitPath, readGate, writeAnswer, lapsUsed, readsOf, previousHandoff, width, awaitState, awaitHandoff, newestCommit };
