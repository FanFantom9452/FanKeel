'use strict';

// git blame for one file, shared by `scripts/orient.js`'s `## Needs a
// decision` ordering and `scripts/todo-check.js`'s re-read list — both read
// "how long since a person last touched this entry" off the same history.

const { execFileSync } = require('node:child_process');

function git(dir, args) {
    try {
        return execFileSync('git', args, {
            cwd: dir,
            encoding: 'utf8',
            maxBuffer: 8 * 1024 * 1024,
            // Asking a directory that is not a repository is a normal step
            // here, not an error, and git's answer on stderr would be
            // quoted back as if it were a finding.
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (e) {
        return null;
    }
}

// git blame's committer-time for every line of a file, in document order,
// so index i holds line i+1. null when blame fails — the directory is not
// a repository, or the file has never been committed — which is the
// caller's signal to fall back to file order rather than reading zero
// lines as a history of zero.
function blameTimes(dir, name) {
    const out = git(dir, ['blame', '--line-porcelain', '--', name]);
    if (out === null) return null;
    const times = [];
    let sha = null;
    for (const line of out.split('\n')) {
        const header = /^([0-9a-f]{40})\s+\d+\s+\d+/.exec(line);
        if (header) {
            sha = header[1];
            continue;
        }
        const ct = /^committer-time (\d+)/.exec(line);
        if (ct) {
            // All-zero is git's marker for a line the working tree has
            // changed since the last commit. It has no history to date
            // yet, so it counts as the newest thing in the file rather
            // than as whatever placeholder time blame prints for it.
            times.push(/^0+$/.test(sha || '') ? Infinity : Number(ct[1]) * 1000);
        }
    }
    return times.length ? times : null;
}

// `list` (entries carrying `line` and `end` — see `entries()` in
// `todo-check.js`), newest edit first. Ties — including every line
// sharing one commit, or no git history at all — keep the entry later in
// the file first: with no blame to sort by the whole list is one tie, and
// "the last N entries, latest first" falls out of this same rule rather
// than needing one of its own.
function orderByEdit(dir, name, list) {
    const blame = blameTimes(dir, name);
    if (!blame) return [...list].reverse();
    const scored = list.map((entry) => {
        let latest = -Infinity;
        for (let ln = entry.line; ln <= entry.end; ln++) {
            const t = blame[ln - 1];
            if (t !== undefined && t > latest) latest = t;
        }
        return { entry, latest };
    });
    scored.sort((a, b) => (b.latest - a.latest) || (b.entry.line - a.entry.line));
    return scored.map((s) => s.entry);
}

module.exports = { blameTimes, orderByEdit };
