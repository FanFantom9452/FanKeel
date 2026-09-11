'use strict';
// One session taken apart, for the station's detail panel: its context curve,
// the five largest rises and what caused them, its stage sequence with every
// backward step, each dispatch and what it cost, and a replay of what it did.
// Everything is read from files already on disk — the transcript, the agents'
// own transcripts, the workflow run files — and cached per session under
// `<configDir>/fankeel/station/cache/`, keyed on what those files look like, so
// a session is read again only when one of them has changed, and a session
// that has ended is read once.
//
// Two rules from the 2026-09-08 redesign hold for everything below: one series
// per chart, and every total the page prints is the sum of the rows printed
// under it, from the same source. So the rounding that makes a column add up
// happens here, once, and the page only adds.
const fs = require('node:fs');
const path = require('node:path');
const usage = require('./usage.js');
const prices = require('./prices.js');
const registry = require('./registry.js');
const ledger = require('./ledger.js');
const plantasks = require('./plantasks.js');
const replay = require('./replay.js');
const { classForRoute } = require('./stages.js');

// ---- stage commands --------------------------------------------------------

// A heredoc body is text a command feeds itself, not a command. A commit
// message written with `<<'EOF'` can name `task.js stage build` on a line of its
// own, and read as a statement that line is a stage move nobody made.
const HEREDOC = /<<-?[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;

// One shell command as statements, each a list of words. Quotes group, so a
// `git commit -m "... task.js stage build ..."` stays one word of a `git`
// statement — the 2026-09-11 mockup's first parse read exactly that as a
// backward move. `;`, `&`, `|` and a newline end a statement. A backslash is
// literal except before a newline, or before `"` or `\` inside double quotes:
// PowerShell writes paths with backslashes and they are not escapes there.
function statements(cmd) {
    const s = String(cmd || '').replace(HEREDOC, ' $3');
    const out = [];
    let words = [];
    let word = '';
    let has = false;
    let quote = null;
    const endWord = () => {
        if (has) words.push(word);
        word = '';
        has = false;
    };
    const endStatement = () => {
        endWord();
        if (words.length) out.push(words);
        words = [];
    };
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (quote) {
            if (c === quote) quote = null;
            else if (c === '\\' && quote === '"' && (s[i + 1] === '"' || s[i + 1] === '\\')) word += s[++i];
            else word += c;
            continue;
        }
        if (c === '"' || c === "'") {
            quote = c;
            has = true;
            continue;
        }
        if (c === '\\' && s[i + 1] === '\n') {
            i++;
            continue;
        }
        if (c === '\n' || c === ';' || c === '&' || c === '|') {
            endStatement();
            continue;
        }
        if (c === ' ' || c === '\t' || c === '\r') {
            endWord();
            continue;
        }
        word += c;
        has = true;
    }
    endStatement();
    return out;
}

const ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const NODE = /(^|[\\/])node(\.exe)?$/i;
const TASKJS = /(^|[\\/])task\.js$/;

// The `task.js` verbs a stage sequence is built from, out of one command: a
// statement whose program is `node` and whose script is `task.js`, after any
// `VAR=value` words in front. `start` enters the first stage of its `--route`,
// or `survey`, which every class's route begins with.
function taskCalls(cmd) {
    const out = [];
    for (const words of statements(cmd)) {
        let i = 0;
        while (i < words.length && ASSIGN.test(words[i])) i++;
        if (!NODE.test(words[i] || '') || !TASKJS.test(words[i + 1] || '')) continue;
        const verb = words[i + 2];
        const arg = words[i + 3];
        if (verb === 'stage' && arg && !arg.startsWith('-')) out.push({ verb, stage: arg });
        else if (verb === 'start') {
            const at = words.indexOf('--route', i);
            const route = at >= 0 && words[at + 1] ? words[at + 1].split(/[,\s]+/).filter(Boolean) : [];
            out.push({ verb, stage: route[0] || 'survey' });
        } else if (verb === 'route') out.push({ verb, stage: null });
    }
    return out;
}

// Every `task.js start|stage|route` the session ran, from its own Bash and
// PowerShell calls, in order, each stamped with the call's own timestamp —
// `moves` records when a hook first saw the change, which on 2026-09-11 was
// nineteen minutes after `start`. A call whose result came back as an error
// moved nothing and is dropped; one still waiting for its result is kept.
function stageCommands(entries, turnAt) {
    const out = [];
    const pending = new Map();
    (entries || []).forEach((e, i) => {
        if (!e || e.isSidechain === true || !e.message || !Array.isArray(e.message.content)) return;
        if (e.type === 'assistant') {
            for (const b of e.message.content) {
                if (!b || b.type !== 'tool_use' || (b.name !== 'Bash' && b.name !== 'PowerShell')) continue;
                const calls = taskCalls(b.input && b.input.command).map((c) => ({
                    at: Date.parse(e.timestamp), turn: turnAt ? turnAt(i) : null, verb: c.verb, stage: c.stage, text: '', ok: true,
                }));
                if (!calls.length) continue;
                out.push(...calls);
                pending.set(b.id, calls);
            }
            return;
        }
        if (e.type !== 'user') return;
        for (const b of e.message.content) {
            if (!b || b.type !== 'tool_result' || !pending.has(b.tool_use_id)) continue;
            const line = (usage.textOf(b.content).split('\n').find((l) => l.trim()) || '').trim().slice(0, 120);
            for (const c of pending.get(b.tool_use_id)) {
                c.ok = b.is_error !== true;
                c.text = line;
            }
            pending.delete(b.tool_use_id);
        }
    });
    return out.filter((c) => c.ok).map(({ ok, ...c }) => c);
}

const movesOf = (data) => (Array.isArray(data && data.moves) ? data.moves : [])
    .filter((m) => Array.isArray(m) && typeof m[0] === 'string' && Number.isFinite(m[1]));

// The stages in the order they were entered, each with where that came from.
// Commands first; `moves` only where there are none; the clock last, which
// keeps one window per stage and so cannot show a return. A command list that
// does not open with `start` — an adopted task, a transcript begun after the
// entry was — gets the entry's own first stage in front of it.
function stageSequence(commands, data) {
    const steps = [];
    const push = (stage, at, source) => {
        if (!steps.length || steps[steps.length - 1].stage !== stage) steps.push({ stage, at, source });
    };
    const cmds = (commands || []).filter((c) => (c.verb === 'start' || c.verb === 'stage') && c.stage);
    const moves = movesOf(data);
    if (cmds.length) {
        if (cmds[0].verb !== 'start') {
            const clock = registry.seriesOf(data || {});
            const first = moves.length ? { stage: moves[0][0], at: moves[0][1], source: 'moves' }
                : clock.length ? { stage: clock[0].stage, at: clock[0].from, source: 'clock' } : null;
            if (first && first.stage !== cmds[0].stage) push(first.stage, first.at, first.source);
        }
        for (const c of cmds) push(c.stage, c.at, 'cmd');
        return steps;
    }
    if (moves.length) {
        for (const [stage, at] of moves) push(stage, at, 'moves');
        return steps;
    }
    for (const w of registry.seriesOf(data || {})) push(w.stage, w.from, 'clock');
    return steps;
}

// A step to a stage earlier on the route than the one before it.
function backtracksOf(seq, route) {
    const r = Array.isArray(route) ? route : [];
    const out = [];
    for (let i = 1; i < (seq || []).length; i++) {
        const a = r.indexOf(seq[i - 1].stage);
        const b = r.indexOf(seq[i].stage);
        if (a >= 0 && b >= 0 && b < a) out.push({ i, from: seq[i - 1].stage, to: seq[i].stage, at: seq[i].at, since: seq[i - 1].at });
    }
    return out;
}

// ---- rounding --------------------------------------------------------------

// Round a column so its rounded cells add to its rounded total: floor every
// cell, then hand the units the floors lost to the cells with the largest
// remainders. Rounding each cell alone printed thirteen rows summing to $10.77
// under a total of $10.78.
function largestRemainder(values, unit) {
    const raw = (values || []).map((v) => (Number.isFinite(v) ? v : 0) / unit);
    const out = raw.map(Math.floor);
    let need = Math.round(raw.reduce((a, b) => a + b, 0)) - out.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0; k < order.length && need > 0; k++, need--) out[order[k][1]] += 1;
    return out;
}

// ---- context ---------------------------------------------------------------

// The curve's points: request n's context at its own time. A request with no
// timestamp cannot be placed on a time axis, so it is counted instead, and
// points plus that count is the request count.
function contextPoints(series) {
    const points = [];
    let noTime = 0;
    (series || []).forEach((r, i) => {
        if (Number.isFinite(r.at)) points.push({ n: i + 1, t: r.at, y: r.context });
        else noTime += 1;
    });
    return { points, noTime };
}

const gist = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

function labelOf(u) {
    if (!u) return 'tool result';
    const i = u.input || {};
    const file = i.file_path || i.notebook_path;
    const arg = file ? replay.tail(file) : (i.command || i.pattern || i.description || i.url || i.query || i.skill || '');
    return (u.name + ' ' + String(arg).replace(/\s+/g, ' ')).trim().slice(0, 80);
}

// What arrived before each request — every tool result, notification and
// prompt the parent received after the request before it — and the tool calls
// each request wrote.
function arrivals(entries, turnAt) {
    const uses = new Map();
    const own = new Map();
    const into = new Map();
    let buffer = [];
    let last = null;
    (entries || []).forEach((e, i) => {
        if (!e || e.isSidechain === true || !e.message || typeof e.message !== 'object') return;
        if (e.type === 'assistant') {
            const n = turnAt(i);
            if (n === null) return;
            if (n !== last) {
                into.set(n, buffer);
                buffer = [];
                last = n;
            }
            for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
                if (!b || b.type !== 'tool_use') continue;
                const u = { name: b.name, input: b.input && typeof b.input === 'object' ? b.input : {} };
                uses.set(b.id, u);
                if (!own.has(n)) own.set(n, []);
                own.get(n).push(u);
            }
            return;
        }
        if (e.type !== 'user') return;
        const note = usage.notificationOf(e);
        if (note) {
            buffer.push({ k: 'notification', label: 'task-notification', chars: note.chars });
            return;
        }
        // System text — a skill loaded, a reminder, hook output — is named by its
        // opening words: `system text 23,600` alone did not say which one.
        const said = (text) => ({ k: e.isMeta ? 'meta' : 'prompt',
            label: e.isMeta ? 'system text: ' + gist(text) : 'prompt', chars: text.length });
        const content = e.message.content;
        if (typeof content === 'string') {
            buffer.push(said(content));
            return;
        }
        for (const b of Array.isArray(content) ? content : []) {
            if (b && b.type === 'tool_result') {
                buffer.push({ k: 'tool', label: labelOf(uses.get(b.tool_use_id)), chars: usage.textOf(b.content).length });
            } else if (b && b.type === 'text' && typeof b.text === 'string') {
                buffer.push(said(b.text));
            }
        }
    });
    return { into, own };
}

// The five largest rises from one request to the next, each with its cause:
// what arrived between them, largest first, or — when the previous response's
// own output tokens are at least half the rise — the model's own output.
// Thinking is stored as a signature only, so it cannot be measured here.
function risesOf(series, into, own, max) {
    const ups = [];
    for (let n = 2; n <= (series || []).length; n++) {
        const dy = series[n - 1].context - series[n - 2].context;
        if (dy > 0) ups.push({ n, dy });
    }
    ups.sort((x, y) => y.dy - x.dy || x.n - y.n);
    return ups.slice(0, max || 5).map(({ n, dy }) => {
        const a = series[n - 2];
        const b = series[n - 1];
        const came = ((into && into.get(n)) || []).slice().sort((x, y) => y.chars - x.chars);
        const wrote = ((own && own.get(n - 1)) || []).slice()
            .sort((x, y) => JSON.stringify(y.input).length - JSON.stringify(x.input).length);
        const self = { tok: a.output, label: wrote.length ? '上一回應寫的 ' + labelOf(wrote[0]) : '上一回應的文字' };
        return {
            n, from: n - 1, t: b.at, y0: a.context, y1: b.context, dy,
            cause: self.tok * 2 >= dy ? 'self' : 'in',
            self, top: came.slice(0, 3), restN: Math.max(came.length - 3, 0),
            restChars: came.slice(3).reduce((s, x) => s + x.chars, 0),
            inChars: came.reduce((s, x) => s + x.chars, 0),
        };
    });
}

// ---- tasks -----------------------------------------------------------------

const PLAN = /(^|[\\/])docs[\\/]plans[\\/][^\\/]+\.md$/;
const TASK_REF = /\btask\s+(\d+)\b/i;

function readText(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
}

// The plan this session built from, per plan it claimed: its tasks with what
// the ledger says of each, the groups `plantasks` would dispatch them in, and
// the parallel hint. A task unfinished has no `Task` line in the ledger, so
// the rows come from the plan and such a task reads `no ledger line` rather
// than a guess. A dispatch is tied to a task by `task N` in its label and by
// nothing else; the ones that name no task are listed, not guessed at.
function tasksOf(root, data, rows) {
    const out = [];
    const claims = registry.claimsOf(data).filter((c) => PLAN.test(c) && !/-design\.md$/.test(c));
    for (const claim of claims) {
        const candidates = [path.resolve(root, claim)];
        if (data && data.project) candidates.push(path.resolve(root, data.project, claim));
        const planFile = candidates.find((f) => fs.existsSync(f));
        if (!planFile) continue;
        const tasks = plantasks.parseTasks(readText(planFile) || '');
        if (!tasks.length) continue;
        const lines = ledger.completions(readText(ledger.ledgerPath(root, claim)) || '');
        const done = new Map(lines.map((c) => [c.n, c]));
        const turns = new Map();
        const unmatched = new Set();
        for (const r of rows || []) {
            const m = TASK_REF.exec(r.label || '');
            const n = m ? Number(m[1]) : null;
            if (n === null || !tasks.some((t) => t.n === n)) {
                unmatched.add(r.label || r.id);
                continue;
            }
            if (!turns.has(n)) turns.set(n, new Set());
            if (Number.isFinite(r.turn)) turns.get(n).add(r.turn);
        }
        const sorted = (set) => [...(set || [])].sort((a, b) => a - b);
        out.push({
            plan: claim,
            ledgerLines: lines.length,
            tasks: tasks.map((t) => ({
                n: t.n, title: t.name,
                status: done.has(t.n) ? 'complete' : 'no ledger line',
                range: done.has(t.n) ? done.get(t.n).range : null,
                turns: sorted(turns.get(t.n)),
            })),
            groups: plantasks.surfaces(tasks).map((g, i) => {
                const seen = new Set();
                for (const n of g.tasks) for (const t of turns.get(n) || []) seen.add(t);
                return { g: i + 1, tasks: g.tasks, surface: g.surface, turns: sorted(seen), hint: g.tasks.length > 1 && seen.size > 1 };
            }),
            unmatched: [...unmatched],
        });
    }
    return out;
}

// ---- the cache -------------------------------------------------------------

const VERSION = 1;

function cachePath(configDir, sessionId) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'station', 'cache', sessionId + '.json');
}

// Claude Code files a transcript as `projects/<slug>/<session>.jsonl`, and the
// slug is the launch directory — which the entry does not record and which need
// not be the registry's root. So every project directory is asked for this one
// file name.
function transcriptOf(configDir, sessionId) {
    const base = path.join(String(configDir == null ? '' : configDir), 'projects');
    let dirs;
    try {
        dirs = fs.readdirSync(base);
    } catch (e) {
        return null;
    }
    for (const d of dirs) {
        const file = path.join(base, d, sessionId + '.jsonl');
        try {
            if (fs.statSync(file).isFile()) return file;
        } catch (e) { /* not this project */ }
    }
    return null;
}

// The size and mtime of the transcript, every agent file and every run file,
// summed and maxed. A directory's own mtime does not move when a file inside
// it grows, so the files are what is stat-ed.
function keyOf(transcript) {
    const dir = usage.sessionDirOf(transcript);
    const files = [transcript].concat(dir ? usage.agentFiles(dir) : []);
    try {
        for (const n of fs.readdirSync(path.join(dir, 'workflows'))) {
            if (n.endsWith('.json')) files.push(path.join(dir, 'workflows', n));
        }
    } catch (e) { /* no runs */ }
    let count = 0;
    let size = 0;
    let mtime = 0;
    for (const f of files) {
        try {
            const st = fs.statSync(f);
            count += 1;
            size += st.size;
            mtime = Math.max(mtime, st.mtimeMs);
        } catch (e) { /* gone between readdir and stat */ }
    }
    return count + ':' + size + ':' + Math.floor(mtime);
}


function extract(transcript, sessionId, data) {
    const d = data || {};
    const entries = usage.entriesOf(transcript) || [];
    const turnAt = usage.turnIndex(entries);
    const seen = usage.summarise(transcript, { series: true });
    const series = seen ? seen.series : [];
    const { points, noTime } = contextPoints(series);
    const commands = stageCommands(entries, turnAt);
    const route = Array.isArray(d.route) ? d.route : [];
    const seq = stageSequence(commands, d);
    const backs = backtracksOf(seq, route);
    const { into, own } = arrivals(entries, turnAt);
    const found = usage.dispatchesOf(transcript) || { dispatches: [], rows: [], runs: [] };
    const steps = {};
    const unpriced = new Set();
    const rows = found.rows.map((r) => {
        const cost = prices.costOf(r.models);
        for (const id of cost.unpriced) unpriced.add(id);
        if (r.file) steps[r.id] = replay.stepsOf(r.file);
        const { file, models, ...rest } = r;
        return Object.assign(rest, { usd: cost.priced.length ? cost.usd : 0, unpriced: cost.unpriced });
    });
    const cents = largestRemainder(rows.map((r) => r.usd), 0.01);
    const ktok = largestRemainder(rows.map((r) => r.tokens), 1000);
    const secs = largestRemainder(rows.map((r) => r.durMs), 1000);
    rows.forEach((r, i) => {
        r.c = cents[i];
        r.k = ktok[i];
        r.s = secs[i];
    });
    const ownCost = seen ? prices.costOf(seen.usage.models) : { usd: 0, priced: [], unpriced: [] };
    for (const id of ownCost.unpriced) unpriced.add(id);
    const agents = usage.agentsOf(transcript);
    const replayed = replay.eventsOf(entries, { commands, dispatches: found.dispatches, turnAt });
    let peak = null;
    for (const p of points) if (!peak || p.y > peak.y) peak = p;
    const agentUsd = rows.reduce((n, r) => n + r.usd, 0);
    const ownUsd = ownCost.priced.length ? ownCost.usd : 0;
    return {
        v: VERSION, sessionId,
        project: typeof d.project === 'string' ? d.project : '',
        day: typeof d.started === 'string' ? d.started.slice(0, 10) : null,
        class: typeof d.class === 'string' && d.class ? d.class : classForRoute(route),
        route, stage: typeof d.stage === 'string' ? d.stage : '',
        model: seen ? seen.model : null,
        requests: seen ? seen.usage.requests : 0,
        ownUsd, agentUsd, usd: ownUsd + agentUsd, unpriced: [...unpriced],
        points, noTime, peak: peak ? peak.y : 0, peakN: peak ? peak.n : null,
        rises: risesOf(series, into, own, 5),
        marks: commands.map((c) => ({ t: c.at, kind: c.verb, stage: c.stage, text: c.text, turn: c.turn }))
            .concat(seq.filter((s) => s.source !== 'cmd').map((s) => ({ t: s.at, kind: s.source, stage: s.stage, text: '', turn: null }))),
        seq, seqSource: seq.some((s) => s.source === 'cmd') ? 'task.js' : seq.length ? seq[0].source : null,
        backs, backtracks: backs.length,
        dispatches: found.dispatches, rows, runs: found.runs,
        agentCents: cents.reduce((a, b) => a + b, 0),
        agentsTotal: agents
            ? { cents: Math.round(prices.costOf(agents.models).usd * 100), tokens: usage.tokensOf(usage.splitOf(agents.models)), wallMs: agents.wallMs, agents: agents.agents }
            : { cents: 0, tokens: 0, wallMs: 0, agents: 0 },
        events: replayed.events, evTotal: replayed.total, dropped: replayed.dropped,
        steps,
    };
}

// One session's detail and whether it was read just now. An ended session whose
// cache was written after it ended is returned without a stat; any other with
// a cache whose key still matches is returned without a read. `opts.reuse`
// asks for whatever is cached, stat-free — how `write()` spends no time on a
// session once its budget is gone. `opts.now` is a seam for the tests.
function detailOf(configDir, sessionId, data, opts) {
    const o = opts || {};
    const file = cachePath(configDir, sessionId);
    let old = null;
    try {
        old = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        old = null;
    }
    if (!old || old.v !== VERSION) old = null;
    if (o.reuse) return old ? { detail: old, fresh: false } : null;
    const endedAt = data && data.ended && typeof data.ended.at === 'string' ? Date.parse(data.ended.at) : NaN;
    if (old && Number.isFinite(endedAt) && old.at >= endedAt) return { detail: old, fresh: false };
    const transcript = transcriptOf(configDir, sessionId);
    if (!transcript) return old ? { detail: old, fresh: false } : null;
    const key = keyOf(transcript);
    if (old && old.key === key) return { detail: old, fresh: false };
    const detail = extract(transcript, sessionId, data);
    detail.key = key;
    detail.at = Number.isFinite(o.now) ? o.now : Date.now();
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const temp = file + '.' + process.pid + '.tmp';
        fs.writeFileSync(temp, JSON.stringify(detail));
        registry.renameRetrying(temp, file);
    } catch (e) { /* the page still gets this read; the next write repeats it */ }
    return { detail, fresh: true };
}

module.exports = {
    statements, taskCalls, stageCommands, stageSequence, backtracksOf, largestRemainder,
    contextPoints, arrivals, risesOf, tasksOf, cachePath, transcriptOf, keyOf, detailOf,
};
