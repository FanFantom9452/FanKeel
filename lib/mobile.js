'use strict';
// The phone station's data and page (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §4): what /station/mobile.json carries — the gates held for the station,
// the running tasks, what finished in the last 48 hours — read from the model
// gather() builds and cut to the fields the phone draws, a few kilobytes where
// the desktop's station-data.js is the whole machine; and the /m shell, its
// manifest and its icon. Pure: the server passes the model, the clock, this
// machine's name and the projects `station.hide` takes off the page.
const phone = require('./phone.js');
const station = require('./station.js');

const DONE_MS = 48 * 3600e3;
const DONE_MAX = 40;
const CHAT_TEXT_MAX = 8000;
// station.css's keel tokens (`--keel`, `--ground`, `--on-keel`).
const KEEL = '#2d5bd8';
const GROUND = '#f2f4f3';
const ON_KEEL = '#fbfcfc';
// station.css's keel dark `--ground`: the standalone status bar blends into the screen in dark
// mode (the 2026-10-27 mockup, taken from VoiceLedger); the light theme's is GROUND.
const DARK = '#10151d';
// The masthead's glyph on 120 x 120: six segments, then the core.
const GLYPH = [
    'M56.50 107.98L20.20 87.02L36.65 77.52L56.50 88.98Z',
    'M16.70 80.96L16.70 39.04L33.15 48.54L33.15 71.46Z',
    'M20.20 32.98L56.50 12.02L56.50 31.02L36.65 42.48Z',
    'M63.50 12.02L99.80 32.98L83.35 42.48L63.50 31.02Z',
    'M103.30 39.04L103.30 80.96L86.85 71.46L86.85 48.54Z',
    'M99.80 87.02L63.50 107.98L63.50 88.98L83.35 77.52Z',
    'M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z',
];

const tail = (root) => String(root || '').split(/[\\/]/).filter(Boolean).pop() || '';
const pricedUsd = (cost) => (cost && Array.isArray(cost.priced) && cost.priced.length && Number.isFinite(cost.usd) ? cost.usd : null);
const held = (s, now) => Boolean(s.pending && Array.isArray(s.pending.questions) && s.pending.until > now);

// Every row on the page, without the projects `station.hide` takes off — the
// key is lib/station.js's pkey, `root` or `root + '/' + project`.
function rowsOf(model, hidden) {
    const out = [];
    for (const r of (model && Array.isArray(model.registries)) ? model.registries : []) {
        for (const s of Array.isArray(r.sessions) ? r.sessions : []) {
            if (hidden && hidden.has(s.project ? r.root + '/' + s.project : r.root)) continue;
            out.push({ root: r.root, s });
        }
    }
    return out;
}

// What every list's row carries, and nothing else of the entry.
function base(root, s) {
    return { id: s.sessionId, root, task: s.task || '', project: s.project || tail(root), stage: s.stage || '', route: Array.isArray(s.route) ? s.route : [] };
}

// The gate entry as the phone draws it, or null when none is held.
function gateOf(s, now) {
    if (!held(s, now)) return null;
    return {
        questions: s.pending.questions,
        since: Number.isFinite(s.gateAt) ? s.gateAt : Number.isFinite(s.pending.at) ? s.pending.at : now,
        until: s.pending.until,
    };
}

// `look` is lib/phone.js's snapshot, passed by the server; a model with no
// look reads every session as having no conversation yet.
function rowOf(root, s, now, look) {
    const p = look ? look(root, s.sessionId, now, 0) : null;
    const gate = held(s, now);
    return Object.assign(base(root, s), {
        gate, updated: Number.isFinite(s.updated) ? s.updated : null,
        state: phone.stateOf(true, gate, p),
        attached: Boolean(p && p.attached), background: p ? p.background : [], last: p ? p.last : null,
        holdUntil: p && Number.isFinite(p.holdUntil) ? p.holdUntil : null,
    });
}

// What the phone draws for the running sessions no registry lists (lib/station.js
// unregisteredOf, `station.hide` already applied), each on this machine.
function unregOf(model, hidden, host) {
    return station.unregisteredOf(model || {}, hidden || new Set()).map((u) => ({
        id: u.id, cwd: u.cwd || '', entrypoint: u.entrypoint || '', name: u.name || '', status: u.status || '',
        bridge: Boolean(u.bridge), started: Number.isFinite(u.started) ? u.started : null, machine: String(host || ''),
    }));
}

// design §3: what has Remote Control attached now — registry sessions still running with
// `bridge`, then the unregistered ones. `kind` says which screen a row opens.
function rcLive(model, hidden, host) {
    const name = String(host || '');
    const reg = rowsOf(model, hidden).filter(({ s }) => s.state === 'live' && s.bridge)
        .map(({ root, s }) => ({ id: s.sessionId, kind: 'reg', task: s.task || '', name: '', cwd: root, entrypoint: '', status: '', started: null, machine: name }));
    const un = unregOf(model, hidden, name).filter((u) => u.bridge)
        .map((u) => ({ id: u.id, kind: 'unreg', task: '', name: u.name, cwd: u.cwd, entrypoint: u.entrypoint, status: u.status, started: u.started, machine: name }));
    return reg.concat(un);
}

// design §2: the other computers' own rows merged in. `peers` is lib/peers.js poller().machines():
// an 'on' computer's rows as they are; an 'off' one's last rows marked `was` with when it was
// seen, its gates dropped (nothing can answer them) and its RC rows moved to ended; an
// 'unpaired' or 'wait' one only listed. The first machine is always this one.
function merge(own, peers) {
    const out = Object.assign({}, own, {
        gates: own.gates.slice(), tasks: own.tasks.slice(), stopped: own.stopped.slice(), done: own.done.slice(),
        unregistered: own.unregistered.slice(), rc: { live: own.rc.live.slice(), ended: own.rc.ended.slice() },
    });
    const count = (b) => (Array.isArray(b.tasks) ? b.tasks.length : 0) + (Array.isArray(b.stopped) ? b.stopped.length : 0) + (Array.isArray(b.unregistered) ? b.unregistered.length : 0);
    const list = (v) => (Array.isArray(v) ? v : []);
    const machines = [{ name: own.host, url: null, state: 'on', me: true, seen: own.at, paired: null, refused: false, n: count(own) }];
    for (const p of Array.isArray(peers) ? peers : []) {
        if (!p || typeof p.name !== 'string' || !p.name) continue;
        const b = p.body && typeof p.body === 'object' ? p.body : null;
        const seen = Number.isFinite(p.seen) ? p.seen : null;
        machines.push({
            name: p.name, url: typeof p.url === 'string' ? p.url : null, state: p.state, me: false, seen,
            paired: Number.isFinite(p.paired) ? p.paired : null, refused: Boolean(p.refused), n: b ? count(b) : 0,
        });
        if (!b || (p.state !== 'on' && p.state !== 'off')) continue;
        const was = p.state === 'off';
        const tag = (x) => Object.assign({}, x, { machine: p.name }, was ? { was: true, seen } : {});
        if (!was) out.gates.push(...list(b.gates).map(tag));
        out.tasks.push(...list(b.tasks).map(tag));
        out.stopped.push(...list(b.stopped).map(tag));
        out.done.push(...list(b.done).map(tag));
        out.unregistered.push(...list(b.unregistered).map(tag));
        const rc = b.rc && typeof b.rc === 'object' ? b.rc : {};
        if (was) out.rc.ended.push(...list(rc.live).concat(list(rc.ended)).map((x) => Object.assign(tag(x), { at: Number.isFinite(x.at) ? x.at : seen })));
        else {
            out.rc.live.push(...list(rc.live).map(tag));
            out.rc.ended.push(...list(rc.ended).map(tag));
        }
    }
    out.gates.sort((a, b) => a.since - b.since);
    out.tasks.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    out.stopped.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    out.done.sort((a, b) => b.at - a.at || (a.kind === b.kind ? 0 : a.kind === 'end' ? -1 : 1));
    out.done = out.done.slice(0, DONE_MAX);
    out.unregistered.sort((a, b) => (b.started || 0) - (a.started || 0));
    out.rc.ended.sort((a, b) => (b.at || 0) - (a.at || 0));
    out.machines = machines;
    return out;
}

// `more` (docs/90-agent/plans/2026-10-29-mobile-sources.md, Task 1): `peers`, the other computers
// (lib/peers.js), and `rcEnded`, lib/rcseen.js note()'s ended rows for this machine.
function mobileModel(model, now, host, hidden, look, me, others, more) {
    const name = String(host || '');
    const extra = more && typeof more === 'object' ? more : {};
    const all = rowsOf(model, hidden);
    const stamp = (x) => Object.assign(x, { machine: name });
    const gates = all.filter(({ s }) => held(s, now))
        .map(({ root, s }) => stamp(Object.assign(base(root, s), gateOf(s, now))))
        .sort((a, b) => a.since - b.since);
    const tasks = all.filter(({ s }) => s.state === 'live')
        .map(({ root, s }) => stamp(rowOf(root, s, now, look)))
        .sort((a, b) => (b.updated || 0) - (a.updated || 0));
    // A session that stopped with its gate still held (station-47): answerable
    // from the phone, in a group of its own so it is not read as running.
    const stopped = all.filter(({ s }) => s.state !== 'live' && held(s, now))
        .map(({ root, s }) => stamp(Object.assign(rowOf(root, s, now, look), { state: 'gate' })))
        .sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const done = [];
    for (const { root, s } of all) {
        for (const w of Array.isArray(s.stages) ? s.stages : []) {
            if (!w || !Number.isFinite(w.to) || now - w.to > DONE_MS) continue;
            // The stage a session is still in has not finished.
            if (s.state !== 'down' && w.stage === s.stage) continue;
            done.push(stamp(Object.assign(base(root, s), { kind: 'stage', stage: w.stage, at: w.to, usd: Number.isFinite(w.usd) ? w.usd : null })));
        }
        const ended = s.ended && typeof s.ended.at === 'string' ? Date.parse(s.ended.at) : NaN;
        if (Number.isFinite(ended) && now - ended <= DONE_MS) {
            const own = pricedUsd(s.cost);
            const theirs = pricedUsd(s.agentCost);
            done.push(stamp(Object.assign(base(root, s), {
                kind: 'end', stage: s.stage || '', at: ended,
                usd: own === null && theirs === null ? null : (own || 0) + (theirs || 0),
                stages: Array.isArray(s.stages) ? s.stages.length : 0,
            })));
        }
    }
    done.sort((a, b) => b.at - a.at || (a.kind === b.kind ? 0 : a.kind === 'end' ? -1 : 1));
    // `me` is lib/remote.js deviceFor()'s answer for the phone asking; none from this machine.
    const device = me ? { name: String(me.name || ''), paired: Number.isFinite(me.paired) ? me.paired : null } : null;
    const ended = (Array.isArray(extra.rcEnded) ? extra.rcEnded : []).map((x) => ({
        id: x.id, kind: x.kind === 'reg' ? 'reg' : 'unreg', task: x.task || '', name: x.name || '', cwd: x.cwd || '', entrypoint: x.entrypoint || '', at: x.last, machine: name,
    }));
    const own = {
        host: name, at: now, device, gates, tasks, stopped, done: done.slice(0, DONE_MAX), others: Array.isArray(others) ? others : [],
        unregistered: unregOf(model, hidden, name), rc: { live: rcLive(model, hidden, name), ended },
    };
    return merge(own, extra.peers);
}

// (b) in docs/90-agent/plans/2026-10-29-mobile-sources.md: an unregistered session's own
// transcript (lib/usage.js entriesOf) as lib/phone.js chat lines — what the hooks write for a
// registered one: typed text as `desktop`, Claude's text, each tool call and its end.
// Sidechain (sub-agent) and meta lines are not the conversation and are skipped.
function chatOfTranscript(entries, cwd, n) {
    const out = [];
    for (const e of Array.isArray(entries) ? entries : []) {
        if (!e || e.isSidechain || e.isMeta || (e.type !== 'user' && e.type !== 'assistant')) continue;
        const t = Date.parse(e.timestamp);
        const at = Number.isFinite(t) ? t : null;
        const c = e.message && e.message.content;
        const parts = typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : [];
        for (const p of parts) {
            if (!p || typeof p !== 'object') continue;
            if (p.type === 'text' && String(p.text || '').trim()) {
                out.push({ role: e.type === 'assistant' ? 'assistant' : 'desktop', text: String(p.text).slice(0, CHAT_TEXT_MAX), at });
            } else if (p.type === 'tool_use' && e.type === 'assistant') {
                out.push(Object.assign({ role: 'tool', id: String(p.id || ''), tool: String(p.name || ''), at }, phone.stepOf(p.name, p.input, cwd)));
            } else if (p.type === 'tool_result') {
                out.push({ role: 'tool-end', id: String(p.tool_use_id || ''), ok: p.is_error !== true, at });
            }
        }
    }
    return n > 0 ? out.slice(-n) : out;
}

// /station/unreg.json (Task 3): one unregistered session's read-only screen. `live` is false
// for one lib/rcseen.js still remembers but no process runs; the server fills `context`.
function unregModel(u, entries, now, host, live) {
    const on = Boolean(live);
    return {
        id: u.id, machine: String(host || ''), name: u.name || '', task: u.task || '', cwd: u.cwd || '', entrypoint: u.entrypoint || '',
        bridge: on && Boolean(u.bridge), status: on ? (u.status || '') : 'ended',
        state: !on ? 'ended' : u.status === 'busy' ? 'running' : 'idle',
        chat: chatOfTranscript(entries, u.cwd, 50), at: now, context: null, limits: null,
    };
}

// /station/phone.json: one session's conversation screen.
function phoneModel(model, id, now, hidden, look) {
    const hit = rowsOf(model, hidden).find(({ s }) => s.sessionId === id);
    if (!hit) return null;
    const { root, s } = hit;
    const p = look ? look(root, s.sessionId, now, 50) : null;
    const gate = gateOf(s, now);
    return Object.assign(base(root, s), {
        state: phone.stateOf(s.state === 'live', Boolean(gate), p),
        attached: Boolean(p && p.attached), waiting: p ? p.waiting : null, chat: p ? p.chat : [],
        gate, background: p ? p.background : [], at: now,
        holdUntil: p && Number.isFinite(p.holdUntil) ? p.holdUntil : null,
        // The server fills these two (scripts/station.js, /station/phone.json).
        context: null, limits: null,
    });
}

// The TokenBar's context meter. hooks/pane-bar.ts's Context is {tokens, at, window}, but only the
// pane hears the engine's window, so the server sends `window: null` and the phone measures the
// transcript's last usage (lib/context.js inspect().used) against the profile's compact.at.
function contextOf(seen, compactAt) {
    if (!seen || !(seen.used > 0)) return null;
    const at = Number(compactAt);
    return { tokens: seen.used, at: Number.isFinite(at) && at > 0 ? at : null, window: null };
}

// The newest 5h / 7d reading in one session's .fankeel/build/limits/<sid>.jsonl (hooks/pane-limits.ts
// LimitRow), its times in epoch ms. A tail's first line is cut mid-row and does not parse.
function limitsOf(text) {
    const pct = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const when = (v) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
    let best = null;
    for (const raw of String(text || '').split('\n')) {
        let j;
        try {
            j = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        if (!j || typeof j.at !== 'string') continue;
        const at = Date.parse(j.at);
        if (!Number.isFinite(at) || (best && best.at >= at)) continue;
        if (pct(j.five) === null && pct(j.seven) === null) continue;
        best = { at, five: pct(j.five), fiveResets: when(j.fiveResets), seven: pct(j.seven), sevenResets: when(j.sevenResets) };
    }
    return best;
}

// The /m page: one app-like column, drawn by /station/mobile.js into #app.
function shell() {
    return '<!doctype html>\n'
        + '<html lang="zh-Hant" data-style="keel"><head><meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="' + DARK + '">\n'
        + '<meta name="theme-color" media="(prefers-color-scheme: light)" content="' + GROUND + '">\n'
        + '<title>fankeel 測站</title>\n'
        + '<link rel="manifest" href="/m/manifest.webmanifest">\n'
        + '<link rel="icon" href="/m/icon.svg" type="image/svg+xml">\n'
        + '<link rel="stylesheet" href="/station/station.css">\n'
        + '<link rel="stylesheet" href="/station/mobile.css">\n'
        + '</head><body class="m"><div class="scr" id="app" data-block="app"></div>\n'
        + '<script src="/station/mobile.js"></script>\n'
        + '</body></html>\n';
}

function manifest() {
    return JSON.stringify({
        name: 'fankeel 測站', short_name: 'fankeel', id: '/m', start_url: '/m', scope: '/', display: 'standalone',
        background_color: GROUND, theme_color: DARK,
        icons: [{ src: '/m/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    }, null, 2) + '\n';
}

function icon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="26" fill="' + KEEL + '"/>'
        + '<g transform="translate(15 15) scale(.75)">' + GLYPH.map((d) => '<path d="' + d + '" fill="' + ON_KEEL + '"/>').join('') + '</g></svg>\n';
}

module.exports = { mobileModel, phoneModel, contextOf, limitsOf, shell, manifest, icon, unregOf, rcLive, unregModel };
