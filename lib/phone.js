'use strict';
// The phone's channel to one session (docs/90-agent/plans/2026-10-22-mobile-session-design.md §1):
// five files under <registry>/.fankeel/station/phone/<session_id>/ — attach.json
// while the phone holds the session, inbox.json for the one waiting message,
// holding.json while the Stop hook waits, chat.jsonl the conversation and its
// tool steps, background.json the last Stop's background_tasks. Nothing else
// opens them. stateOf is the five states the phone draws.
const fs = require('node:fs');
const path = require('node:path');
const registry = require('./registry.js');
const { readObject } = require('./json.js');

const SAY_MAX = 4000;
const TEXT_MAX = 8000;
const CHAT_KEEP = 200;
const POLL_MS = 200;
const LABEL_MAX = 80;
const LAST_MAX = 200;
const ROLES = new Set(['desktop', 'phone', 'assistant', 'tool', 'tool-end']);
const SPOKEN = new Set(['desktop', 'phone', 'assistant']);

function dirOf(root, sid) {
    if (!registry.sessionPath(root, sid)) return null;
    return path.join(registry.stateDir(root), 'station', 'phone', sid);
}
function fileOf(root, sid, name) {
    const dir = dirOf(root, sid);
    return dir ? path.join(dir, name) : null;
}
function put(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    registry.writeAtomic(file, JSON.stringify(value) + '\n');
}
function unlink(file) {
    try {
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        return false;
    }
}

function attach(root, sid, device, now) {
    const file = fileOf(root, sid, 'attach.json');
    if (!file) return false;
    put(file, { at: now, device: String(device || '') });
    return true;
}
// The inbox goes too: a message left waiting would be the next attach's first turn.
function detach(root, sid) {
    const file = fileOf(root, sid, 'attach.json');
    if (!file) return false;
    unlink(fileOf(root, sid, 'inbox.json'));
    return unlink(file);
}
function isAttached(root, sid) {
    const file = fileOf(root, sid, 'attach.json');
    return Boolean(file && fs.existsSync(file));
}

function say(root, sid, text, now) {
    const file = fileOf(root, sid, 'inbox.json');
    if (!file) return { ok: false, code: 404, reason: 'no such session' };
    const body = String(text == null ? '' : text).trim();
    if (!body) return { ok: false, code: 400, reason: 'the message is empty' };
    if (body.length > SAY_MAX) return { ok: false, code: 400, reason: 'a message is at most ' + SAY_MAX + ' characters' };
    if (!isAttached(root, sid)) return { ok: false, code: 409, reason: 'the phone has not attached this session' };
    if (fs.existsSync(file)) return { ok: false, code: 409, reason: 'a message is already waiting for this turn to end' };
    put(file, { text: body, at: now });
    return { ok: true };
}

// Rename first: the station cannot write a second message into the file
// this reads, and a second reader finds nothing to rename.
function take(root, sid) {
    const file = fileOf(root, sid, 'inbox.json');
    if (!file) return null;
    const mine = file + '.' + process.pid + '.taking';
    try {
        fs.renameSync(file, mine);
    } catch (e) {
        return null;
    }
    const got = readObject(mine);
    unlink(mine);
    return got && typeof got.text === 'string' ? { text: got.text, at: got.at } : null;
}

function append(root, sid, entry) {
    const file = fileOf(root, sid, 'chat.jsonl');
    if (!file || !entry || !ROLES.has(entry.role)) return false;
    const line = Object.assign({}, entry);
    if (typeof line.text === 'string' && line.text.length > TEXT_MAX) line.text = line.text.slice(0, TEXT_MAX) + '…';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(line) + '\n');
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    if (lines.length > CHAT_KEEP) registry.writeAtomic(file, lines.slice(-CHAT_KEEP).join('\n') + '\n');
    return true;
}

function chat(root, sid, n) {
    const file = fileOf(root, sid, 'chat.jsonl');
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return [];
    }
    const out = [];
    for (const l of text.split('\n')) {
        if (!l.trim()) continue;
        try {
            const o = JSON.parse(l);
            if (o && ROLES.has(o.role)) out.push(o);
        } catch (e) { /* a torn line */ }
    }
    return n > 0 ? out.slice(-n) : out;
}

function background(root, sid) {
    const file = fileOf(root, sid, 'background.json');
    const got = file ? readObject(file) : null;
    return got && Array.isArray(got.tasks) ? got.tasks : [];
}

function writeBackground(root, sid, tasks, now) {
    const file = fileOf(root, sid, 'background.json');
    if (!file) return false;
    const before = new Map(background(root, sid).map((x) => [x.id, x.since]));
    const list = (Array.isArray(tasks) ? tasks : []).filter((x) => x && typeof x === 'object').map((x) => {
        const id = String(x.id || '');
        return {
            id, type: String(x.type || ''), status: String(x.status || ''),
            description: String(x.description || ''), command: String(x.command || ''),
            since: Number.isFinite(before.get(id)) ? before.get(id) : now,
        };
    });
    put(file, { at: now, tasks: list });
    return true;
}

// The Stop hook's wait, hooks/gate.js stationAnswers' shape: a sync poll.
function hold(root, sid, ms) {
    const file = fileOf(root, sid, 'holding.json');
    if (!file) return { gone: 'no session' };
    const since = Date.now();
    put(file, { since, until: since + ms });
    try {
        for (;;) {
            const got = take(root, sid);
            if (got) return { text: got.text };
            if (!isAttached(root, sid)) return { gone: 'detached' };
            if (Date.now() - since >= ms) {
                detach(root, sid);
                return { gone: 'timeout' };
            }
            registry.sleepMs(POLL_MS);
        }
    } finally {
        unlink(file);
    }
}

function snapshot(root, sid, now, n) {
    const all = chat(root, sid, 0);
    const spoken = all.filter((x) => SPOKEN.has(x.role));
    const said = spoken.length ? spoken[spoken.length - 1] : null;
    const h = fileOf(root, sid, 'holding.json');
    const holding = h ? readObject(h) : null;
    const i = fileOf(root, sid, 'inbox.json');
    const waiting = i ? readObject(i) : null;
    return {
        attached: isAttached(root, sid),
        holding: Boolean(holding && Number(holding.until) > now),
        waiting: waiting && typeof waiting.text === 'string' ? { text: waiting.text, at: waiting.at } : null,
        lastRole: all.length ? all[all.length - 1].role : null,
        last: said ? { role: said.role, text: String(said.text || '').slice(0, LAST_MAX), at: said.at } : null,
        background: background(root, sid),
        chat: n > 0 ? all.slice(-n) : [],
    };
}

function stateOf(live, gate, snap) {
    if (gate) return 'gate';
    if (!live || !snap) return 'idle';
    if (snap.holding) return 'holding';
    if (!snap.lastRole) return 'idle';
    if (snap.lastRole !== 'assistant') return 'running';
    return snap.background.length ? 'background' : 'idle';
}

function rel(p, cwd) {
    const s = String(p || '');
    if (s && cwd && path.isAbsolute(s)) {
        const r = path.relative(cwd, s);
        if (r && !r.startsWith('..') && !path.isAbsolute(r)) return r.split(path.sep).join('/');
    }
    return s.replace(/\\/g, '/');
}

function stepOf(tool, input, cwd) {
    const name = String(tool || '');
    const i = input && typeof input === 'object' ? input : {};
    let label = name;
    let bg = false;
    if (name === 'Bash' || name === 'PowerShell') label = i.description || String(i.command || '').split(/\r?\n/)[0] || name;
    else if (name === 'Edit' || name === 'Write' || name === 'Read' || name === 'NotebookEdit') label = rel(i.file_path || i.notebook_path, cwd) || name;
    else if (name === 'Grep' || name === 'Glob') label = i.pattern || name;
    else if (name === 'Agent' || name === 'Task') {
        label = i.description || name;
        bg = i.run_in_background === true;
    } else {
        const m = /^mcp__(.+?)__(.+)$/.exec(name);
        if (m) label = m[1] + ' · ' + m[2];
    }
    label = String(label).replace(/\s+/g, ' ').trim();
    if (label.length > LABEL_MAX) label = label.slice(0, LABEL_MAX - 1) + '…';
    return bg ? { label, background: true } : { label };
}

function stepOk(response) {
    if (!response || typeof response !== 'object') return true;
    return !(response.is_error === true || response.success === false || response.interrupted === true);
}

module.exports = { SAY_MAX, dirOf, attach, detach, isAttached, say, take, append, chat, writeBackground, background, hold, snapshot, stateOf, stepOf, stepOk };
