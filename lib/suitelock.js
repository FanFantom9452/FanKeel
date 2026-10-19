'use strict';
// lib/suitelock.js: one scripts/suite.js run at a time on this machine. On
// 2026-10-16 several sessions ran the suite at once on one Windows machine and
// a different handful of tests failed each run, every one green alone. The
// lock is a file created with `wx` holding { pid, at, ...owner }, and `out`
// once the holder's suite has printed (ms epoch, refreshed at most every
// REFRESH_MS by lib/suite.js's relay). A holder is stale when its pid is not
// running, when the newer of `at` and `out` is older than MAX_AGE_MS (a reused
// Windows pid must not hold it forever; a lid closed mid-run is judged by when
// the suite last printed), or when the file has not parsed for FRESH_MS (a
// writer between create and write, or a refresh between truncate and write,
// leaves it empty).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sleepMs } = require('./registry.js');

const MAX_AGE_MS = 60 * 60 * 1000;
const POLL_MS = 2000;
const FRESH_MS = 5000;
const REFRESH_MS = 30 * 1000;

function lockFile(env = process.env) {
    return env.FANKEEL_SUITE_LOCK || path.join(os.tmpdir(), 'fankeel-suite.lock');
}

function alive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// The holder as written; null when there is no file; { unreadable, mtimeMs } when
// it cannot be read (a directory, another user's file) or is not a JSON object.
// mtimeMs comes from stat, so an unreadable lock still goes stale.
function holderOf(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
        if (e.code === 'ENOENT') return null;
        return unreadable(file);
    }
    try {
        const h = JSON.parse(text);
        if (h && typeof h === 'object' && !Array.isArray(h)) return h;
    } catch (e) { /* not JSON: unreadable below */ }
    return unreadable(file);
}

function unreadable(file) {
    try { return { unreadable: true, mtimeMs: fs.statSync(file).mtimeMs }; } catch (e) {
        return e.code === 'ENOENT' ? null : { unreadable: true, mtimeMs: 0 };
    }
}

function stale(holder, now, maxAgeMs) {
    if (holder.unreadable) return now - holder.mtimeMs > FRESH_MS;
    const at = Date.parse(holder.at);
    if (!alive(holder.pid) || !Number.isFinite(at)) return true;
    const last = Number.isFinite(holder.out) ? Math.max(at, holder.out) : at;
    return now - last > maxAgeMs;
}

function release(file) {
    const holder = holderOf(file);
    if (holder && holder.pid === process.pid) {
        try { fs.unlinkSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; /* ENOENT: already gone */ }
    }
}

// Writes `out: now` into the lock while it is still the one `mine` ({ pid, at })
// names. The check and the write go through one descriptor: a waiter that moves
// the file aside after the check moves this inode with it, so the write never
// lands in a lock another run has since created at the path. Best effort — a
// lock gone or taken over is false, never a throw.
function touch(file, mine, now = Date.now()) {
    let fd;
    try { fd = fs.openSync(file, 'r+'); } catch (e) { return false; }
    try {
        const h = JSON.parse(fs.readFileSync(fd, 'utf8'));
        if (!h || h.pid !== mine.pid || h.at !== mine.at) return false;
        const text = JSON.stringify({ ...h, out: now }) + '\n';
        fs.ftruncateSync(fd, 0);
        fs.writeSync(fd, text, 0);
        return true;
    } catch (e) {
        return false;
    } finally {
        fs.closeSync(fd);
    }
}

// The holder's output hook: called on every chunk its suite prints, it touches
// the lock at most once per everyMs, counted from the lock's own `at`.
function refresher(file, mine, everyMs = REFRESH_MS) {
    let last = Date.parse(mine.at);
    return (now = Date.now()) => {
        if (now - last < everyMs) return false;
        last = now;
        return touch(file, mine, now);
    };
}

// Moves the lock aside so only one renamer wins a given file, then unlinks it if
// it is the holder judged stale. A different lock moved aside (one taken between
// the judgement and the rename) is linked back, which fails rather than
// overwrite a lock a third process took in that instant; that lock then stands
// and the one moved aside is dropped. A rename Windows refuses because another
// process has the file open (EPERM, EBUSY, EACCES) is retried on the next pass.
function clearStale(file, holder) {
    const aside = file + '.' + process.pid + '.' + Date.now() + '.stale';
    try { fs.renameSync(file, aside); } catch (e) {
        if (['ENOENT', 'EPERM', 'EBUSY', 'EACCES'].includes(e.code)) return false;
        throw e;
    }
    if (JSON.stringify(holderOf(aside)) !== JSON.stringify(holder)) {
        try { fs.linkSync(aside, file); } catch (e) {
            // No hard links here (FAT, exFAT): put it back by rename, which can overwrite.
            if (e.code !== 'EEXIST') {
                try { fs.renameSync(aside, file); } catch (e2) {
                    // Both refused: the other process's lock survives only as the .stale
                    // copy, so for its run the lock lapses — two suites may overlap, unsaid.
                }
                return false;
            }
        }
        dropAside(aside);
        return false;
    }
    dropAside(aside);
    return true;
}

// A moved-aside copy that cannot be removed is litter beside the lock, never the
// lock itself, so a refused unlink leaves it rather than failing the run.
function dropAside(aside) {
    try { fs.unlinkSync(aside); } catch (e) { /* EPERM or EBUSY on Windows: litter, not a lock */ }
}

// Blocks until this process holds the lock. onWait(holder, stuck) is called when
// the run starts to wait and again whenever stuck changes: stuck false on a live
// holder, true on a stale one whose file could not be moved — a dead lock someone
// has to delete by hand. A holder judged stale goes through clearStale.
function acquire({ file = lockFile(), owner = {}, onWait = () => {}, pollMs = POLL_MS, maxAgeMs = MAX_AGE_MS } = {}) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let said = null;
    for (;;) {
        // Stamped per attempt: a run that waited an hour must not take the lock
        // already older than maxAgeMs.
        const at = new Date().toISOString();
        try {
            fs.writeFileSync(file, JSON.stringify({ ...owner, pid: process.pid, at }) + '\n', { flag: 'wx' });
            return { file, pid: process.pid, at, release: () => release(file) };
        } catch (e) {
            if (e.code !== 'EEXIST') throw e;
        }
        const holder = holderOf(file);
        if (holder === null) continue;
        const isStale = stale(holder, Date.now(), maxAgeMs);
        if (isStale) {
            if (clearStale(file, holder)) continue;
            // Taken by someone else meanwhile: judge the new holder. Unchanged means the
            // rename was refused, and that is waited on, said as stuck.
            if (JSON.stringify(holderOf(file)) !== JSON.stringify(holder)) continue;
        }
        if (said !== isStale) { said = isStale; onWait(holder, isStale); }
        sleepMs(pollMs);
    }
}

module.exports = { MAX_AGE_MS, REFRESH_MS, lockFile, acquire, clearStale, touch, refresher };
