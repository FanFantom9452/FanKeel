'use strict';
// ponytail-1 candidate 2: scripts/uninstall.js takes away what fankeel wrote
// outside every project, and keeps the machine profile, every project's
// .fankeel/ and any JSON it cannot parse.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { plan, run } = require('../scripts/uninstall.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'uninstall.js');
const SID = 'abababab-1111-4111-8111-111111111111';
// A pid no operating system hands out, the same constant tests/serve.test.js uses.
const GONE_PID = 2147483646;
const PROFILE = JSON.stringify({ 'ui.lang': 'zh' });

function machine() {
    const cfg = tmp('fankeel-uninstall-cfg-');
    const project = tmp('fankeel-uninstall-proj-');
    const own = path.join(cfg, 'fankeel');
    fs.mkdirSync(path.join(own, 'station', 'detail'), { recursive: true });
    fs.writeFileSync(path.join(own, 'index.html'), '<!doctype html>\n');
    fs.writeFileSync(path.join(own, 'station', 'station.css'), 'body{}\n');
    fs.writeFileSync(path.join(own, 'station', 'detail', SID + '.js'), 'window.X = 1;\n');
    fs.writeFileSync(path.join(own, 'serve.json'), JSON.stringify({ pid: GONE_PID, port: 1, url: 'http://127.0.0.1:1/' }));
    fs.writeFileSync(path.join(own, 'roots.json'), JSON.stringify({ [project]: new Date().toISOString() }));
    fs.writeFileSync(path.join(own, 'remote.json'), '{ not json');
    fs.writeFileSync(path.join(own, 'profile.json'), PROFILE);
    fs.mkdirSync(path.join(project, '.fankeel', 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'modes', SID), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'modes', SID, 'fankeel'), 'build\n');
    fs.writeFileSync(path.join(cfg, 'modes', SID, 'other'), 'x\n');
    return { cfg, project, own };
}

test('after a run the generated files are gone, and profile.json, the project .fankeel/ and an unparseable JSON remain', () => {
    const { cfg, project, own } = machine();
    const r = spawnSync(process.execPath, [SCRIPT], { env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    for (const gone of ['index.html', 'station', 'serve.json', 'roots.json']) assert.equal(fs.existsSync(path.join(own, gone)), false, gone);
    assert.equal(fs.existsSync(path.join(cfg, 'modes', SID, 'fankeel')), false, 'the badge');
    assert.equal(fs.existsSync(path.join(cfg, 'modes', SID, 'other')), true, 'a file fankeel did not write');
    assert.equal(fs.readFileSync(path.join(own, 'profile.json'), 'utf8'), PROFILE);
    assert.equal(fs.readFileSync(path.join(own, 'remote.json'), 'utf8'), '{ not json');
    assert.equal(fs.existsSync(path.join(project, '.fankeel', 'sessions')), true);
    assert.match(r.stdout, /kept {5}\S*profile\.json {2}\(machine profile\)/);
    assert.match(r.stdout, /kept {5}\S*\.fankeel {2}\(project registry\)/);
    assert.match(r.stdout, /kept {5}\S*remote\.json {2}\(does not parse as JSON, left as it is\)/);
    assert.match(r.stdout, /then: claude plugin uninstall fankeel@fankeel\n$/);
});

test('plan names what it removes and what it keeps', () => {
    const { cfg } = machine();
    const p = plan(cfg);
    const rel = (x) => path.relative(cfg, x).split(path.sep).join('/');
    assert.deepEqual(p.remove.map(rel).sort(), ['fankeel/index.html', 'fankeel/roots.json', 'fankeel/serve.json', 'fankeel/station', 'modes/' + SID + '/fankeel']);
    assert.deepEqual(p.keep.map((k) => k.why).sort(), ['does not parse as JSON, left as it is', 'machine profile', 'project registry']);
});

test('--dry-run deletes nothing and says what it would', async () => {
    const { cfg, own } = machine();
    const out = await run(cfg, { dryRun: true });
    assert.match(out, /\(dry run: nothing is deleted\)/);
    assert.match(out, /would delete \S*index\.html/);
    assert.equal(fs.existsSync(path.join(own, 'index.html')), true);
    assert.equal(fs.existsSync(path.join(own, 'station', 'station.css')), true);
});

test('README says to run it before claude plugin uninstall', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const at = readme.indexOf('node <plugin>/scripts/uninstall.js');
    assert.ok(at !== -1, 'README.md does not name scripts/uninstall.js');
    assert.ok(at < readme.indexOf('claude plugin uninstall fankeel@fankeel'), 'the script comes after the uninstall');
});
