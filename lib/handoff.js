'use strict';

// Where a stage agent leaves its report, and where the user's answer to its
// gate is left for it. One directory per task, keyed by `started`: `task.js
// adopt` carries it over (`started: source.started`) and `task` keeps it, so a
// renamed or adopted task keeps its handoffs. docs/archive/2026-09-19-survey-brain-design.md §5.

const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const { isDeepStrictEqual } = require('node:util');

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
// `lap`, when given, is used as it is rather than recomputed from `moves`: the
// lap a stage agent was briefed with, read back off its in-flight mark, stays
// the lap its files carry even after `moves` gains an entry. `group`, when a
// positive integer, adds `-g<N>` after the lap suffix and before the
// extension: a build running several brains at once names each one's file
// for it (`build-g2.md`), and the closing brain's own report, with no
// group, keeps the plain name every other stage already uses.
function fileFor(root, data, stage, suffix, lap, group) {
    const dir = dirFor(root, data);
    if (!dir || !stage) return null;
    const n = Number.isInteger(lap) && lap > 0 ? lap : lapOf(data, stage);
    const g = Number.isInteger(group) && group > 0 ? '-g' + group : '';
    return dir + '/' + stage + (n > 1 ? '-' + n : '') + g + suffix;
}

function handoffPath(root, data, stage, lap, group) {
    return fileFor(root, data, stage, '.md', lap, group);
}

function commitPath(root, data, stage, lap, group) {
    return fileFor(root, data, stage, '-commit.md', lap, group);
}

function answerPath(root, data, stage, lap) {
    return fileFor(root, data, stage, '-answer.md', lap);
}

// The task's exchange of verified facts — `scripts/context.js` is its only
// writer. Beside the handoffs and not per stage: a fact read in build is as
// true in verify, until HEAD moves past the sha it was read at.
function contextPath(root, data) {
    const dir = dirFor(root, data);
    return dir ? dir + '/context.md' : null;
}

// Where hooks/budget.js tells a subagent nearing HARD to write its progress
// before every further tool call is refused, and where the brain that
// dispatched it looks for that file to hand the rest of the task to a fresh
// agent (design §3). One file per agent, not per task: two subagents in the
// same task hitting HARD at once must not overwrite each other's relay.
function relayPath(root, data, agentId) {
    const dir = dirFor(root, data);
    const id = String(agentId || '').trim();
    return dir && id ? dir + '/relay-' + id + '.md' : null;
}

// Where hooks/gate.js leaves the questions it is holding for the station, for
// as long as it holds them. `gate.station` in lib/profile.js.
function pendingPath(root, data, stage) {
    return fileFor(root, data, stage, '-pending.json');
}

// The questions a hook is holding for this session's current stage, or null:
// no file, one that does not parse, or one whose `until` has passed — a hook
// killed mid-wait leaves its file behind, and a stale one is no gate.
function readPending(root, data, now) {
    const file = pendingPath(root, data, data && data.stage);
    if (!file) return null;
    const got = readObject(file);
    if (!got || !Array.isArray(got.questions) || !(got.until > (now || Date.now()))) return null;
    return { questions: got.questions, until: got.until, at: Number.isFinite(got.at) ? got.at : null };
}

// The `answers` written to `file` after `since`, or null. hooks/resume.js
// writes the same file after every controlled gate, so one older than the
// wait is an earlier gate's answer, never this one's.
function answersSince(file, since) {
    const at = mtimeOf(file);
    if (at === null || at <= since) return null;
    const got = readObject(file);
    const a = got && got.answers;
    return a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length ? a : null;
}

// Every question an earlier stage's gate put to the user, with what the user
// answered, read from the `<stage>-answer.md` files hooks/resume.js writes on
// this task's route. Route order, then lap order; only the newest lap of the
// stage being worked is left out, since that gate has not been answered yet;
// that stage's earlier laps are still read. `stale` is true when that lap's handoff file is newer than its answer:
// the stage agent rewrote its report after the user answered, so the gate may
// be a different question now. An answer file that is not JSON, or holds no
// `answers` object, contributes nothing.
// `lead` is true for the routing question a gate opened with beside others
// (`questions[0]` of a file with more than one question). A gate that asked
// one question has no routing question: its re-ask is a repeat.
function answeredOf(root, data) {
    const route = data && Array.isArray(data.route) ? data.route.filter((s) => typeof s === 'string') : [];
    const out = [];
    for (const stage of [...new Set(route)]) {
        const last = lapOf(data, stage);
        for (let lap = 1; lap <= last; lap++) {
            if (stage === data.stage && lap === last) continue;
            const file = answerPath(root, data, stage, lap);
            const at = file ? mtimeOf(file) : null;
            if (at === null) continue;
            const got = readObject(file);
            const answers = got && got.answers;
            if (!answers || typeof answers !== 'object' || Array.isArray(answers)) continue;
            const report = mtimeOf(handoffPath(root, data, stage, lap));
            const stale = report !== null && report > at;
            // The question the gate opened with: its routing question, about
            // that gate's moment and nothing a later gate asks.
            const head = Array.isArray(got.questions) && got.questions.length > 1 && got.questions[0] && typeof got.questions[0].question === 'string'
                ? got.questions[0].question : null;
            for (const [question, value] of Object.entries(answers)) {
                out.push({ stage, question, answer: Array.isArray(value) ? value.join(', ') : String(value), stale, lead: question === head });
            }
        }
    }
    return out;
}

// The page's 「交給終端／手機」: `{ "handoff": "terminal" }` written to the
// answer file after `since`. hooks/gate.js stops waiting on it, and the
// question reaches the terminal as it would on a timeout.
function handedOffSince(file, since) {
    const at = mtimeOf(file);
    if (at === null || at <= since) return false;
    const got = readObject(file);
    return !!got && got.handoff === 'terminal';
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

// MAX_LABEL_WIDTH used to live here: a cap on option label width, bounding a
// hook `updatedInput` substitution that this file no longer performs (commits
// 77c3d767..b3b7e1a8). The controller types the gate itself now, so nothing
// here substitutes, and the width that mattered only to that mechanism is gone.

// And its other cap: four questions in one call.
const MAX_QUESTIONS = 4;

// gate-2, docs/90-agent/plans/2026-09-30-init-design.md §6. A gate the user
// can stop at names a pause among its options, and a gate on a task started at
// a class offers no lighter one: going lighter is a new task the user starts.
// Both are asked only when a caller passes `rules`. Today only
// hooks/gate-write.js and hooks/gate.js (:199) do, so a
// pause read back by `task.js next` is unchanged.
const PAUSE = /暫停|pause|停下|先停/i;
// Lightest first, the order lib/stages.js's CLASSES lists them in.
const CLASS_ORDER = ['spike', 'bounded', 'architectural'];
// gate-4: the stage rule (lib/stages.js ALWAYS[0]) asks three options at least
// on the gate's own question — the approval, the open decision or none, and the
// pause. Only the first question: a survey's per-entry questions keep 2 to 4
// (skills/fankeel-survey/SKILL.md). Asked only with `rules`, after the pause.
const MIN_FIRST_OPTIONS = 3;

function ruleProblem(gate, rules) {
    if (rules.pause && !gate.questions.some((q) => q.options.some((o) => PAUSE.test(o.label)))) {
        return { at: 'questions', detail: 'no option says pause (暫停, pause, 停下 or 先停), so the user cannot stop at this gate' };
    }
    const first = gate.questions[0].options.length;
    if (first < MIN_FIRST_OPTIONS) {
        return { at: 'questions[0].options', detail: 'the first question has ' + first + ' options, ' + MIN_FIRST_OPTIONS + ' at least: the approval, the open decision or none, and the pause' };
    }
    const floorAt = rules.floor ? CLASS_ORDER.indexOf(String(rules.floor).toLowerCase()) : -1;
    const lighter = floorAt > 0 ? CLASS_ORDER.slice(0, floorAt) : [];
    for (const [i, q] of gate.questions.entries()) {
        for (const [j, o] of q.options.entries()) {
            const hit = lighter.find((c) => new RegExp('(^|[^a-z])' + c + '([^a-z]|$)', 'i').test(o.label));
            if (hit) {
                return {
                    at: 'questions[' + i + '].options[' + j + '].label',
                    detail: 'option "' + o.label + '" names ' + hit + ', below this task\'s floor ' + rules.floor + ' — a lighter route is a new task the user starts',
                };
            }
        }
    }
    return null;
}

// The first field of a gate AskUserQuestion would reject, as a path into it
// with the measured reason beside it, or null. `next` undefined skips option
// one; a string is the stage option one must name; null is the route's end,
// where option one stands the task down. The reason is what the deny quotes:
// "missing or wrong" sent a stage agent back twice on 2026-09-23 for a header
// that was sixteen columns wide. `route`, when given, is the task's own route,
// and option one may name any stage on it.
function gateProblem(gate, next, route, rules) {
    if (gate.questions.length > MAX_QUESTIONS) {
        return { at: 'questions', detail: gate.questions.length + ' questions, ' + MAX_QUESTIONS + ' is the cap' };
    }
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
            // `preview` is what the host shows beside a single-select option
            // while it is being considered; a multiSelect question shows none,
            // so a gate carrying one there is a gate written for a different
            // question. 2026-09-24 design §2.
            if ('preview' in o) {
                if (q.multiSelect === true) return { at: at + 'options[' + j + '].preview', detail: 'preview is not supported on a multiSelect question' };
                if (typeof o.preview !== 'string' || !o.preview.trim()) return { at: at + 'options[' + j + '].preview', detail: 'preview must be a non-empty string' };
            }
        }
        if ('multiSelect' in q && typeof q.multiSelect !== 'boolean') return { at: at + 'multiSelect', detail: 'multiSelect must be true or false' };
    }
    // A gate the user cannot pause on: `task.js next --from-gate` takes the
    // pause line from `next`, and none is nothing to take.
    if (typeof gate.next !== 'string' || !gate.next.trim()) return { at: 'next', detail: 'no pause option' };
    if (next !== undefined) {
        const label = gate.questions[0].options[0].label;
        const want = next ? [String(next).toLowerCase()] : ['down', '收工'];
        // A route-back: option one may name any stage on this task's own route,
        // verify sending the work back to build, but never a stage the route
        // does not have. 2026-09-23's "退回 build" was refused without this.
        const back = Array.isArray(route) ? route.map((s) => String(s).toLowerCase()) : [];
        const ok = [...want, ...back.filter((s) => !want.includes(s))];
        if (!ok.some((w) => label.toLowerCase().includes(w))) {
            return { at: 'questions[0].options[0].label', detail: 'option one "' + label + '" names none of: ' + ok.join(', ') };
        }
    }
    return rules ? ruleProblem(gate, rules) : null;
}

function readGate(file, next, route, rules) {
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
    const bad = gateProblem(gate, next, route, rules);
    if (bad) return { invalid: bad.at, detail: bad.detail, next: gate.next };
    // A question filed with no `multiSelect` is asked single-select, and the
    // host sends `multiSelect: false` with it — so the filed side reads as
    // that. The asked side is never filled: gateMatches still tells a value
    // dropped in transit from one that was sent (tests/handoff.test.js).
    gate.questions = gate.questions.map((q) => (q && typeof q === 'object' && !('multiSelect' in q)
        ? Object.assign({}, q, { multiSelect: false }) : q));
    return gate;
}

// Deep-equal by value, not by serialized key order. `asked` came off the
// tool call the host actually saw — a model reconstructing an
// AskUserQuestion call from the handoff file, which reproduces every value
// but is not a byte-for-byte copy — and `filed` off a fresh `readGate`, so
// keys inside one question or option can land in a different order on each
// side and still be the same gate. Node's own `isDeepStrictEqual` already
// gives what a hand-rolled walk here used to: order-insensitive object keys,
// order-sensitive arrays, and a key present with value `undefined` treated
// as different from the key being absent — that last distinction is what
// keeps a dropped `multiSelect` from matching a present `multiSelect: false`.
// An option's `preview` is compared the same way, with nothing added for it:
// a copy that drops or rewords one does not match.
function gateMatches(asked, filed) {
    if (!Array.isArray(asked) || !Array.isArray(filed)) return false;
    return isDeepStrictEqual(asked, filed);
}

// Position match, for the answer file only. A controller may reword the
// brain's gate questions and still put the same choices in front of the user,
// so this compares nothing but the shape: same number of questions (at least
// one), and at each index the same number of options. Labels, text and header
// are not compared; hooks/gate.js keeps the strict gateMatches for substitution.
function answersGate(asked, filed) {
    if (!Array.isArray(asked) || !Array.isArray(filed)) return false;
    if (asked.length < 1 || asked.length !== filed.length) return false;
    return asked.every((q, i) => {
        const a = q && q.options, f = filed[i] && filed[i].options;
        return Array.isArray(a) && Array.isArray(f) && a.length === f.length;
    });
}

// Why hooks/gate.js left a question as the controller wrote it, or null when
// nothing about the session makes that worth saying. Four cases, the first
// found on 2026-09-23: a fankeel-brain running for a stage `stage.agents` does
// not name, so nothing is validated and the user reads whatever the
// controller sent; a controlled stage whose question does not copy the
// handoff's gate word for word (2026-09-24); a controlled stage with no
// handoff file yet; and one whose file holds no gate `readGate` can read. A
// host still running a hook process registered before this file changed is a
// fourth cause no file here can confirm or rule out.
function skipReason(o) {
    const stage = String((o && o.stage) || '');
    if (!o || !o.controlled) {
        const mark = o && o.inflight;
        if (mark && typeof mark === 'object' && mark.stage === stage) {
            return 'a fankeel-brain was dispatched for `' + stage + '`, but stage.agents (' + (o.agents || 'unset')
                + ') does not name `' + stage + '`, so its gate is not substituted and this question goes out as the controller wrote it';
        }
        return null;
    }
    if (o.matches === false) {
        return 'stage.agents names `' + stage + '`, but this does not copy the handoff\'s gate word for word, so it goes out as the controller wrote it';
    }
    if (!o.handoff) return 'stage.agents names `' + stage + '`, but this task has no handoff path (no readable `started`)';
    if (!fs.existsSync(o.handoff)) return 'stage.agents names `' + stage + '`, but ' + o.handoff + ' does not exist yet';
    return 'stage.agents names `' + stage + '`, but ' + o.handoff + ' holds no readable `json gate` block (none, unparseable, or no questions)';
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

// A foreground tool call can run up to the Bash tool's ten-minute ceiling with
// nothing written to any transcript, and the agent is alive the whole time.
// While any activity file ends in an unanswered tool_use, `lost` waits this
// long instead of `idleMs`: ten minutes and one more. await-4.
const BUSY_MS = 11 * 60 * 1000;
const PENDING_TAIL = 256 * 1024;

// The parsed lines at the end of a transcript, at most PENDING_TAIL bytes of
// it: its first line may be cut, and a line that does not parse is skipped.
// `[]` for a file that is not there; null for one that is there and could not
// be read (briefly locked, or unreadable).
function tailEntries(file) {
    let text;
    try {
        const fd = fs.openSync(file, 'r');
        try {
            const size = fs.fstatSync(fd).size;
            const len = Math.min(size, PENDING_TAIL);
            const buf = Buffer.alloc(len);
            fs.readSync(fd, buf, 0, len, size - len);
            text = buf.toString('utf8');
        } finally {
            fs.closeSync(fd);
        }
    } catch (e) {
        return e && e.code === 'ENOENT' ? [] : null;
    }
    const entries = [];
    for (const l of text.split('\n')) {
        if (!l.trim()) continue;
        try { entries.push(JSON.parse(l)); } catch (e) { /* cut or half-written */ }
    }
    return entries;
}

// Whether a transcript's last assistant message holds a tool_use that no line
// after it answers with a tool_result: the agent is waiting on a tool, not
// stopped. Claude Code writes one line per content block, so one message can
// span several lines sharing `message.id`, and every tool_use among them
// counts. A file that is there and cannot be read must not read as idle, or a
// live agent is reported lost: a call is assumed out, and busyMs still ends
// the hold.
function pendingTool(file) {
    const entries = tailEntries(file);
    if (entries === null) return true;
    const blocks = (e) => (e && e.message && Array.isArray(e.message.content) ? e.message.content : []);
    let last = null;
    for (let i = entries.length - 1; i >= 0 && !last; i--) {
        if (entries[i] && entries[i].type === 'assistant') last = entries[i];
    }
    if (!last) return false;
    const mid = last.message && last.message.id;
    const uses = entries
        .filter((e) => e && e.type === 'assistant' && (e === last || (mid && e.message && e.message.id === mid)))
        .flatMap(blocks)
        .filter((b) => b && b.type === 'tool_use' && b.id)
        .map((b) => b.id);
    if (!uses.length) return false;
    const answered = new Set(entries.filter((e) => e && e.type === 'user').flatMap(blocks)
        .filter((b) => b && b.type === 'tool_result').map((b) => b.tool_use_id));
    return uses.some((id) => !answered.has(id));
}

// await-6: whether the last turn in a transcript is the user's — a tool result
// the agent has not answered yet, or the SendMessage that woke it — so it owes
// a reply and is composing one. A long reply writes no line until it is whole:
// on 2026-10-02 a plan brain woken by SendMessage was read `lost` three times
// while ListAgents still showed it running. A file that cannot be read owes
// nothing here; pendingTool already holds it.
function owesReply(file) {
    const entries = tailEntries(file) || [];
    for (let i = entries.length - 1; i >= 0; i--) {
        const type = entries[i] && entries[i].type;
        if (type === 'assistant') return false;
        if (type === 'user') return true;
    }
    return false;
}

// What a controller waiting on its stage agent does next, read off the disk
// alone, or null while none of it holds. In order: `commit` — a commit file
// written after `since` (scripts/commit.js renames the file once it has
// committed it, so one on disk is a commit nobody has made yet) — `commit` may
// be a bare path or an array of candidate paths, so a stage agent that wrote to
// a different convention than the exact one it was told still wakes the
// controller; `handoff` — the report written after `since`; `lost` — neither,
// and nothing in `activity` has moved for `idleMs`. An empty `activity` is an
// agent nobody can see, and never reads as lost. Past idleMs, a tool call still
// out, or a reply still owed, in any activity file holds it off until busyMs (BUSY_MS by default).
// `now` and `started` are passed in, so a test sets the clock rather than
// waiting two minutes for it.
// docs/plans/2026-09-23-controller-await-design.md §1.
function awaitState(o) {
    const since = o.since || 0;
    if (newestCommit(o.commit, since)) return 'commit';
    const handoff = mtimeOf(o.handoff);
    if (handoff !== null && handoff > since) return 'handoff';
    const activity = o.activity || [];
    if (!activity.length) return null;
    const idle = o.now - lastActivity(activity, o.started);
    if (idle < o.idleMs) return null;
    const busyMs = Number.isFinite(o.busyMs) ? o.busyMs : BUSY_MS;
    if (idle < busyMs && activity.some((f) => pendingTool(f) || owesReply(f)))return null;
    return 'lost';
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
            const state = awaitState({ handoff: o.handoff, commit: o.commit, since: o.since, activity, idleMs: o.idleMs, busyMs: o.busyMs, started, now: Date.now() });
            if (state) return finish(state);
            clearTimeout(idle);
            // Not yet idleMs: wake when it would be. Already past it with no
            // verdict: a tool call is out, so look again one idleMs later, or
            // when busyMs falls due if that comes first.
            if (activity.length) {
                const last = lastActivity(activity, started);
                const due = last + o.idleMs - Date.now();
                let wait = due > 0 ? due : o.idleMs;
                if (due <= 0) {
                    const busy = Number.isFinite(o.busyMs) ? o.busyMs : BUSY_MS;
                    wait = Math.min(wait, Math.max(0, last + busy - Date.now()));
                }
                idle = setTimeout(check, wait + 1);
            }
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

// Which case a build brain was sent for, read off its dispatch prompt: `build
// group <n>` or `build close`, whichever the prompt names first. A prompt whose
// first line is `build` and nothing else — the controller's plain dispatch
// line, which is what a verify rework sends — is `close`: its brief tells it to
// close the way `build close` does (lib/render.js), so the mark has to watch
// the plain handoff too. Null when it names none of these. hooks/brief.js asks
// at SubagentStart, and scripts/await.js asks again when the mark it reads has
// no `kind` (TODO 〔await〕).
function caseOfPrompt(text) {
    const s = String(text || '');
    const m = /\bbuild (?:close|group (\d+))\b/.exec(s);
    if (m) return m[1] ? { kind: 'group', group: Number(m[1]) } : { kind: 'close' };
    return /^\s*build\s*$/.test(s.split(/\r?\n/, 1)[0]) ? { kind: 'close' } : null;
}

// Line 1 of a subagent's own transcript is its dispatch prompt: that prompt as
// text, or null when the file cannot be read or line 1 is not a transcript line.
function promptOf(file) {
    try {
        const fd = fs.openSync(file, 'r');
        let line;
        try {
            const buf = Buffer.alloc(65536);
            const n = fs.readSync(fd, buf, 0, buf.length, 0);
            line = buf.toString('utf8', 0, n).split(/\r?\n/, 1)[0];
        } finally {
            fs.closeSync(fd);
        }
        const content = JSON.parse(line).message.content;
        return typeof content === 'string' ? content : (Array.isArray(content) ? content.map((p) => (p && p.text) || '').join('\n') : '');
    } catch (e) {
        process.stderr.write('promptOf: cannot read ' + file + ': ' + (e && e.message) + '\n');
        return null;
    }
}

module.exports = { dirFor, handoffPath, commitPath, answerPath, contextPath, relayPath, pendingPath, readPending, answersSince, answeredOf, handedOffSince, ledgerCommitPath, readGate, skipReason, gateMatches, answersGate, writeAnswer, lapOf, lapsUsed, readsOf, previousHandoff, width, awaitState, awaitHandoff, newestCommit, pendingTool, owesReply, caseOfPrompt, promptOf };
