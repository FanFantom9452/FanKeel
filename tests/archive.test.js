'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { flipStatus, archiveDir, archive, main } = require('../scripts/archive.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'archive.js');
const AUDIT = path.join(__dirname, '..', 'scripts', 'docs-audit.js');
const DOCS_JSON = JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 },
    { path: 'docs/plans', role: 'plan' },
    { path: 'docs/archive', role: 'archive' },
] });
const PAGE = '---\nstatus: design-intent\n---\n\n# X\n';

function repo() {
    const root = tmp('fankeel-archive-');
    const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'ignore' });
    git('init', '-q');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Test');
    for (const [rel, body] of [['.fankeel/docs.json', DOCS_JSON], ['docs/plans/2026-09-24-x.md', PAGE], ['docs/plans/2026-09-24-x-design.md', PAGE], ['docs/archive/.keep', '']]) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    git('add', '-A');
    git('commit', '-qm', 'base');
    return root;
}

test('flipStatus changes only the frontmatter line, and keeps CRLF', () => {
    assert.deepEqual(flipStatus('---\r\nstatus: design-intent\r\n---\r\nstatus: design-intent\r\n'),
        { text: '---\r\nstatus: current\r\n---\r\nstatus: design-intent\r\n', flipped: true });
    assert.deepEqual(flipStatus('---\nstatus: current\n---\n'), { text: '---\nstatus: current\n---\n', flipped: false });
    assert.deepEqual(flipStatus('no frontmatter\n'), { text: 'no frontmatter\n', flipped: false });
});

test('archiveDir is the archive bucket docs.json declares, or null', () => {
    assert.equal(archiveDir(repo()), 'docs/archive');
    assert.equal(archiveDir(tmp('fankeel-archive-empty-')), null);
});

test('a landed plan and its design move to the archive as status: current, staged that way', () => {
    const root = repo();
    const out = execFileSync(process.execPath, [SCRIPT, '--root', root, 'docs/plans/2026-09-24-x.md', 'docs/plans/2026-09-24-x-design.md'], { encoding: 'utf8' });
    for (const name of ['2026-09-24-x.md', '2026-09-24-x-design.md']) {
        assert.equal(fs.existsSync(path.join(root, 'docs', 'plans', name)), false, name + ' still in plans');
        assert.match(fs.readFileSync(path.join(root, 'docs', 'archive', name), 'utf8'), /^---\nstatus: current\n---/);
        const staged = execFileSync('git', ['show', ':docs/archive/' + name], { cwd: root, encoding: 'utf8' });
        assert.match(staged, /^---\nstatus: current\n---/, name + ': the index holds the old blob');
    }
    assert.match(out, /archived docs\/plans\/2026-09-24-x\.md -> docs\/archive\/2026-09-24-x\.md, status: design-intent -> current/);
});

test('docs-audit names nothing about the page once it is archived', () => {
    const root = repo();
    main(['--root', root, 'docs/plans/2026-09-24-x.md']);
    const r = spawnSync(process.execPath, [AUDIT, '--root', root], { encoding: 'utf8' });
    assert.doesNotMatch(r.stdout, /2026-09-24-x\.md/);
});

test('a page already archived, or not there, is refused and nothing moves', () => {
    const root = repo();
    assert.match(archive(root, 'docs/plans/nope.md', 'docs/archive').error, /is not there/);
    const r = main(['--root', root, 'docs/plans/2026-09-24-x.md', 'docs/plans/nope.md']);
    assert.equal(r.code, 1);
    assert.ok(fs.existsSync(path.join(root, 'docs', 'plans', '2026-09-24-x.md')), 'a refused batch moved one page anyway');
    assert.equal(fs.existsSync(path.join(root, 'docs', 'archive', '2026-09-24-x.md')), false, 'the good page moved before the bad one was hit');
});
