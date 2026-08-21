'use strict';

// What this session has already lost.
//
// Compaction is not free and it is not reversible. The transcript records
// exactly what each one cost, so there is no need to guess at a percentage — and
// no need to know the window size, which the hook payload does not carry and the
// transcript does not either.
//
//   "compactMetadata": { "trigger": "manual", "preTokens": 479852,
//                        "postTokens": 24905, "cumulativeDroppedTokens": 1120198 }
//
// `cumulativeDroppedTokens` is the running total for the session, so the most
// recent entry is the whole answer and there is no counting to do.
//
// There are two triggers. A compaction having happened at all is one: compaction
// only happens when the window filled, so one is already proof this session
// reached its limit.
//
// The other is how much is in play now, because waiting for the first compaction
// means the warning always arrives after the loss rather than before it. 400k is
// the line, set from a session that sat around 300k through ordinary work — far
// enough above that to mean something, far enough below a 1M window to leave room
// to hand over calmly. A window smaller than that reaches its own compaction
// first, and the other trigger catches it.

const fs = require('node:fs');

// The last compaction sat 29KB from the end of a 13MB transcript, and 512KB
// caught two of them. A tail rather than the file, because this runs before
// every prompt and reading thirteen megabytes to find one number is not a thing
// to do sixty times an hour.
//
// A compaction older than the tail reads as none, and that is the right failure:
// it means a great deal has happened since without another one.
const TAIL = 512 * 1024;

// Tokens in play above which a session is worth moving out of, before the first
// compaction rather than after it.
const BUSY = 400000;

// The optional backslashes are not decoration. `usage` is a real field on a
// transcript line, but `compactMetadata` arrives nested inside a stringified
// payload, so on disk it reads \"cumulativeDroppedTokens\":326893 — quotes
// escaped. A pattern written for the plain form matches nothing and reports a
// session that has never compacted, which is the most reassuring possible way
// to be wrong.
const DROPPED = /\\?"cumulativeDroppedTokens\\?":\s*(\d+)/g;
const USAGE = /\\?"usage\\?":\s*\{([^}]*)\}/g;
const FIELD = (text, name) => {
    const m = new RegExp('\\\\?"' + name + '\\\\?":\\s*(\\d+)').exec(text);
    return m ? parseInt(m[1], 10) : 0;
};

function readTail(file, bytes) {
    let fd;
    try {
        fd = fs.openSync(file, 'r');
    } catch (e) {
        return null;
    }
    try {
        const size = fs.fstatSync(fd).size;
        const take = Math.min(size, bytes);
        const buf = Buffer.alloc(take);
        fs.readSync(fd, buf, 0, take, size - take);
        return buf.toString('utf8');
    } catch (e) {
        return null;
    } finally {
        try { fs.closeSync(fd); } catch (e) { /* closing a read handle */ }
    }
}

// What the session currently holds, from the most recent usage record. The three
// input figures together are the context that was sent, whatever share of it the
// cache served.
function usedFrom(text) {
    let last = null;
    USAGE.lastIndex = 0;
    let m;
    while ((m = USAGE.exec(text)) !== null) last = m[1];
    if (last === null) return null;
    const used = FIELD(last, 'input_tokens')
        + FIELD(last, 'cache_creation_input_tokens')
        + FIELD(last, 'cache_read_input_tokens');
    return used > 0 ? used : null;
}

function droppedFrom(text) {
    let last = null;
    DROPPED.lastIndex = 0;
    let m;
    while ((m = DROPPED.exec(text)) !== null) last = parseInt(m[1], 10);
    return Number.isFinite(last) ? last : null;
}

// Never throws and never reports a guess. A transcript that cannot be read, or
// carries neither figure, returns null and the caller says nothing — this is an
// extra line on a block that has to arrive whatever happens.
function inspect(transcriptPath) {
    if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) return null;
    const text = readTail(transcriptPath, TAIL);
    if (text === null) return null;
    const dropped = droppedFrom(text);
    const used = usedFrom(text);
    if (dropped === null && used === null) return null;
    return { dropped: dropped || 0, used: used || 0 };
}

const k = (n) => (n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : Math.round(n / 1000) + 'k');

// One line, and only when something has actually been lost. The advice is the
// part worth carrying: a new session is obvious, and that the task survives the
// move is not.
function contextLine(info) {
    if (!info) return null;
    const busy = info.used >= BUSY;
    if (!info.dropped && !busy) return null;

    const carry = 'A new terminal and /fankeel → Adopt carries this task over with its notes and its route.';
    if (!info.dropped) {
        return 'context: ' + k(info.used) + ' in play, nothing dropped yet. ' + carry;
    }
    const heavy = info.dropped >= 1000000;
    return 'context: ' + k(info.dropped) + ' tokens dropped to compaction so far'
        + (info.used ? ', ' + k(info.used) + ' in play now' : '') + '. '
        + (heavy ? 'Start a fresh session before the next one. ' : '')
        + carry;
}

module.exports = { inspect, contextLine, readTail, usedFrom, droppedFrom, TAIL, BUSY };
