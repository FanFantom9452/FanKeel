'use strict';
// The phone station's data and page (docs/90-agent/plans/2026-10-21-station-remote-design.md
// §4): what /station/mobile.json carries — the gates held for the station,
// the running tasks, what finished in the last 48 hours — read from the model
// gather() builds and cut to the fields the phone draws, a few kilobytes where
// the desktop's station-data.js is the whole machine; and the /m shell, its
// manifest and its icon. Pure: the server passes the model, the clock, this
// machine's name and the projects `station.hide` takes off the page.
const phone = require('./phone.js');

const DONE_MS = 48 * 3600e3;
const DONE_MAX = 40;
// station.css's keel tokens (`--keel`, `--ground`, `--on-keel`).
const KEEL = '#2d5bd8';
const GROUND = '#f2f4f3';
const ON_KEEL = '#fbfcfc';
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
    });
}

function mobileModel(model, now, host, hidden, look) {
    const all = rowsOf(model, hidden);
    const gates = all.filter(({ s }) => held(s, now))
        .map(({ root, s }) => Object.assign(base(root, s), gateOf(s, now)))
        .sort((a, b) => a.since - b.since);
    const tasks = all.filter(({ s }) => s.state === 'live')
        .map(({ root, s }) => rowOf(root, s, now, look))
        .sort((a, b) => (b.updated || 0) - (a.updated || 0));
    // A session that stopped with its gate still held (station-47): answerable
    // from the phone, in a group of its own so it is not read as running.
    const stopped = all.filter(({ s }) => s.state !== 'live' && held(s, now))
        .map(({ root, s }) => Object.assign(rowOf(root, s, now, look), { state: 'gate' }))
        .sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const done = [];
    for (const { root, s } of all) {
        for (const w of Array.isArray(s.stages) ? s.stages : []) {
            if (!w || !Number.isFinite(w.to) || now - w.to > DONE_MS) continue;
            // The stage a session is still in has not finished.
            if (s.state !== 'down' && w.stage === s.stage) continue;
            done.push(Object.assign(base(root, s), { kind: 'stage', stage: w.stage, at: w.to, usd: Number.isFinite(w.usd) ? w.usd : null }));
        }
        const ended = s.ended && typeof s.ended.at === 'string' ? Date.parse(s.ended.at) : NaN;
        if (Number.isFinite(ended) && now - ended <= DONE_MS) {
            const own = pricedUsd(s.cost);
            const theirs = pricedUsd(s.agentCost);
            done.push(Object.assign(base(root, s), {
                kind: 'end', stage: s.stage || '', at: ended,
                usd: own === null && theirs === null ? null : (own || 0) + (theirs || 0),
                stages: Array.isArray(s.stages) ? s.stages.length : 0,
            }));
        }
    }
    done.sort((a, b) => b.at - a.at || (a.kind === b.kind ? 0 : a.kind === 'end' ? -1 : 1));
    return { host: String(host || ''), at: now, gates, tasks, stopped, done: done.slice(0, DONE_MAX) };
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
    });
}

// The /m page: one app-like column, drawn by /station/mobile.js into #app.
function shell() {
    return '<!doctype html>\n'
        + '<html lang="zh-Hant" data-style="keel"><head><meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + '<meta name="theme-color" content="' + KEEL + '">\n'
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
        background_color: GROUND, theme_color: KEEL,
        icons: [{ src: '/m/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    }, null, 2) + '\n';
}

function icon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="26" fill="' + KEEL + '"/>'
        + '<g transform="translate(15 15) scale(.75)">' + GLYPH.map((d) => '<path d="' + d + '" fill="' + ON_KEEL + '"/>').join('') + '</g></svg>\n';
}

module.exports = { mobileModel, phoneModel, shell, manifest, icon };
