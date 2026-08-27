'use strict';

// The statusline flag. TokenBar renders anything it finds in
// modes/<session_id>/, so this needs no change on that side: its CollectModes
// accepts any filename matching ^[a-z0-9][a-z0-9-]{0,31}$ and validates a plugin
// it has never heard of on shape alone.
//
// The word is the stage rather than an intensity. An intensity is a constant set
// once and then never looked at, while a statusline earns its space by showing
// what changes. `clash` takes the slot when it applies, because at that moment
// the collision outranks the stage, and the stage is still in the injected text.

const fs = require('node:fs');
const path = require('node:path');

// TokenBar's ReadMode lowercases, strips to [a-z0-9-] and rejects anything longer
// than 16 characters from a plugin it does not know. Doing the same here means
// what lands on disk is what renders, rather than a word silently dropped.
const MAX_WORD = 16;
const SESSION_ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/;

function badgeWord(stage, clash) {
    if (clash) return 'clash';
    const word = String(stage == null ? '' : stage)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, MAX_WORD);
    return word || 'on';
}

function badgePath(claudeDir, sessionId) {
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return null;
    return path.join(claudeDir, 'modes', sessionId, 'fankeel');
}

function writeBadge(claudeDir, sessionId, word) {
    const file = badgePath(claudeDir, sessionId);
    if (!file) return false;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, word + '\n');
        return true;
    } catch (e) {
        return false;
    }
}

// The word on disk, or null. One caller: `hooks/inject.js` has to know whether a
// badge belonging to no task is one it wrote itself, because clearing somebody
// else's flag is worse than leaving a stale one of your own.
//
// The same shape as every other reader here — it never throws, never creates, and
// answers null for a file that is missing, unreadable or empty.
function readBadge(claudeDir, sessionId) {
    const file = badgePath(claudeDir, sessionId);
    if (!file) return null;
    try {
        return fs.readFileSync(file, 'utf8').trim() || null;
    } catch (e) {
        return null;
    }
}

// The lead line's data, which is the badge with room to say something.
//
// A badge carries one word because that is all a shared line has room for. Once
// a plugin owns a line of its own it can say what the task is, how far along it
// is and who else is in the way — and everything said there is not said in the
// transcript, where it would cost output tokens every turn for the rest of the
// session.
//
// Values are written one per line as `key=value` with every control character
// stripped. An ESC reaching the terminal from here would let this file repaint
// the whole statusline, and it is written by a plugin rather than by the thing
// that renders it.
const LEAD_KEYS = ['word', 'step', 'steps', 'title', 'where', 'guard', 'others'];
const MAX_LEAD_VALUE = 160;

// Every C0 and C1 control. An ESC surviving into the lead file would let
// whatever wrote it repaint the entire statusline on every render, and the file
// is written by a plugin rather than by the thing that draws it.
const CONTROL = new RegExp('[\u0000-\u001f\u007f-\u009f]', 'g');

function leadPath(claudeDir, sessionId) {
    const file = badgePath(claudeDir, sessionId);
    return file ? file + '.lead' : null;
}

function writeLead(claudeDir, sessionId, fields) {
    const file = leadPath(claudeDir, sessionId);
    if (!file || !fields || !fields.word) return false;
    const lines = [];
    for (const key of LEAD_KEYS) {
        const raw = fields[key];
        if (raw === undefined || raw === null || raw === '') continue;
        const value = String(raw)
            .replace(CONTROL, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, MAX_LEAD_VALUE);
        if (value) lines.push(key + '=' + value);
    }
    if (!lines.length) return false;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, lines.join('\n') + '\n');
        return true;
    } catch (e) {
        return false;
    }
}

function clearLead(claudeDir, sessionId) {
    const file = leadPath(claudeDir, sessionId);
    if (!file) return false;
    try {
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        return false;
    }
}

// Standing a task down turns the mode off, and the badge has to go with it in the
// same breath. Leaving it would show a stage for a task that no longer exists —
// the statusline is the only place a lie about the mode is visible all the time.
//
// Only this plugin's flag is removed, never the directory: caveman and ponytail
// keep theirs in the same place.
function clearBadge(claudeDir, sessionId) {
    const file = badgePath(claudeDir, sessionId);
    if (!file) return false;
    try {
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        return false;
    }
}

// Sessions end without warning and their flag files outlive them. Only this
// plugin's own flag is ever removed, and the enclosing directory only when
// nothing else is left in it — caveman and ponytail keep their flags in the same
// place, and tidying is no reason to delete another plugin's state.
//
// Best effort throughout. Pruning is housekeeping; a prompt must never fail over
// it.
function pruneBadges(claudeDir, keepSessionId, maxAgeMs) {
    const modes = path.join(claudeDir, 'modes');
    let names;
    try {
        names = fs.readdirSync(modes);
    } catch (e) {
        return 0;
    }
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const name of names) {
        if (name === keepSessionId || !SESSION_ID.test(name)) continue;
        const dir = path.join(modes, name);
        const file = path.join(dir, 'fankeel');
        try {
            if (fs.statSync(file).mtimeMs > cutoff) continue;
            fs.rmSync(file);
            removed++;
            if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
        } catch (e) {
            // No flag of ours here, or it vanished between the read and the
            // unlink. Either way there is nothing to report.
        }
    }
    return removed;
}

module.exports = { MAX_WORD, badgeWord, writeBadge, readBadge, clearBadge, writeLead, clearLead, pruneBadges };
