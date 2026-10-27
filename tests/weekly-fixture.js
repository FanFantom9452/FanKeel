'use strict';
// A git repository for the weekly tests. Each commit writes its files (and
// runs its `git mv`s first) and is dated, author and committer, at noon UTC of
// its day, so a range read in any timezone from -11 to +11 keeps it on that day.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function git(dir, args, date) {
    const env = date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env;
    execFileSync('git', args, { cwd: dir, env, stdio: ['ignore', 'ignore', 'ignore'] });
}

function makeRepo(dir, list) {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 'test@example.invalid']);
    git(dir, ['config', 'user.name', 'test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    for (const c of list || []) {
        for (const [from, to] of c.mv || []) {
            fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true });
            git(dir, ['mv', from, to]);
        }
        for (const [rel, text] of Object.entries(c.files || {})) {
            const p = path.join(dir, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, text);
        }
        git(dir, ['add', '-A']);
        git(dir, ['commit', '-q', '--allow-empty', '-m', c.subj], c.date + 'T12:00:00+0000');
    }
    return dir;
}

const lines = (n, tag) => Array.from({ length: n }, (_, i) => (tag || 'line') + ' ' + i).join('\n') + '\n';

module.exports = { makeRepo, lines };
