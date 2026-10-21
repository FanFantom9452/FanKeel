'use strict';
// A session's background shells, for the station's live rows and its detail.
// Claude Code gives a `run_in_background` Bash or PowerShell call an id —
// `toolUseResult.backgroundTaskId` on the tool_result line, paired to the
// tool_use by `tool_use_id` — and writes the shell's output to
// `<tmp>/claude/<project slug>/<session>/tasks/<id>.output`, ending it with
// `[exited with code N]` when the shell ends, sometimes with one more line
// after it (`Shell cwd was reset to …`). No marker is a shell still running, except
// a bare `[killed]`, which is ended with no code; a file that has gone is also a
// shell that ended with a code nobody can know. The
// agents' own `a*.output` files sit in the same directory and are never asked
// about: only the ids a transcript paired count.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readTail } = require('./context');

// Bytes read from the end of an output file: the marker and the note after it fit.
const TAIL = 256;
// Running shells first, then at most ENDED_ROWS ended ones, at most ROWS in all.
const ENDED_ROWS = 2;
const ROWS = 3;
const MARK = /\[exited with code (-?\d+)\]/g;

// The slug is the transcript's own project directory, so it is read off the
// path rather than worked out again from a working directory.
function tasksDirOf(transcriptPath, sessionId) {
    return path.join(os.tmpdir(), 'claude', path.basename(path.dirname(String(transcriptPath))), String(sessionId), 'tasks');
}

// The last exit line wins: a command can print the words itself before Claude Code writes the real one.
function parseTail(tail) {
    const marks = [...tail.matchAll(MARK)];
    if (marks.length) return { ended: true, code: Number(marks[marks.length - 1][1]) };
    return /\[killed\]/.test(tail) ? { ended: true, code: null } : { ended: false, code: null };
}

const newest = (a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || ''));

function cutShells(list) {
    const running = list.filter((s) => s.state === 'running').sort(newest);
    const ended = list.filter((s) => s.state === 'ended').sort(newest).slice(0, ENDED_ROWS);
    return running.concat(ended).slice(0, ROWS);
}

// Per transcript, for the life of the process: how far it has been read, the
// background tool_use calls not answered yet, and the shells found with their
// end once known. A live session's transcript only grows, so each call reads
// what was appended; an ended shell does not start again, so its file is not
// read again. A transcript shorter than the offset was rewritten: read whole.
const seen = new Map();

function take(c, text) {
    // Most lines are neither half of a pair; this skips their JSON.parse.
    if (!text.includes('run_in_background') && !text.includes('backgroundTaskId')) return;
    let o;
    try {
        o = JSON.parse(text);
    } catch (e) {
        return;
    }
    const content = o && o.message && Array.isArray(o.message.content) ? o.message.content : [];
    if (o.type === 'assistant') {
        for (const b of content) {
            if (b && b.type === 'tool_use' && b.input && b.input.run_in_background === true && typeof b.input.command === 'string') {
                c.uses.set(b.id, { command: b.input.command, startedAt: typeof o.timestamp === 'string' ? o.timestamp : '' });
            }
        }
        return;
    }
    const id = o.toolUseResult && typeof o.toolUseResult.backgroundTaskId === 'string' ? o.toolUseResult.backgroundTaskId : '';
    if (!id) return;
    for (const b of content) {
        const use = b && b.type === 'tool_result' ? c.uses.get(b.tool_use_id) : null;
        if (!use) continue;
        c.uses.delete(b.tool_use_id);
        c.shells.set(id, { id, command: use.command, startedAt: use.startedAt, end: null });
    }
}

function launchesOf(transcriptPath) {
    let size;
    try {
        size = fs.statSync(transcriptPath).size;
    } catch (e) {
        seen.delete(transcriptPath);
        return [];
    }
    let c = seen.get(transcriptPath);
    if (!c || size < c.offset) {
        c = { offset: 0, uses: new Map(), shells: new Map() };
        seen.set(transcriptPath, c);
    }
    if (size > c.offset) {
        const buf = Buffer.alloc(size - c.offset);
        try {
            const fd = fs.openSync(transcriptPath, 'r');
            try {
                fs.readSync(fd, buf, 0, buf.length, c.offset);
            } finally {
                fs.closeSync(fd);
            }
        } catch (e) {
            // The offset is not advanced, so the next call reads the same bytes again;
            // until it works the shells found so far stand (none, on a first-ever failure).
            return [...c.shells.values()];
        }
        // A line still being written waits for its newline.
        const end = buf.lastIndexOf(0x0a);
        if (end >= 0) {
            for (const text of buf.subarray(0, end).toString('utf8').split('\n')) take(c, text);
            c.offset += end + 1;
        }
    }
    return [...c.shells.values()];
}

// A file that is not there has ended; one that cannot be read for another reason is still running, as far as anyone can tell.
function endOf(file) {
    const tail = readTail(file, TAIL);
    if (tail != null) return parseTail(tail);
    return { ended: !fs.existsSync(file), code: null };
}

function shellsOf(transcriptPath, tasksDir) {
    const list = launchesOf(transcriptPath).map((s) => {
        if (!s.end) {
            const got = endOf(path.join(tasksDir, s.id + '.output'));
            if (got.ended) s.end = got;
        }
        return { id: s.id, command: s.command, state: s.end ? 'ended' : 'running', code: s.end ? s.end.code : null, startedAt: s.startedAt };
    });
    return cutShells(list);
}

module.exports = { shellsOf, tasksDirOf, parseTail, cutShells };
