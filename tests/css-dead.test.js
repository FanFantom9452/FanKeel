'use strict';
// audit-4: scripts/css-dead.js — CSS classes no script or page names. The
// station's own stylesheets are scanned from a copy, with the wizard rules
// station-54 deleted put back, so the known-dead case is there to find.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { classesIn, scan } = require('../scripts/css-dead.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets', 'station');
const SCRIPT = path.join(ROOT, 'scripts', 'css-dead.js');

test('classesIn reads selectors only: not comments, strings, urls, numbers or at-rule preludes', () => {
    const css = '/* .gone{} */\n.a{color:red;margin:.5em}\n@media (min-width:1px){.b .c:not(.d){x:1}}\n'
        + '.e[data-x=".f"]{background:url(i.png)}\n@keyframes k{from{opacity:0}50%{opacity:.5}}\n';
    assert.deepEqual(classesIn(css).map((c) => [c.name, c.line]), [['a', 2], ['b', 3], ['c', 3], ['d', 3], ['e', 4]]);
});

test('on assets/station with the wizard rules put back, .wz is dead and split-bar is not', () => {
    const dir = tmp('fankeel-css-dead-');
    fs.cpSync(ASSETS, path.join(dir, 'station'), { recursive: true });
    fs.appendFileSync(path.join(dir, 'station', 'station.css'), '\n.wz{display:grid}\n.wz .wz-scene{opacity:0}\n');
    const dead = scan([dir]).dead.map((d) => d.name);
    assert.ok(dead.includes('wz'), 'wz is not reported dead');
    assert.ok(dead.includes('wz-scene'), 'wz-scene is not reported dead');
    for (const n of ['split', 'split-h', 'split-bar']) assert.ok(!dead.includes(n), n + ' is reported dead');
});

test('a class whose prefix is built in a string is maybe, not dead', () => {
    const dir = tmp('fankeel-css-dead-dyn-');
    fs.writeFileSync(path.join(dir, 'a.css'), '.tag-ok{}\n.tag-bad{}\n.pill-x{}\n.never{}\n');
    fs.writeFileSync(path.join(dir, 'a.js'), "el.className = 'tag-' + state;\nvar h = `<i class=\"pill-${k}\">`;\n");
    const r = scan([dir]);
    assert.deepEqual(r.dead.map((d) => d.name), ['never']);
    assert.deepEqual(r.maybe.map((m) => [m.name, m.prefix]), [['tag-ok', 'tag-'], ['tag-bad', 'tag-'], ['pill-x', 'pill-']]);
});

test('a test directory is not read as a reference', () => {
    const dir = tmp('fankeel-css-dead-tests-');
    fs.writeFileSync(path.join(dir, 'a.css'), '.only-in-test{}\n');
    fs.mkdirSync(path.join(dir, 'tests'));
    fs.writeFileSync(path.join(dir, 'tests', 'a.test.js'), "assert.doesNotMatch(css, /only-in-test/);\n");
    assert.deepEqual(scan([dir]).dead.map((d) => d.name), ['only-in-test']);
});

test('the CLI prints a dead row and exits 1, and the audit skill runs it', () => {
    const dir = tmp('fankeel-css-dead-cli-');
    fs.writeFileSync(path.join(dir, 'a.css'), '.never{}\n');
    fs.writeFileSync(path.join(dir, 'a.js'), '\n');
    const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stdout, /^css-dead — 1 dead, 0 maybe, of 1 classes in 1 stylesheets\n/);
    assert.match(r.stdout, /dead {3}\S*a\.css:1 {2}\.never\n/);
    const skill = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-audit', 'SKILL.md'), 'utf8');
    assert.match(skill, /`node <plugin>\/scripts\/css-dead\.js <dir>`/);
});

test('the CLI on a directory that does not exist exits 2 with a stderr line, not a clean zero', () => {
    const dir = path.join(tmp('fankeel-css-dead-missing-'), 'no-such-dir');
    const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /css-dead: cannot read .*no-such-dir/);
    assert.equal(r.stdout, '');
});
