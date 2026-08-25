'use strict';

// Which sessions are actually running. This reads Claude Code's own registry —
// `<config>/sessions/`, one `<pid>.json` per live interactive session — rather
// than fankeel's, because fankeel's records what a session said about itself and
// this has to record what the operating system knows about it.
//
// It replaces a staleness threshold that could not work. Across eight sessions
// that were all running, the time since each had last said anything ran from 0.1h
// to 268.5h, so no cutoff separates the two populations: idleness is a fact about
// a person and not about a process. What separates live from dead is the process.
//
// Claude Code deletes its own file when it exits cleanly, so an absent file is a
// session that ended. A crash or a killed terminal leaves the file behind and
// nothing collects the directory, which is why the pid is signalled rather than
// the file merely counted.
//
// Nothing here writes. Liveness is an observation, the same way staleness was.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// `CLAUDE_CONFIG_DIR` moves the whole config tree, sessions included. Reading the
// home directory while it is set would answer from a registry this machine is not
// the one using.
function liveConfigDir() {
    return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

// EPERM counts as dead: a pid this user cannot signal is not one of this user's
// Claude Code sessions. ESRCH is the ordinary answer for an orphan.
//
// ponytail: pid reuse is the ceiling. `procStart` on each entry is the field that
// defeats it — a Windows FILETIME that matched `Get-Process .StartTime` to the
// tick on all eight entries — but Node has no portable way to read a process start
// time, so it is not checked. The window needs a crash, an orphan, and a reuse of
// that exact pid by a process this user owns. `claude agents --json` answers the
// same question authoritatively at 1.67 seconds a call, and is the upgrade path.
function running(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

// One readdir and one readFileSync per entry, and no child process. This runs in
// hooks that fire on every prompt and every edit in every session on the machine,
// which is a budget `claude agents --json` cannot fit inside however authoritative
// it is.
//
// The self-check is free and exact: this session is running, so its own id must be
// found alive in what was read. When it is not, the directory being read is not
// the one this machine uses — moved, or reshaped by a version that does not write
// these fields — and every answer taken from it would be wrong in the dangerous
// direction, with claims silently dropped and collisions silently missed. So that
// case reports unknown rather than a set, and `isLive` turns unknown into live.
//
// A file that does not parse, carries no pid, carries no sessionId, or is not
// `.json` at all is skipped rather than thrown over: the directory holds `.key`
// files beside the entries, and one unreadable neighbour must not cost the rest.
// The set itself, with no self-check. Null when the directory cannot be read at
// all, which is the only case a caller cannot tell from an empty machine.
//
// Separate from `readLive` because the two have different stakes. A hook that
// answers wrongly drops a claim or hides a collision, so it refuses; a listing
// that answers wrongly prints a low number, and a number is worth more than a
// refusal there — `readLive(dir, null)` is never self-found, so `isLive` would
// turn every entry live and the count would equal the active count in every
// case, which answers nothing.
function runningIds(configDir) {
    const dir = path.join(String(configDir == null ? '' : configDir), 'sessions');
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return null;
    }
    const ids = new Set();
    for (const name of names) {
        if (!name.endsWith('.json')) continue;
        let data;
        try {
            data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        } catch (e) {
            continue;
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
        if (typeof data.sessionId !== 'string' || !data.sessionId) continue;
        if (!running(data.pid)) continue;
        ids.add(data.sessionId);
    }
    return ids;
}

function readLive(configDir, mySessionId) {
    const dir = String(configDir == null ? '' : configDir);
    const ids = runningIds(dir);
    // `others` caches one scan per neighbouring directory for the life of this
    // answer, which is one hook invocation or one command. Module scope would
    // outlive the answer it caches and would need a reset nobody could test
    // around.
    const others = new Map();
    if (!ids || !ids.has(mySessionId)) return { known: false, ids: new Set(), configDir: dir, others };
    return { known: true, ids, configDir: dir, others };
}

// Unknown means live. A warning that fires over a session that has already gone
// is noise; a warning suppressed over a session that is still in the file is two
// terminals overwriting each other, so the doubt goes to the loud side.
//
// `theirConfigDir` is the directory that session says it is running under.
// Absent, this is the answer it always gave. Different from the one already
// scanned, it is the only place their liveness file exists — the self-check
// passing says nothing about a registry this session never reads, so without
// this the answer came back `known: true` with a running neighbour missing from
// it. Measured: two live pids in two config dirs, and the neighbour judged dead.
function isLive(state, sessionId, theirConfigDir) {
    if (!state) return true;
    const theirs = String(theirConfigDir || '');
    if (theirs && theirs !== state.configDir) {
        if (!state.others.has(theirs)) state.others.set(theirs, runningIds(theirs));
        const ids = state.others.get(theirs);
        return !ids || ids.has(sessionId);
    }
    if (state.known !== true) return true;
    return state.ids.has(sessionId);
}

module.exports = { liveConfigDir, runningIds, readLive, isLive };
