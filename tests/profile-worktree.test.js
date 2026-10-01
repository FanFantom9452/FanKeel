'use strict';

// docs/90-agent/plans/2026-10-02-worktree-habit-design.md §2 and §4.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('worktree takes bounded and architectural besides true and false, and stays false by default', () => {
    for (const v of ['bounded', 'architectural']) assert.equal(profile.parseValue('worktree', v).value, v);
    assert.equal(profile.parseValue('worktree', 'true').value, true);
    assert.ok(profile.parseValue('worktree', 'sometimes').error);
    assert.equal(profile.read(tmp('fankeel-profile-wt-'), null).values.worktree, false);
});

test('wantsWorktree: true always, false never, bounded from bounded up, architectural alone', () => {
    const cases = [
        [true, 'spike', true], [true, undefined, true],
        [false, 'architectural', false],
        ['bounded', 'spike', false], ['bounded', 'bounded', true], ['bounded', 'architectural', true],
        ['architectural', 'bounded', false], ['architectural', 'architectural', true],
        ['bounded', null, false],
    ];
    for (const [value, cls, want] of cases) assert.equal(profile.wantsWorktree(value, cls), want, value + ' / ' + cls);
});

test('shellWord leaves a plain value bare and single-quotes one a shell would read', () => {
    assert.equal(profile.shellWord('merge'), 'merge');
    assert.equal(profile.shellWord(false), 'false');
    assert.equal(profile.shellWord('^(feat|fix): '), "'^(feat|fix): '");
    assert.equal(profile.shellWord("it's"), "'it'\\''s'");
});

function history(subjects) {
    const d = tmp('fankeel-profile-format-log-');
    const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
    g('init', '-q');
    for (const s of subjects) g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', s);
    return d;
}

// The plan gate of 2026-10-02 ruled `merge` is not added on its own: the
// pattern holds the types the log used, and nothing else.
test('suggest infers commit.format from a conventional log, from the types it used alone', () => {
    const subjects = ['feat: a', 'fix(x): b', 'docs: c', 'chore: d', 'feat(y): e'];
    const out = profile.suggest(history(subjects));
    assert.equal(out.values['commit.format'], '^(chore|docs|feat|fix)(\\([^)]+\\))?: ');
    const format = new RegExp(out.values['commit.format']);
    for (const s of subjects) assert.ok(format.test(s), s);
    assert.equal(format.test('merge: ship it'), false, 'merge is not added unless the log used it');
    assert.ok(out.evidence.includes('commit subjects: 5 of 5 read type(scope): '), out.evidence.join(' | '));
});

test('suggest infers no commit.format when fewer than four in five subjects are conventional', () => {
    const out = profile.suggest(history(['feat: a', 'wip', 'update readme', 'fix: b', 'more']));
    assert.equal(out.values['commit.format'], undefined);
    assert.ok(out.evidence.includes('commit subjects: 2 of 5 read type(scope): '), out.evidence.join(' | '));
});
