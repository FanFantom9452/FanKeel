'use strict';

// Reading and writing `~/.claude/settings.json`.
//
// This is the user's own file and other tools write it too, so every rule here
// is about not damaging it:
//
//   - Unknown keys are preserved. This merges one field and rewrites the rest
//     exactly as it parsed.
//   - A file that does not parse is reported, never overwritten. A settings file
//     with a stray comma is a file someone is midway through editing.
//   - One backup, written before the first change and never overwritten
//     afterwards, so a later mistake cannot destroy the last good copy.
//   - A write that would change nothing does not happen at all, which keeps the
//     mtime honest and makes a re-run free.
//
// Written to a temporary file and renamed, so an interrupted write leaves the
// old settings rather than half of the new ones.

const fs = require('node:fs');
const path = require('node:path');

const BACKUP_SUFFIX = '.bak-fankeel';

function claudeDir(env) {
    const e = env || process.env;
    if (e.CLAUDE_CONFIG_DIR) return e.CLAUDE_CONFIG_DIR;
    const home = e.HOME || e.USERPROFILE;
    return home ? path.join(home, '.claude') : null;
}

const settingsPath = (dir) => path.join(dir, 'settings.json');

// `missing` and `unreadable` are different answers and the caller has to be able
// to tell them apart: the first is a file to create, the second is a file to
// leave alone.
function read(file) {
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (e) {
        if (e.code === 'ENOENT') return { state: 'missing', data: {}, raw: '' };
        return { state: 'unreadable', reason: e.message, raw: '' };
    }
    const body = raw.replace(/^﻿/, '');
    if (!body.trim()) return { state: 'empty', data: {}, raw };
    let data;
    try {
        data = JSON.parse(body);
    } catch (e) {
        return { state: 'unparseable', reason: e.message, raw };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { state: 'unparseable', reason: 'the top level is not an object', raw };
    }
    return { state: 'ok', data, raw };
}

// Two spaces and a trailing newline, which is what Claude Code itself writes, so
// a settings file this touched does not show up as a whole-file diff next time
// something else edits it.
const serialise = (data) => JSON.stringify(data, null, 2) + '\n';

function write(file, data, previousRaw) {
    const next = serialise(data);
    if (next === previousRaw) return { changed: false };

    // The config directory normally exists, but it does not on a machine where
    // Claude Code has never written settings, and a first run must not be the
    // one thing that fails.
    fs.mkdirSync(path.dirname(file), { recursive: true });

    if (previousRaw && !fs.existsSync(file + BACKUP_SUFFIX)) {
        fs.writeFileSync(file + BACKUP_SUFFIX, previousRaw, 'utf8');
    }
    const tmp = file + '.fankeel-tmp';
    fs.writeFileSync(tmp, next, 'utf8');
    fs.renameSync(tmp, file);
    return { changed: true, backup: previousRaw ? file + BACKUP_SUFFIX : null };
}

// `null` clears the field rather than writing a null, because a settings file
// full of explicit nulls is a settings file nobody can read at a glance.
function setOutputStyle(dir, styleFile) {
    const file = settingsPath(dir);
    const current = read(file);
    if (current.state === 'unreadable' || current.state === 'unparseable') {
        return { ok: false, state: current.state, reason: current.reason, file };
    }
    const data = current.data;
    const before = data.outputStyle;
    if (styleFile) data.outputStyle = styleFile;
    else delete data.outputStyle;

    let result;
    try {
        result = write(file, data, current.raw);
    } catch (e) {
        return { ok: false, state: 'write-failed', reason: e.message, file };
    }
    return { ok: true, file, before: before === undefined ? null : before, after: styleFile || null, changed: result.changed, backup: result.backup };
}

function currentOutputStyle(dir) {
    const current = read(settingsPath(dir));
    if (current.state !== 'ok') return null;
    const v = current.data.outputStyle;
    return typeof v === 'string' && v ? v : null;
}

module.exports = { BACKUP_SUFFIX, claudeDir, settingsPath, read, write, serialise, setOutputStyle, currentOutputStyle };
