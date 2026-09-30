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
const BOM = String.fromCharCode(0xfeff);
const SHOWN = 20;

function words(root) {
    let text;
    try { text = fs.readFileSync(path.join(root, ...LIST), 'utf8'); } catch (e) { return []; }
    if (text.startsWith(BOM)) text = text.slice(1);
    const out = [];
    for (const line of text.split(/\r?\n/)) {
        const w = line.trim();
        if (w && !w.startsWith('#') && !out.includes(w)) out.push(w);
    }
    return out;
}

// Every hit in `paths` (relative to `root`), one per listed word per line. A
// file that cannot be read, or holds a NUL byte, is skipped: a binary is not
// text a word can be read out of.
function scan(root, paths) {
    const needles = words(root).map((word) => ({ word, low: word.toLowerCase() }));
    const hits = [];
    if (!needles.length) return hits;
    for (const rel of paths) {
        let buf;
        try { buf = fs.readFileSync(path.join(root, rel)); } catch (e) { continue; }
        if (buf.includes(0)) continue;
        const lines = buf.toString('utf8').split(/\r?\n/);
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
        return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : [];
    };
    const out = new Set(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']));
    if (/\s(--all|-[A-Za-z]*a[A-Za-z]*)(?=\s|$)/.test(command)) {
        for (const p of git(['diff', '--name-only', '--diff-filter=ACMR'])) out.add(p);
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
    if (!words(top).length) return null;
    const hits = scan(top, commitPaths(top, cwd, command));
    if (!hits.length) return null;
    const what = 'fankeel: this commit carries words from .fankeel/sensitive.txt — ' + listed(hits) + '.';
    if (mode === 'block') {
        return {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: what + ' sensitive.mode is block. Take the words out, remove one from .fankeel/sensitive.txt, or run `task.js profile set sensitive.mode warn` to be warned instead.',
        };
    }
    return { hookEventName: 'PreToolUse', additionalContext: what + ' sensitive.mode is warn, so it goes ahead — tell the user which files, and ask whether to amend.' };
}

module.exports = { words, scan, isCommit, listed, commitPaths, commitVerdict };
