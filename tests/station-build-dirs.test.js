'use strict';
// lib/station.js buildDirs, through gather: a build directory holding a
// junction is counted without walking into it, and a spent budget stops the
// count while the directory is still listed. On 2026-10-04 a junction under
// .fankeel/build pointing at ~/.claude/projects cost station.write three
// seconds inside a five-second hook.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

function fixture() {
    const base = tmp('fankeel-builddirs-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(root);
    const task = path.join(root, '.fankeel', 'build', 'task-a');
    fs.mkdirSync(path.join(task, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(task, 'ledger.md'), '# ledger\n');
    fs.writeFileSync(path.join(task, 'sub', 'shot.png'), 'x');
    // The junction points at a directory inside this same scratch tree, so
    // nothing outside it is at stake if anything follows the link.
    const far = path.join(base, 'far');
    fs.mkdirSync(far);
    for (let i = 0; i < 5; i++) fs.writeFileSync(path.join(far, i + '.jsonl'), '{}\n');
    fs.symlinkSync(far, path.join(task, 'sub', 'projects'), 'junction');
    return { base, cfg, root };
}

const buildOf = (f, extra) => {
    const m = station.gather(Object.assign({ configDir: f.cfg, roots: [f.root], cwd: f.base }, extra));
    return m.registries.find((r) => r.root === path.resolve(f.root)).build;
};

test('a junction under a build directory is not walked into', () => {
    const f = fixture();
    assert.deepEqual(buildOf(f), [{ name: 'task-a', files: 2 }]);
});

test('a spent budget stops the count, and the directory is still listed', () => {
    const f = fixture();
    assert.deepEqual(buildOf(f, { detailBudgetMs: -1 }), [{ name: 'task-a', files: 0 }]);
});
