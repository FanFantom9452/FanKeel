'use strict';
// What a session did, one line per event, for the station's 過程還原: the
// prompts, the stage moves, the gates and what was chosen at them, every
// dispatch out and back, the files each turn edited, the commits and the test
// results. Read out of the session's own transcript, and for a dispatch, out of
// that agent's own transcript — so the replay needs nothing the transcript
// does not already hold, and the transcript itself need not be opened.
const usage = require('./usage.js');

// A gate's question and answer are clipped so one event cannot dominate the
// page. 120 held one sentence and cut the half of an option description that
// says what accepting it accepts, which is the half worth reading.
const GATE_CLIP = 240;

// Past this many rows only the rows a review turns on are kept — the gates,
// the stage moves, the commits and the dispatches — and the page says how many
// were dropped rather than scrolling for ever.
const MAX_EVENTS = 300;
const KEEP = new Set(['gate', 'stage', 'commit', 'out', 'back']);
const MAX_STEPS = 40;

// Past this many characters an agent's prompt is kept only in part. The page
// shows three lines until it is opened; this bounds what a detail file carries
// for a session whose dispatches each sent a page of brief.
const PROMPT_CLIP = 12000;

const EDITS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
// `git commit` prints `[branch sha] subject` on its first line; reading the
// subject from there, rather than out of `-m "..."`, is what keeps a heredoc
// or a quoted message from having to be parsed at all.
const COMMIT = /^\[[^\]\n]*?\s([0-9a-f]{7,40})\]\s+(.+)$/m;
// `git commit -q` prints nothing, and this repository's sessions follow it with
// `git log --oneline -1`: the first `<sha> <subject>` line is then the commit.
// Measured 2026-09-11: every commit in session 13ebea34 had this shape, and the
// bracket form alone found none of them.
const ONELINE = /^([0-9a-f]{7,40}) (\S.*)$/m;
// The spec reporter's two summary lines; `ok` lines it never prints.
const TEST = /^ℹ (pass|fail) (\d+)\s*$/gm;

const clip = (s, n) => {
    const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const tail = (p) => String(p || '').split(/[\\/]/).filter(Boolean).slice(-3).join('/');
const when = (ev) => (Number.isFinite(ev.t) ? ev.t : Number.MAX_SAFE_INTEGER);

// A person typing, not a tool result, a notification or a system message. A
// slash command's own arguments are the prompt; with none, its name is.
function promptOf(e) {
    if (e.isMeta === true || (e.origin && e.origin.kind === 'task-notification')) return null;
    const c = e.message && e.message.content;
    let text = null;
    if (typeof c === 'string') text = c;
    else if (Array.isArray(c) && !c.some((b) => b && b.type === 'tool_result')) {
        text = c.map((b) => (b && b.type === 'text' && typeof b.text === 'string' ? b.text : '')).join(' ');
    }
    if (!text || !text.trim()) return null;
    if (/^\s*<(local-command|system-reminder|task-notification)/.test(text) || /^\s*Caveat:/.test(text)) return null;
    const cmd = /<command-name>([^<]*)<\/command-name>/.exec(text);
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(text);
    if (cmd) text = (args && args[1].trim()) || cmd[1];
    return { text: clip(text.replace(/<[^>]+>/g, ' '), 60), cmd: cmd ? cmd[1].trim() : null };
}

function answerOf(a) {
    if (Array.isArray(a)) return a.map(String).join(', ');
    return a === undefined || a === null ? null : String(a);
}

// `opts.commands` is `stageCommands()`'s list and `opts.dispatches` is
// `dispatchesOf().dispatches`; both are read here rather than found again, so a
// stage move and a dispatch are the same rows in the replay as on the rest of
// the panel. `opts.turnAt` is `usage.turnIndex(entries)`.
function eventsOf(entries, opts) {
    const commands = (opts && opts.commands) || [];
    const dispatches = (opts && opts.dispatches) || [];
    const turnAt = (opts && typeof opts.turnAt === 'function') ? opts.turnAt : () => null;
    const events = [];
    const asks = new Map();
    const commits = new Map();
    const edits = new Map();
    (entries || []).forEach((e, i) => {
        if (!e || e.isSidechain === true || !e.message || typeof e.message !== 'object') return;
        const at = Date.parse(e.timestamp);
        if (e.type === 'assistant') {
            const turn = turnAt(i);
            for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
                if (!b || b.type !== 'tool_use') continue;
                const input = b.input && typeof b.input === 'object' ? b.input : {};
                if (b.name === 'AskUserQuestion') {
                    asks.set(b.id, { at, turn, questions: Array.isArray(input.questions) ? input.questions : [] });
                } else if ((b.name === 'Bash' || b.name === 'PowerShell') && /\bgit\b[^\n]*\bcommit\b/.test(String(input.command || ''))) {
                    commits.set(b.id, turn);
                } else if (EDITS.has(b.name)) {
                    const f = tail(input.file_path || input.notebook_path);
                    if (!f) continue;
                    let ev = edits.get(turn);
                    if (!ev) {
                        ev = { t: at, kind: 'edit', turn, files: [] };
                        edits.set(turn, ev);
                        events.push(ev);
                    }
                    const hit = ev.files.find((x) => x.f === f);
                    if (hit) hit.n += 1;
                    else ev.files.push({ f, n: 1 });
                }
            }
            return;
        }
        if (e.type !== 'user') return;
        const p = promptOf(e);
        if (p) {
            events.push({ t: at, kind: 'prompt', text: p.text, cmd: p.cmd });
            return;
        }
        for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
            if (!b || b.type !== 'tool_result') continue;
            const text = usage.textOf(b.content);
            if (asks.has(b.tool_use_id)) {
                const ask = asks.get(b.tool_use_id);
                const answers = e.toolUseResult && e.toolUseResult.answers && typeof e.toolUseResult.answers === 'object'
                    ? e.toolUseResult.answers : {};
                events.push({
                    t: at, kind: 'gate', turn: ask.turn, askedAt: ask.at,
                    qs: ask.questions.map((q) => {
                        const a = answerOf(answers[q.question]);
                        const labels = (Array.isArray(q.options) ? q.options : []).map((o) => o && o.label);
                        return {
                            q: clip(q.question, GATE_CLIP),
                            a: a === null ? null : clip(a, GATE_CLIP),
                            own: a !== null && !labels.includes(a),
                            labels: labels.filter((l) => typeof l === 'string'),
                        };
                    }),
                });
            }
            if (commits.has(b.tool_use_id)) {
                const m = COMMIT.exec(text) || ONELINE.exec(text);
                if (m) events.push({ t: at, kind: 'commit', turn: commits.get(b.tool_use_id), sha: m[1].slice(0, 7), text: clip(m[2], 100) });
            }
            let pass = null;
            let fail = null;
            TEST.lastIndex = 0;
            let m;
            while ((m = TEST.exec(text)) !== null) {
                if (m[1] === 'pass') pass = Number(m[2]);
                else fail = Number(m[2]);
            }
            if (pass !== null || fail !== null) {
                events.push({ t: at, kind: 'test', text: 'ℹ pass ' + (pass === null ? '?' : pass) + ' · ℹ fail ' + (fail === null ? '?' : fail) });
            }
        }
    });
    for (const c of commands) {
        events.push({ t: c.at, kind: 'stage', turn: c.turn, verb: c.verb, stage: c.stage, text: c.text });
    }
    dispatches.forEach((d, i) => {
        events.push({ t: d.out, kind: 'out', disp: i, turn: d.turn, surface: d.surface, text: d.text, agentType: d.agentType, alias: d.alias });
        if (Number.isFinite(d.back)) events.push({ t: d.back, kind: 'back', disp: i, ret: d.ret, text: d.text });
    });
    events.sort((a, b) => when(a) - when(b));
    const total = events.length;
    let kept = events;
    if (kept.length > MAX_EVENTS) kept = kept.filter((ev) => KEEP.has(ev.kind));
    if (kept.length > MAX_EVENTS) kept = kept.slice(0, MAX_EVENTS);
    return { events: kept, total, dropped: total - kept.length };
}

const kindOf = (name) => (name === 'Read' ? 'read'
    : EDITS.has(name) ? 'edit'
        : name === 'Bash' || name === 'PowerShell' ? 'cmd'
            : name === 'Grep' || name === 'Glob' ? 'find' : 'other');
const PRIORITY = { edit: 0, cmd: 1, read: 2, find: 3, other: 4 };

// What one tool_use reads as in the list of steps.
function stepOf(b) {
    const input = b.input && typeof b.input === 'object' ? b.input : {};
    const s = { k: kindOf(b.name) };
    if (s.k === 'read' || s.k === 'edit') {
        s.f = tail(input.file_path || input.notebook_path);
        if (b.name === 'Write') s.w = true;
    } else if (s.k === 'cmd') s.c = clip(input.command, 90);
    else if (s.k === 'find') s.c = clip(b.name + ' ' + (input.pattern || ''), 90);
    else s.c = String(b.name);
    return s;
}

// A user line's text, or '' for a line of tool results.
function promptText(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content) || content.some((b) => b && b.type === 'tool_result')) return '';
    return content.map((b) => (b && b.type === 'text' && typeof b.text === 'string' ? b.text : '')).join('\n');
}

// One agent's own steps, from its own transcript: what it read, what it
// edited, which commands it ran and the first line each printed. Capped, and
// the cap drops reads and searches before it drops an edit or a command —
// those are what a review of a dispatch turns on.
//
// And where it is now, off the same lines. It has finished when its last
// assistant line carries no tool_use, every tool_use it made has its
// tool_result, and that line closes a message — Claude Code writes one block
// per line, and a line written mid-message carries `stop_reason: null`.
// Anything else is `open`. `cur` is the last tool_use still without a
// tool_result: what it is doing now, with the tool's name `n` and when it
// began `t`. Every tool_use without a tool_result, `cur`'s included, also
// stays in `steps` marked `p: true` and outside the cap, so a parallel call
// left open earlier in the same message cannot be dropped or read as
// finished for having no result to show. `lastAt` is the newest timestamp in
// the file. `prompt` is the first user line that is not a system reminder
// (`isMeta`) — what the dispatch sent — clipped at PROMPT_CLIP, with
// `promptLen` its whole length.
function stepsOf(file, cap) {
    const max = Number.isFinite(cap) ? cap : MAX_STEPS;
    const uses = [];
    const byId = new Map();
    const answered = new Set();
    let prompt = null;
    let last = null;
    let lastAt = null;
    for (const e of usage.entriesOf(file) || []) {
        const at = Date.parse(e.timestamp);
        if (Number.isFinite(at) && (lastAt === null || at > lastAt)) lastAt = at;
        if ((e.type !== 'user' && e.type !== 'assistant') || !e.message || e.isMeta === true) continue;
        last = e;
        if (prompt === null && e.type === 'user') {
            const text = promptText(e.message.content);
            if (text.trim()) prompt = text;
        }
        if (!Array.isArray(e.message.content)) continue;
        for (const b of e.message.content) {
            if (!b) continue;
            if (e.type === 'assistant' && b.type === 'tool_use') {
                const s = stepOf(b);
                byId.set(b.id, s);
                uses.push({ id: b.id, name: String(b.name), s, at });
            } else if (e.type === 'user' && b.type === 'tool_result') {
                answered.add(b.tool_use_id);
                const s = byId.get(b.tool_use_id);
                if (s && s.k === 'cmd') s.r = clip(usage.textOf(b.content).split('\n').find((l) => l.trim()) || '', 60);
            }
        }
    }
    let pending = null;
    for (const u of uses) if (!answered.has(u.id)) pending = u;
    const content = last && last.type === 'assistant' && Array.isArray(last.message.content) ? last.message.content : null;
    const finished = Boolean(content) && !pending && !content.some((b) => b && b.type === 'tool_use')
        && last.message.stop_reason !== null;
    // A message can carry two or more tool_use blocks still without a
    // tool_result — parallel calls, not only the last one `cur` names — and
    // an earlier one of those must not read as finished for having no result
    // to show. Each is marked `p: true`, on a copy so `pending.s` below (what
    // `cur` is built from) is untouched, and is kept whatever the cap says,
    // the way the one `cur` names always was: the cap is computed over the
    // answered ones alone.
    const all = uses.map((u) => (answered.has(u.id) ? u.s : Object.assign({}, u.s, { p: true })));
    const droppable = [];
    all.forEach((s, i) => { if (!s.p) droppable.push(i); });
    const total = {};
    for (const i of droppable) total[all[i].k] = (total[all[i].k] || 0) + 1;
    const keep = new Set(droppable.map((i) => [all[i].k, i])
        .sort((a, b) => PRIORITY[a[0]] - PRIORITY[b[0]] || a[1] - b[1])
        .slice(0, max).map((x) => x[1]));
    const dropped = {};
    for (const i of droppable) if (!keep.has(i)) dropped[all[i].k] = (dropped[all[i].k] || 0) + 1;
    return {
        steps: all.filter((s, i) => s.p || keep.has(i)), total, dropped, droppedN: droppable.length - keep.size,
        open: !finished,
        cur: pending ? Object.assign({ n: pending.name, t: Number.isFinite(pending.at) ? pending.at : null }, pending.s) : null,
        lastAt,
        prompt: prompt === null ? null : prompt.slice(0, PROMPT_CLIP),
        promptLen: prompt === null ? 0 : prompt.length,
    };
}

module.exports = { MAX_EVENTS, eventsOf, stepsOf, tail, answerOf };
