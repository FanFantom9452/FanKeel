'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { blameTimes } = require('../lib/blame.js');
const mkTmp = require('./tmp.js');

const JAN = '2026-01-01T00:00:00+0000';
const FEB = '2026-02-01T00:00:00+0000';

function git(dir, args, date) {
    const env = date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env;
    execFileSync('git', args, { cwd: dir, env, stdio: ['ignore', 'ignore', 'ignore'] });
}

// Three entries committed in January, so a second commit in February can
// either move one or edit one and the two dates tell which history a line kept.
function repo(lines) {
    const dir = mkTmp('fankeel-blame-');
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 'test@example.invalid']);
    git(dir, ['config', 'user.name', 'test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    fs.writeFileSync(path.join(dir, 'TODO.md'), lines.join('\n') + '\n');
    git(dir, ['add', 'TODO.md']);
    git(dir, ['commit', '-qm', 'one'], JAN);
    return dir;
}

function recommit(dir, lines) {
    fs.writeFileSync(path.join(dir, 'TODO.md'), lines.join('\n') + '\n');
    git(dir, ['commit', '-qam', 'two'], FEB);
}

const A = '- alpha entry about the ledger range and the plan commit';
const B = '- beta entry about the station profile card placement';
const C = '- gamma entry about docs archive being found by grep';

// Regrouping TODO.md by topic moves bullets without touching a word of them.
// Without move detection the moved one reads as written in February, and
// orient offers it as the newest entry when nobody has edited it.
test('blameTimes keeps a moved line on the commit that wrote it', () => {
    const dir = repo([A, B, C]);
    recommit(dir, [B, C, A]);
    assert.deepEqual(blameTimes(dir, 'TODO.md'), [Date.parse(JAN), Date.parse(JAN), Date.parse(JAN)]);
});

test('blameTimes still dates an edited line to the edit', () => {
    const dir = repo([A, B, C]);
    recommit(dir, [A, B.replace('placement', 'placement, moved to the top'), C]);
    assert.deepEqual(blameTimes(dir, 'TODO.md'), [Date.parse(JAN), Date.parse(FEB), Date.parse(JAN)]);
});
