'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-map.js');
const tmp = require('./tmp.js');
const { lint, touched } = require('../scripts/verify-map.js');

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
    const dir = tmp('verify-map-');
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

test('a feature file with no frontmatter warns and is not checked further', (t) => {
    const dir = project(t, { '.fankeel/verify/tool.md': BODY });
    assert.deepEqual(lint(dir).warnings, ['.fankeel/verify/tool.md: no frontmatter']);
});

test('a page with neither render nor src warns', (t) => {
    const page = { feature: 'home', kind: 'page', last_checked: '2026-10-19', status: 'clean' };
    const dir = project(t, { '.fankeel/verify/home.md': front(page) + BODY });
    assert.deepEqual(lint(dir).warnings, [
        '.fankeel/verify/home.md: a page needs `render` naming render.json pages, or `src` where render.json does not declare it',
    ]);
});

test('a cli or a hook with no src warns', (t) => {
    const cli = { feature: 'tool', kind: 'cli', last_checked: '2026-10-19', status: 'clean' };
    const hook = Object.assign({}, cli, { feature: 'gate', kind: 'hook' });
    const dir = project(t, { '.fankeel/verify/tool.md': front(cli) + BODY, '.fankeel/verify/gate.md': front(hook) + BODY });
    assert.deepEqual(lint(dir).warnings, [
        '.fankeel/verify/gate.md: a hook needs `src`',
        '.fankeel/verify/tool.md: a cli needs `src`',
    ]);
});

test('render with no render.json in the project warns', (t) => {
    const page = { feature: 'home', kind: 'page', render: '[home]', last_checked: '2026-10-19', status: 'clean' };
    const dir = project(t, { '.fankeel/verify/home.md': front(page) + BODY });
    assert.deepEqual(lint(dir).warnings, [
        '.fankeel/verify/home.md: `render` names "home" and there is no readable .fankeel/render.json',
    ]);
});

test('a render.json page with no src warns on the feature that names it', (t) => {
    const render = JSON.stringify({ pages: [{ name: 'home', url: 'http://127.0.0.1:1/' }], roles: [{ name: 'guest' }] });
    const page = { feature: 'home', kind: 'page', render: '[home]', last_checked: '2026-10-19', status: 'clean' };
    const dir = project(t, { '.fankeel/render.json': render, '.fankeel/verify/home.md': front(page) + BODY });
    assert.deepEqual(lint(dir).warnings, [
        '.fankeel/verify/home.md: render.json page "home" has no `src`, so no change reaches this file through it',
    ]);
});

test('an unreadable render.json warns with its refusal', (t) => {
    const dir = project(t, { '.fankeel/render.json': '{ not json', '.fankeel/verify/tool.md': front(GOOD) + BODY });
    const w = lint(dir).warnings;
    assert.equal(w.length, 1, w.join('\n'));
    assert.match(w[0], /^\.fankeel\/render\.json: \S/);
});

// A git repository holding the project as one commit, then a second commit
// changing site/page.js.
function committed(t, files) {
    const dir = project(t, files);
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'site', 'page.js'), '// page, changed\n');
    git(dir, 'commit', '-qam', 'page');
    return dir;
}

function range(dir, r) {
    return spawnSync(process.execPath, [SCRIPT, '--root', dir, '--range', r], { encoding: 'utf8' });
}

test('--range on a directory git cannot read says so and exits 0', (t) => {
    const dir = project(t, { '.fankeel/verify/tool.md': front(GOOD) + BODY });
    // A ref no repository has, so a temp dir that sits inside one still fails.
    const r = range(dir, 'no-such-ref-verify-map..HEAD');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), 'verify-map: git could not read no-such-ref-verify-map..HEAD');
});

test('--range warns with render.json\'s refusal instead of a silent none', (t) => {
    const page = { feature: 'home', kind: 'page', render: '[home]', last_checked: '2026-10-19', status: 'clean' };
    const dir = committed(t, { '.fankeel/render.json': '{ not json', '.fankeel/verify/home.md': front(page) + BODY });
    const r = range(dir, 'HEAD~1..HEAD');
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 2, r.stdout);
    assert.match(lines[0], /^warn: \.fankeel\/render\.json: \S/);
    assert.equal(lines[1], 'none');
});

test('--range warns on a feature file with no frontmatter instead of skipping it', (t) => {
    const dir = committed(t, { '.fankeel/verify/home.md': BODY });
    const r = range(dir, 'HEAD~1..HEAD');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), 'warn: .fankeel/verify/home.md: no frontmatter, so no change reaches it\nnone');
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
