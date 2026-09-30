'use strict';

// The words a project has said must not ride into its repository, and where a
// commit is about to carry one — docs/90-agent/plans/2026-09-30-init-design.md
// §2c. The list is `.fankeel/sensitive.txt`, one word per line, git-ignored and
// per machine, because the list is itself sensitive. This is the mechanical
// half: a listed word, matched without regard to case. What the list does not
// name is the reviewer's `## Sensitive` lens (agents/fankeel-reviewer.md).

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LIST = ['.fankeel', 'sensitive.txt'];
// `git commit`, `git -C dir commit`, `git -c k=v commit`, in either shell.
const COMMIT = /(^|[^A-Za-z0-9_-])git(\s+-[cC]\s+\S+)*\s+commit(\s|$)/;
// A `git add` in a chained command: [2] is its `-C dir`, if any.
const ADD = /(^|[^A-Za-z0-9_-])git(?:\s+-C\s+(\S+))?(?:\s+-c\s+\S+)*\s+add(?:\s+|$)/;
const BOM = String.fromCharCode(0xfeff);
const SHOWN = 20;

// No list is ENOENT or ENOTDIR and nothing else. Any other failure (a directory
// where the list should be, no permission) is `error`, its code: a list that
// exists and cannot be read is not a list that says nothing.
function readList(root) {
    let text;
    try { text = fs.readFileSync(path.join(root, ...LIST), 'utf8'); } catch (e) {
        if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return { words: [], error: null };
        return { words: [], error: (e && e.code) || 'unreadable' };
    }
    if (text.startsWith(BOM)) text = text.slice(1);
    const out = [];
    for (const line of text.split(/\r?\n/)) {
        const w = line.trim();
        if (w && !w.startsWith('#') && !out.includes(w)) out.push(w);
    }
    return { words: out, error: null };
}

// Every hit in `paths` (relative to `root`), one per listed word per line. A
// file that cannot be read, or holds a NUL byte, is skipped: a binary is not
// text a word can be read out of. UTF-16 text (a BOM) holds NULs too, so it is
// decoded by its BOM first. `listRoot` is where the word list lives when the
// paths sit in another tree, a worktree.
function scan(root, paths, listRoot) {
    const list = readList(listRoot || root);
    // A list that cannot be read is one hit at line 0, so every caller that
    // refuses on a hit (commit.js under block) refuses on this too.
    if (list.error) return [{ path: LIST.join('/'), line: 0, word: 'unreadable: ' + list.error }];
    const needles = list.words.map((word) => ({ word, low: word.toLowerCase() }));
    const hits = [];
    if (!needles.length) return hits;
    for (const rel of paths) {
        let buf;
        try { buf = fs.readFileSync(path.join(root, rel)); } catch (e) { continue; }
        let text;
        if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.subarray(2).toString('utf16le');
        else if (buf[0] === 0xfe && buf[1] === 0xff) text = Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
        else if (buf.includes(0)) continue;
        else text = buf.toString('utf8');
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const low = lines[i].toLowerCase();
            for (const n of needles) if (low.includes(n.low)) hits.push({ path: rel, line: i + 1, word: n.word });
        }
    }
    return hits;
}

const isCommit = (command) => COMMIT.test(String(command || ''));

function listed(hits) {
    const shown = hits.slice(0, SHOWN).map((h) => h.path + ':' + h.line + ' (' + h.word + ')');
    return shown.join(', ') + (hits.length > SHOWN ? ', and ' + (hits.length - SHOWN) + ' more' : '');
}

// What this commit will carry, as far as the command says: the index, the
// working tree's tracked changes under `-a`/`--all`, and the paths after `--`.
function commitPaths(top, cwd, command) {
    const git = (args) => {
        const r = spawnSync('git', args, { cwd: top, encoding: 'utf8' });
        return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : null;
    };
    const gitZ = (args) => {
        const r = spawnSync('git', args, { cwd: top, encoding: 'utf8' });
        return r.status === 0 ? r.stdout.split('\0').filter(Boolean) : null;
    };
    const cached = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
    if (!cached) return null;
    const out = new Set(cached);
    if (/\s(--all|-[A-Za-z]*a[A-Za-z]*)(?=\s|$)/.test(command)) {
        const tracked = git(['diff', '--name-only', '--diff-filter=ACMR']);
        if (!tracked) return null;
        for (const p of tracked) out.add(p);
    }
    // `git add x && git commit`: PreToolUse runs before the add, so the index
    // above does not hold x yet. Every `git add` segment names what it will stage.
    for (const seg of command.split(/&&|\|\||;|\r?\n/)) {
        const m = ADD.exec(seg);
        if (!m) continue;
        const base = m[2] ? path.resolve(cwd, m[2].replace(/^['"]|['"]$/g, '')) : cwd;
        const tokens = seg.slice(m.index + m[0].length).split(/\s+/).map((t) => t.replace(/^['"]|['"]$/g, '')).filter(Boolean);
        let every = false;
        const specs = [];
        for (const t of tokens) {
            if (t === '--') continue;
            if (/^--(all|update)$/.test(t) || /^-[A-Za-z]*[Au][A-Za-z]*$/.test(t)) every = true;
            else if (!t.startsWith('-')) specs.push(path.relative(top, path.resolve(base, t)).split(path.sep).join('/'));
        }
        const asked = every ? [[]] : specs.filter((r) => !r.startsWith('..')).map((r) => ['--', r || '.']);
        for (const tail of asked) {
            const others = gitZ(['ls-files', '-z', '--others', '--exclude-standard'].concat(tail));
            const changed = gitZ(['diff', '-z', '--name-only', '--diff-filter=ACMR'].concat(tail));
            if (!others || !changed) return null;
            for (const p of others.concat(changed)) out.add(p);
        }
    }
    const after = command.split(/\s--\s/)[1];
    for (const token of after ? after.split(/\s+/) : []) {
        const bare = token.replace(/^['"]|['"]$/g, '');
        if (!bare) continue;
        const rel = path.relative(top, path.resolve(cwd, bare)).split(path.sep).join('/');
        if (!rel.startsWith('..') && fs.existsSync(path.join(top, rel))) out.add(rel);
    }
    return [...out];
}

// The PreToolUse answer for a shell command, or null: not a commit, no
// repository, no list, or nothing listed in what it carries.
function commitVerdict({ cwd, command, mode }) {
    if (!isCommit(command)) return null;
    const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
    if (r.status !== 0) return null;
    const top = r.stdout.trim();
    const list = readList(top);
    if (list.error) {
        const why = 'fankeel: .fankeel/sensitive.txt exists but could not be read (' + list.error + '), so this commit was not scanned against it.';
        if (mode === 'block') return { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: why + ' sensitive.mode is block. Fix the file, or run `task.js profile set sensitive.mode warn` to be warned instead.' };
        return { hookEventName: 'PreToolUse', additionalContext: why + ' sensitive.mode is warn, so it goes ahead — tell the user.' };
    }
    if (!list.words.length) return null;
    const paths = commitPaths(top, cwd, command);
    const hits = paths ? scan(top, paths) : [];
    if (paths && !hits.length) return null;
    const what = paths
        ? 'fankeel: this commit carries words from .fankeel/sensitive.txt — ' + listed(hits) + '.'
        : 'fankeel: git would not say what this commit carries, so it was not scanned against .fankeel/sensitive.txt.';
    if (mode === 'block') {
        return {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: what + ' sensitive.mode is block. Take the words out, remove one from .fankeel/sensitive.txt, or run `task.js profile set sensitive.mode warn` to be warned instead.',
        };
    }
    return { hookEventName: 'PreToolUse', additionalContext: what + ' sensitive.mode is warn, so it goes ahead — tell the user which files, and ask whether to amend.' };
}

module.exports = { scan, isCommit, listed, commitVerdict };
