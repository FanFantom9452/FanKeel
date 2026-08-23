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
const { entriesOverlap } = require('./overlap.js');


const STALE_MS = 12 * 60 * 60 * 1000;

// Task memory is two fields on the entry, and both are capped in code.
//
// Claude Code already remembers in four places — CLAUDE.md for project
// conventions, its own memory directory for durable facts, git history for what
// landed and why, and the compaction summary for earlier in this session. A
// fifth store would overlap all of them while being the one nobody reviews,
// which is how a memory file becomes a source of confident wrong answers rather
// than a help.
//
// What none of those hold is the state of a task in flight: what has been tried,
// what was decided on the way, what comes next. That is all this keeps, it is
// never version-controlled, and it dies when the task is stood down.
//
// The limits are enforced here rather than asked for in a skill file. A cap that
// depends on being remembered is not a cap.
const MAX_NOTES = 5;
const MAX_NOTE_LEN = 100;
const MAX_NEXT_LEN = 120;

const MAX_DRIFT = 5;
// A path is recorded whole or not at all. `trim` truncates, and a truncated path
// cannot be pasted into `scope --add` — an entry nobody can act on is worse than
// an absent one.
const MAX_DRIFT_LEN = 200;

// The same guard TokenBar applies before letting a session id reach a path. The
// id arrives from a hook payload, so it is checked rather than trusted for being
// ours.
const SESSION_ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/;

// Where Claude Code was opened. CLAUDE_PROJECT_DIR first: the shell's cwd drifts
// into subdirectories during a session, and this has to be the fixed point.
function launchRoot(payload) {
    return process.env.CLAUDE_PROJECT_DIR || (payload && payload.cwd) || process.cwd();
}

// The nearest ancestor that already holds a `.fankeel/sessions/`, the way git
// finds `.git`. This is what lets one registry cover several projects: put it at
// the directory they share and every session opened inside any of them joins it,
// whichever one it was opened in.
//
// `sessions/` and not `.fankeel/`, because the directory holds two things with
// different homes. The registry belongs to the workspace: one of it, so that two
// sessions in two projects can see each other. A docs tree belongs to a project:
// one per repository, version-controlled with the documents it describes.
//
// Looking for the parent directory found both. Declaring a docs tree for
// Waypoint wrote `Waypoint/.fankeel/docs.json`, and from that moment a session
// opened inside Waypoint walked up, hit that directory, and got a second
// registry — with the first one still live one level above. Neither side could
// see the other, and both looked healthy. The marker is now the thing the
// registry actually owns.
//
// It stops below the user's home directory. Above that is other people's
// business, and a registry picked up from `C:\Users` would be a surprise nobody
// could explain from what they typed. The filesystem root stops it too, for a
// project that lives outside home.
function findStateRoot(start) {
    const home = process.env.HOME || process.env.USERPROFILE;
    const stop = home ? path.resolve(home) : null;
    let dir;
    try {
        dir = path.resolve(start);
    } catch (e) {
        return null;
    }
    for (;;) {
        if (stop && dir === stop) return null;
        if (fs.existsSync(path.join(dir, '.fankeel', 'sessions'))) return dir;
        const up = path.dirname(dir);
        if (up === dir) return null;
        dir = up;
    }
}

// Where the registry is. An existing one above wins; otherwise it is wherever
// Claude Code was opened, which is also where a new one gets created.
//
// Both hooks go through this. Two hooks resolving the root differently is two
// hooks reading two registries.
function rootFor(payload) {
    const launch = launchRoot(payload);
    return findStateRoot(launch) || launch;
}

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
// that may depend on being remembered. One line, so that anything added under
// `.fankeel/` later is version-controlled by default with `sessions/` as the
// single explicit exception, rather than the other way round.
function ensureLayout(projectRoot) {
    const dir = sessionsDir(projectRoot);
    fs.mkdirSync(dir, { recursive: true });
    const ignore = path.join(stateDir(projectRoot), '.gitignore');
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, 'sessions/\n');
}

// Written to a sibling and renamed, because this file has several writers and a
// half-written one is silent. `hooks/touch.js` writes it on every new claim and
// `hooks/inject.js` on every prompt, so two of them land together sooner or
// later; a reader that catches the target mid-write gets a parse failure, and
// `readFile` turns a parse failure into `null`, which every consumer reads as
// "not in the mode". The session drops out of fankeel and nothing says so.
// Reading is safe on both platforms this way: nobody ever sees half a file.
// The rename is not — Windows refuses to rename over a target another handle
// still has open for read, where POSIX just repoints the name. Measured
// against a reader looping `readFileSync` on the target for 5s while this
// loops write-then-rename, no retry failed 86-93% of renames with EPERM;
// every failure discards a caller's write with no error, and `addClaim`
// (task 3) reads once and never comes back, so that loss is permanent (see
// task-2-report.md for the full numbers). A real collision is one hook's one
// `readFileSync`, open and closed in microseconds, not this test's tight
// spin — but the spin is what the retry has to survive to be trusted, and
// measurement is what set these two numbers: no delay, or a 1-2ms one,
// still lost 5-45% of renames to the spin; 5ms dropped it into the noise, 2
// failures in 229 writes over four 5-second runs. Worst case is 50 attempts
// x 5ms = 250ms, under 5% of the hooks' 5-second timeout, and only paid when
// every attempt collides.
const RENAME_ATTEMPTS = 50;
const RENAME_DELAY_MS = 5;
function sleepMs(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function renameRetrying(temp, file) {
    for (let attempt = 1; ; attempt++) {
        try {
            fs.renameSync(temp, file);
            return;
        } catch (e) {
            if (attempt >= RENAME_ATTEMPTS || (e.code !== 'EPERM' && e.code !== 'EBUSY')) throw e;
            sleepMs(RENAME_DELAY_MS);
        }
    }
}

let writeSeq = 0;
function writeSession(projectRoot, sessionId, data) {
    const file = sessionPath(projectRoot, sessionId);
    if (!file) return false;
    // Anything but `.json`: `readActive` takes every `.json` in the directory as
    // an entry, and would read this one while it is still being written. The pid
    // keeps two writers apart, the counter keeps one writer apart from itself.
    const temp = file + '.' + process.pid + '.' + (writeSeq++) + '.tmp';
    try {
        ensureLayout(projectRoot);
        fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
        renameRetrying(temp, file);
        return true;
    } catch (e) {
        try {
            fs.unlinkSync(temp);
        } catch (e2) {
            // Already gone, or never created. Either way there is nothing to clean up.
        }
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

const trim = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);

// Newest last, oldest evicted. A note that repeats one already held is dropped
// rather than pushing a still-useful one out — the same lesson learned twice is
// not two lessons.
function addNote(projectRoot, sessionId, note) {
    const text = trim(note, MAX_NOTE_LEN);
    if (!text) return false;
    const data = readSession(projectRoot, sessionId);
    if (!data) return false;
    const notes = Array.isArray(data.notes) ? data.notes.filter((n) => typeof n === 'string') : [];
    if (notes.includes(text)) return true;
    notes.push(text);
    data.notes = notes.slice(-MAX_NOTES);
    return writeSession(projectRoot, sessionId, data);
}

// Where the work went that the task never declared. Newest last, oldest evicted,
// and a repeat dropped rather than moved — the path drifted into first is the one
// that has been ignored longest, so it is the last one worth losing.
//
// It never touches `scope`. A guessed scope produces false collision warnings,
// and a false warning is worse than a missing one.
function addDrift(projectRoot, sessionId, rel) {
    const text = String(rel == null ? '' : rel).trim();
    if (!text || text.length > MAX_DRIFT_LEN) return false;
    const data = readSession(projectRoot, sessionId);
    if (!data) return false;
    const drift = Array.isArray(data.drift) ? data.drift.filter((d) => typeof d === 'string') : [];
    if (drift.includes(text)) return true;
    drift.push(text);
    data.drift = drift.slice(-MAX_DRIFT);
    return writeSession(projectRoot, sessionId, data);
}

// Filtered against the entry's *current* scope rather than deleted when the scope
// widens. `scope --add` therefore clears the line for free: no second code path,
// no bookkeeping that can disagree with itself, and no way for a cleared entry to
// come back.
function driftOf(data) {
    if (!data || !Array.isArray(data.drift)) return [];
    const scope = Array.isArray(data.scope) ? data.scope : [];
    return data.drift
        .filter((d) => typeof d === 'string' && d.trim())
        .filter((d) => !scope.some((s) => entriesOverlap(s, d)))
        .slice(-MAX_DRIFT);
}

// One line, replaced rather than appended. A list of next steps is a plan, and a
// plan belongs in a file someone agreed to.
function setNext(projectRoot, sessionId, next) {
    const data = readSession(projectRoot, sessionId);
    if (!data) return false;
    const text = trim(next, MAX_NEXT_LEN);
    if (text) data.next = text;
    else delete data.next;
    return writeSession(projectRoot, sessionId, data);
}

function notesOf(data) {
    if (!data || !Array.isArray(data.notes)) return [];
    return data.notes
        .filter((n) => typeof n === 'string' && n.trim())
        .slice(-MAX_NOTES)
        .map((n) => trim(n, MAX_NOTE_LEN));
}

function nextOf(data) {
    return trim(data && data.next, MAX_NEXT_LEN) || null;
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
    MAX_NOTES,
    MAX_NOTE_LEN,
    MAX_NEXT_LEN,
    MAX_DRIFT,
    MAX_DRIFT_LEN,
    addNote,
    addDrift,
    driftOf,
    setNext,
    notesOf,
    nextOf,
    launchRoot,
    findStateRoot,
    rootFor,
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
