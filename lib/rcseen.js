'use strict';
// The RC 對話 tab's 已結束 half (docs/90-agent/plans/2026-10-29-mobile-sources-design.md §3):
// every session this machine saw with Remote Control attached in the last 48 hours, so one
// that has ended can still be listed. One store, `<configDir>/fankeel/rc-seen.json`, in the
// config directory like remote.json, written only when a session is first seen, its `last`
// is a minute old, or an entry drops out (past 48 hours or beyond the newest 40) — the phone
// reads mobile.json every 5 s.
const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const { writeAtomic } = require('./registry.js');

const KEEP_MS = 48 * 3600e3;
const KEEP_MAX = 40;
const TOUCH_MS = 60e3;

const storePath = (configDir) => path.join(String(configDir || ''), 'fankeel', 'rc-seen.json');

function load(configDir) {
    const d = readObject(storePath(configDir)) || {};
    return Array.isArray(d.sessions) ? d.sessions.filter((x) => x && typeof x.id === 'string' && Number.isFinite(x.last)) : [];
}

// `live` is lib/mobile.js rcLive()'s rows for this machine now. Answers the ones that
// ended: seen inside 48 hours, not live now, newest first.
function note(configDir, live, now) {
    const rows = Array.isArray(live) ? live : [];
    const byId = new Map(load(configDir).map((x) => [x.id, x]));
    let dirty = false;
    for (const r of rows) {
        const row = { id: r.id, kind: r.kind === 'reg' ? 'reg' : 'unreg', name: r.name || '', cwd: r.cwd || '', entrypoint: r.entrypoint || '', task: r.task || '', last: now };
        const had = byId.get(r.id);
        if (!had) {
            byId.set(r.id, row);
            dirty = true;
        } else if (now - had.last >= TOUCH_MS) {
            Object.assign(had, row);
            dirty = true;
        }
    }
    const kept = [...byId.values()].filter((x) => now - x.last <= KEEP_MS).sort((x, y) => y.last - x.last).slice(0, KEEP_MAX);
    if (kept.length !== byId.size) dirty = true;
    if (dirty) {
        const file = storePath(configDir);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        writeAtomic(file, JSON.stringify({ sessions: kept }, null, 2) + '\n');
    }
    const on = new Set(rows.map((r) => r.id));
    return kept.filter((x) => !on.has(x.id));
}

// One kept session, for /station/unreg.json on a session that has ended.
function find(configDir, id) {
    return load(configDir).find((x) => x.id === id) || null;
}

module.exports = { note, find };
