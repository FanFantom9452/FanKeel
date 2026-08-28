'use strict';

// The writes no hook saw.
//
// `hooks/touch.js` is PostToolUse on Edit|Write|NotebookEdit, and `targetOf`
// reads one of two payload fields, so a write through any other route lands
// nothing on `claims`: a `sed` in a shell, a `node -e`, a build script, an MCP
// write tool. That is not hypothetical — this repository's own build stage once
// edited fifteen files through `node -e` and claimed none of them, and
// `docs/collisions.md` names exactly that hole as the reason the scope guard is
// off by default.
//
// The rejected fix was to match `Bash` on PostToolUse and read the command
// string. A shell parser cannot see what `npm run build` or `python script.py`
// is about to write, which is most of the cases worth catching, and it would
// claim files a command only read. So nothing is parsed. This asks git what is
// dirty, and who wrote the file with which tool stops mattering.
//
// The cost is one `git status` per prompt. Measured 2026-08-28 on Windows,
// end to end through `hooks/inject.js` against a 41-file repository: 185ms
// before, 226ms after, so **+41ms a prompt**. It is close to a constant —
// `git status` alone runs 124ms against a 14-file repository and 131ms against a
// 106-file one, which says what is being paid for is starting git rather than
// walking the tree. Per prompt that is affordable; per Bash call — the other
// rejected shape — a build stage of fifty commands would have paid it fifty
// times.
//
// Two limits, both deliberate. A claim found here lands one prompt after the
// write, which is the lag `hooks/touch.js` has always had. And git is the only
// source: a root that is not a repository gets `null` rather than an empty list,
// so a caller can tell "nothing was written" from "nobody could look".

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const registry = require('./registry.js');
const { covers } = require('./guard.js');

// `git status --porcelain -z`: NUL-separated records, each `XY PATH`. `-z` is
// what makes a path with a space in it survive — the newline format quotes and
// escapes those instead, which would need unescaping to be wrong at.
//
// A rename or a copy is the one record that carries two fields: the path it
// became, then the path it came from. The second is where the file used to be
// rather than where the work went, so it is stepped over, not claimed.
function parsePorcelain(out) {
    const fields = String(out == null ? '' : out).split('\0');
    const paths = [];
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (!field || field.length < 4) continue;
        const status = field.slice(0, 2);
        paths.push(field.slice(3));
        if (status.includes('R') || status.includes('C')) i++;
    }
    return paths;
}

// The same test `lib/tracked.js` uses, and for the same reason: asking a
// directory that is not a repository is a normal step here, and paying a process
// to be told so is the expensive way to find out.
const isRepo = (dir) => {
    try {
        return fs.existsSync(path.join(dir, '.git'));
    } catch (e) {
        return false;
    }
};

// Repository-relative, forward slashes, git's own ignore rules applied — or null
// where git could not answer. `stdio` drops stderr for the reason `lib/tracked.js`
// gives: git's complaint about a directory that is not a repository would
// otherwise be quoted as though it meant something.
//
// `-uall` because the default collapses an untracked directory to `api/` and
// stops there. A claim is one file path, recorded whole — rolling up to the
// directory is the exact thing `docs/collisions.md` says claims do not do, since
// two sessions in two files of one directory would then read as a collision.
function dirtyPaths(dir) {
    if (typeof dir !== 'string' || !dir || !isRepo(dir)) return null;
    let out;
    try {
        out = execFileSync('git', ['status', '--porcelain', '-z', '-uall'], {
            cwd: dir,
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (e) {
        return null;
    }
    return parsePorcelain(out);
}

// Dirty is not the same as this task's. A repository is often dirty before
// anyone starts, and claiming that would put a neighbour's warning on files
// nobody in this session has been near.
//
// `started` is the cutoff because it is the one timestamp on the record that
// does not move: `updated` is rewritten every prompt, and measuring against it
// would drop every write made before the last one. A file deleted between git
// looking and this stat is dropped, which is right — there is nothing left to
// collide over.
function writtenSince(dir, sinceMs) {
    const paths = dirtyPaths(dir);
    if (!paths) return null;
    if (!Number.isFinite(sinceMs)) return paths;
    const out = [];
    for (const rel of paths) {
        try {
            if (fs.statSync(path.join(dir, rel)).mtimeMs > sinceMs) out.push(rel);
        } catch (e) { /* gone since git looked, or never readable */ }
    }
    return out;
}

// Which repository to ask, as a path under the registry root. One registry can
// cover five projects, and `project` is the field that says which of them this
// task is in — the same field the docs lookup routes by.
//
// null rather than '' for a value that escapes the root: a `project` of `..` is
// a record asking for a repository this registry has no business reading, and
// the empty string already means "the root itself".
function subdirOf(data) {
    const raw = registry.projectOf(data);
    if (!raw || path.isAbsolute(raw)) return raw ? null : '';
    const parts = raw.split(/[\\/]+/).filter((s) => s && s !== '.');
    if (parts.some((s) => s === '..')) return null;
    return parts.join('/');
}

// Claims every path this task wrote that no hook was there to see.
//
// `{ added, declined }`, and `declined` is the point of the pair: a pass this
// refuses is a hole in the claim list, and a hole nobody is told about is the
// confident wrong answer this plugin exists to prevent. `added` is 0 on every
// path that could not look — a root that is not a repository, a record with no
// readable `started`, a `project` pointing outside the registry — and `declined`
// is 0 there too, because nothing was found to refuse.
//
// Claims are relative to the registry and git answers relative to the
// repository, so the project's own directory goes back on the front. The
// coverage test is `hooks/touch.js`'s, for its reason: a path already held costs
// no lock and no write, and after the first prompt of a task that is nearly
// every path in the list.
function claimWrites(root, sessionId, data) {
    const nothing = { added: 0, declined: 0 };

    const since = Date.parse((data && data.started) || '');
    if (!Number.isFinite(since)) return nothing;

    const sub = subdirOf(data);
    if (sub === null) return nothing;

    const written = writtenSince(sub ? path.join(root, sub) : root, since);
    if (!written || !written.length) return nothing;

    // More than the record can hold, so none of it goes on. `-uall` lists every
    // untracked file rather than the directory holding them, which is right for
    // a claim and wrong for a repository that does not ignore its own build
    // output: measured 2026-08-28, an unignored `dist/` of 300 files reports as
    // 1 entry without the flag and 300 with it, every one of them freshly
    // written.
    //
    // `claims` keeps the newest sixty, so taking those would evict every path
    // `hooks/touch.js` recorded from an edit somebody actually drove and replace
    // it with build output. The threshold is `MAX_CLAIMS` rather than a number
    // of its own because that is exactly the size of what would be destroyed.
    //
    // What it costs: a repository whose build output is not ignored gets no
    // claims from this path at all, and keeps getting none while those files sit
    // there. That is the failure worth having — it is the behaviour from before
    // any of this existed, where taking the sixty is a loss of something real.
    // It is reported rather than swallowed: `hooks/inject.js` puts the count in
    // the block, because a `touched:` list that looks complete while this half
    // of it was thrown away is worse than one that says what it is missing.
    if (written.length > registry.MAX_CLAIMS) return { added: 0, declined: written.length };

    const held = registry.claimsOf(data);
    let added = 0;
    for (const rel of written) {
        const claim = sub ? sub + '/' + rel : rel;
        if (covers(held, claim)) continue;
        if (registry.addClaim(root, sessionId, claim)) added++;
    }
    return { added, declined: 0 };
}

module.exports = { parsePorcelain, dirtyPaths, writtenSince, subdirOf, claimWrites };
