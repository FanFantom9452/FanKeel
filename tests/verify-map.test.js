'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-map.js');
const { lint, touched } = require(SCRIPT);

const BODY = [
    '## Sub-features', '- one', '',
    '## Reach', '`node tool/run.js`', '',
    '## Drive', '1. run it', '',
    '## Gotchas', '- none known', '',
    '## Doctor', '- `node tool/run.js --version` exits 0', '',
].join('\n');
const NO_DOCTOR = BODY.replace(/## Doctor[\s\S]*$/, '');

const GOOD = { feature: 'tool', kind: 'cli', src: '[tool/**]', last_checked: '2026-10-19', status: 'clean' };
const RENDER = JSON.stringify({
    pages: [{ name: 'home', url: 'http://127.0.0.1:1/', src: ['site/**'] }],
    roles: [{ name: 'guest' }],
});

function front(fields) {
    return '---\n' + Object.entries(fields).map(([k, v]) => k + ': ' + v).join('\n') + '\n---\n\n';
}

// A project in a temporary directory: two source files every test can point
// a glob at, plus whatever the test adds. Not under `bin/`: the walk in
// lib/tracked.js skips that directory name, so a glob there matches nothing.
function project(t, files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-map-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const all = Object.assign({ 'tool/run.js': '// tool\n', 'site/page.js': '// page\n' }, files);
    for (const [rel, text] of Object.entries(all)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
    }
    return dir;
}

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

test('a well-formed cli feature file lints clean', (t) => {
    const dir = project(t, { '.fankeel/verify/tool.md': front(GOOD) + BODY });
    assert.deepEqual(lint(dir), { files: ['.fankeel/verify/tool.md'], warnings: [] });
});

test('a missing section warns, naming the section', (t) => {
    const dir = project(t, { '.fankeel/verify/tool.md': front(GOOD) + NO_DOCTOR });
    assert.deepEqual(lint(dir).warnings, ['.fankeel/verify/tool.md: no `## Doctor` section']);
});

test('feature, kind, status and last_checked are each checked', (t) => {
    const bad = { feature: 'other', kind: 'daemon', src: '[tool/**]', last_checked: '19 Oct', status: 'fine' };
    const dir = project(t, { '.fankeel/verify/tool.md': front(bad) + BODY });
    const w = lint(dir).warnings;
    assert.equal(w.length, 4, w.join('\n'));
    assert.ok(w.some((x) => /`feature` is "other" and the file name says "tool"/.test(x)), w.join('\n'));
    assert.ok(w.some((x) => /`kind` is "daemon", not one of page, cli, hook/.test(x)), w.join('\n'));
    assert.ok(w.some((x) => /`status` is "fine", not one of clean, changed, blocked/.test(x)), w.join('\n'));
    assert.ok(w.some((x) => /`last_checked` is "19 Oct", not a YYYY-MM-DD date/.test(x)), w.join('\n'));
});

test('a src glob that matches no file warns', (t) => {
    const dir = project(t, { '.fankeel/verify/tool.md': front(Object.assign({}, GOOD, { src: '[tool/**, nowhere/**]' })) + BODY });
    assert.deepEqual(lint(dir).warnings, ['.fankeel/verify/tool.md: `src` glob nowhere/** matches no file']);
});

test('a cli Doctor with no exit code to check warns', (t) => {
    const body = BODY.replace('- `node tool/run.js --version` exits 0', '- run `node tool/run.js --version`');
    const dir = project(t, { '.fankeel/verify/tool.md': front(GOOD) + body });
    const w = lint(dir).warnings;
    assert.equal(w.length, 1, w.join('\n'));
    assert.match(w[0], /a cli's `## Doctor` names no exit code to check/);
});

test('a page names render.json pages instead of re-declaring src, and a change reaches it through them', (t) => {
    const page = { feature: 'home', kind: 'page', render: '[home]', last_checked: '2026-10-19', status: 'clean' };
    const dir = project(t, { '.fankeel/render.json': RENDER, '.fankeel/verify/home.md': front(page) + BODY });
    assert.deepEqual(lint(dir).warnings, []);
    assert.deepEqual(touched(dir, ['site/page.js']), ['.fankeel/verify/home.md']);
    assert.deepEqual(touched(dir, ['tool/run.js']), []);
});

test('render naming an undeclared page, or used off a page, warns', (t) => {
    const page = { feature: 'home', kind: 'page', render: '[nope]', last_checked: '2026-10-19', status: 'clean' };
    const cli = Object.assign({}, GOOD, { render: '[home]' });
    const dir = project(t, {
        '.fankeel/render.json': RENDER,
        '.fankeel/verify/home.md': front(page) + BODY,
        '.fankeel/verify/tool.md': front(cli) + BODY,
    });
    assert.deepEqual(lint(dir).warnings, [
        '.fankeel/verify/home.md: `render` names "nope", which .fankeel/render.json does not declare',
        '.fankeel/verify/tool.md: `render` belongs to a `kind: page` file only',
    ]);
});

test('touched matches a feature by its own src, with either slash', (t) => {
    const dir = project(t, { '.fankeel/verify/tool.md': front(GOOD) + BODY });
    assert.deepEqual(touched(dir, ['tool/run.js']), ['.fankeel/verify/tool.md']);
    assert.deepEqual(touched(dir, ['tool\\run.js']), ['.fankeel/verify/tool.md']);
    assert.deepEqual(touched(dir, ['site/page.js']), []);
});

test('the CLI only warns: a warn line, the count, exit 0', (t) => {
    const dir = project(t, { '.fankeel/verify/tool.md': front(GOOD) + NO_DOCTOR });
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^warn: \.fankeel\/verify\/tool\.md: no `## Doctor` section$/m);
    assert.match(r.stdout, /^verify-map: 1 feature file, 1 warning$/m);
});

test('a project with no .fankeel/verify lints to nothing', (t) => {
    const dir = project(t, {});
    assert.deepEqual(lint(dir), { files: [], warnings: [] });
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^verify-map: 0 feature files, 0 warnings$/m);
});

test('--range prints the feature files a commit reaches, or none', (t) => {
    const dir = project(t, { '.fankeel/verify/tool.md': front(GOOD) + BODY });
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'tool', 'run.js'), '// tool, changed\n');
    git(dir, 'commit', '-qam', 'tool');
    fs.writeFileSync(path.join(dir, 'site', 'page.js'), '// page, changed\n');
    git(dir, 'commit', '-qam', 'page');
    const run = (range) => spawnSync(process.execPath, [SCRIPT, '--root', dir, '--range', range], { encoding: 'utf8' });
    const hit = run('HEAD~2..HEAD~1');
    assert.equal(hit.status, 0, hit.stderr);
    assert.equal(hit.stdout.trim(), '.fankeel/verify/tool.md');
    assert.equal(run('HEAD~1..HEAD').stdout.trim(), 'none');
});

test('this repository\'s own map lints clean, and both pages pass docs-check as reference', () => {
    const r = lint(ROOT);
    assert.ok(r.files.includes('.fankeel/verify/station.md'), r.files.join(', '));
    assert.deepEqual(r.warnings, []);
    const { checkFile } = require('../scripts/docs-check.js');
    for (const rel of ['.fankeel/verify/README.md', '.fankeel/verify/station.md']) {
        assert.deepEqual(checkFile(ROOT, rel, 'reference'), [], rel);
    }
});
