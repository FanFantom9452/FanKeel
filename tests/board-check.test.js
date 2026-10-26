'use strict';
// checkBoard (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §1) and
// its CLI: stable codes, a fix hint per code, warnings that do not fail.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { checkBoard } = require('../lib/board.js');

const FIXTURE = path.join(__dirname, 'fixtures', 'levelmark.board');
const CLI = path.join(__dirname, '..', 'scripts', 'board.js');
const BROKEN = '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v"}\n{"edge":"e","in":"v","from":"a","to":"ghost"}\n';

test('levelmark: ok, with postgres owner as an unknown-key warning on its line', async () => {
    const r = await checkBoard(fs.readFileSync(FIXTURE, 'utf8'));
    assert.equal(r.ok, true);
    const w = r.problems.find((p) => p.code === 'unknown-key');
    assert.ok(w, JSON.stringify(r.problems));
    assert.equal(w.id, 'postgres');
    assert.equal(w.line, 8);
    assert.equal(w.level, 'warn');
    assert.match(w.fix, /\S/);
});

test('a dangling edge is bad-ref, an error, and ok is false', async () => {
    const r = await checkBoard(BROKEN);
    assert.equal(r.ok, false);
    const e = r.problems.find((p) => p.code === 'bad-ref');
    assert.equal(e.id, 'e');
    assert.equal(e.line, 4);
    assert.equal(e.level, 'error');
});

test('a line that is not JSON is code parse with its line', async () => {
    const r = await checkBoard('{"chartroom":1}\nnot json\n');
    assert.equal(r.ok, false);
    assert.deepEqual(r.problems.map((p) => [p.code, p.line]), [['parse', 2]]);
});

test('the CLI: --json prints the result, exit 1 on an error, 0 on warnings only', () => {
    const dir = tmp('fankeel-board-check-');
    const bad = path.join(dir, 'bad.board');
    fs.writeFileSync(bad, BROKEN);
    const a = spawnSync(process.execPath, [CLI, 'check', bad, '--json'], { encoding: 'utf8' });
    assert.equal(a.status, 1);
    assert.equal(JSON.parse(a.stdout).problems[0].code, 'bad-ref');
    const b = spawnSync(process.execPath, [CLI, 'check', FIXTURE], { encoding: 'utf8' });
    assert.equal(b.status, 0);
    assert.match(b.stdout, /warn unknown-key postgres \(line 8\)/);
});
