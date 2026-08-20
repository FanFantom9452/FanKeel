'use strict';

// The registry is the directory `.fankeel/sessions/` inside the project being
// worked on. One file per session, named for the session that owns it, so no
// session ever writes another's and no id has to be invented.
//
// Nothing here deactivates anything. `active` goes false only when the entry
// skill is told to stand a task down; a session ending, a timer expiring and a
// terminal dying all leave the entry exactly as it was. Staleness below is an
// observation about age, offered to whoever is reading, and never a state change.

const fs = require('node:fs');
const path = require('node:path');

const STALE_MS = 12 * 60 * 60 * 1000;

// The same guard TokenBar applies before letting a session id reach a path. The
// id arrives from a hook payload, so it is checked rather than trusted for being
// ours.
const SESSION_ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/;

function stateDir(projectRoot) {
    return path.join(projectRoot, '.fankeel');
}

function sessionsDir(projectRoot) {
    return path.join(stateDir(projectRoot), 'sessions');
}

function sessionPath(projectRoot, sessionId) {
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return null;
    return path.join(sessionsDir(projectRoot), sessionId + '.json');
}

// A file that does not parse, or parses to something that is not a plain object,
// is not an error worth propagating: the caller is rendering a hook line, and one
// broken entry must not cost the other entries or the turn.
function readFile(file) {
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    let data;
    try {
        data = JSON.parse(raw.replace(/^﻿/, ''));
    } catch (e) {
        return null;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return data;
}

function readSession(projectRoot, sessionId) {
    const file = sessionPath(projectRoot, sessionId);
    if (!file) return null;
    return readFile(file);
}

// Active entries only, sorted by session id so two runs over one directory render
// the same order. `active` must be exactly true — a missing field is not an
// invitation to guess.
function readActive(projectRoot) {
    const dir = sessionsDir(projectRoot);
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return [];
    }
    const out = [];
    for (const name of names.sort()) {
        if (!name.endsWith('.json')) continue;
        const sessionId = name.slice(0, -'.json'.length);
        if (!SESSION_ID.test(sessionId)) continue;
        const data = readFile(path.join(dir, name));
        if (!data || data.active !== true) continue;
        out.push({ sessionId, data });
    }
    return out;
}

// Written the moment the directory is created rather than left to the entry
// skill, because a skill is read by a model and this is not the kind of thing
// that may depend on being remembered. One line, so `.fankeel/memory/` — which
// sub-project 2 adds — lands in version control by default, with the volatile
// half as the single explicit exception.
function ensureLayout(projectRoot) {
    const dir = sessionsDir(projectRoot);
    fs.mkdirSync(dir, { recursive: true });
    const ignore = path.join(stateDir(projectRoot), '.gitignore');
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, 'sessions/\n');
}

function writeSession(projectRoot, sessionId, data) {
    const file = sessionPath(projectRoot, sessionId);
    if (!file) return false;
    try {
        ensureLayout(projectRoot);
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
        return true;
    } catch (e) {
        return false;
    }
}

// Refreshes the timestamp staleness is measured from, and touches nothing else.
// Creates nothing: a session with no entry is a session not in the mode, and
// this must not be what puts it in one.
function touch(projectRoot, sessionId) {
    const data = readSession(projectRoot, sessionId);
    if (!data) return false;
    data.updated = new Date().toISOString();
    return writeSession(projectRoot, sessionId, data);
}

function updatedAt(data) {
    const t = Date.parse((data && data.updated) || '');
    return Number.isNaN(t) ? null : t;
}

// An entry with no usable timestamp is not stale. Staleness exists to soften a
// claim, never to invent one about an entry that has not said anything.
function isStale(data, now) {
    const t = updatedAt(data);
    if (t === null) return false;
    return (now - t) > STALE_MS;
}

function ageText(data, now) {
    const t = updatedAt(data);
    if (t === null) return null;
    const ms = Math.max(0, now - t);
    const hours = Math.floor(ms / 3600e3);
    if (hours < 1) return '<1h';
    if (hours < 24) return hours + 'h';
    return Math.floor(hours / 24) + 'd';
}

module.exports = {
    STALE_MS,
    stateDir,
    sessionsDir,
    sessionPath,
    readSession,
    readActive,
    ensureLayout,
    writeSession,
    touch,
    isStale,
    ageText,
};
