'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFile, execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const GOOD = [
    '要求: 每個任務收尾時留一份看得懂的紀錄。',
    '做了什麼:',
    '  - 收尾時會寫一份六欄紀錄',
    '為什麼這樣做: 紀錄原本只寫在待辦底下，直接開的任務什麼都沒留下。',
    '驗過・沒驗過: 單元測試全過；沒有在真的收尾裡跑過一次。',
    '還剩什麼: 舊任務沒有紀錄。',
].join('\n');

function seed() {
    const root = tmp('fankeel-record-lock-');
    registry.ensureLayout(root);
    registry.writeSession(root, A, { task: '六欄紀錄', stage: 'land', route: ['design', 'land'], active: true, claims: [],
        started: new Date(Date.now() - 90 * 60000).toISOString(), updated: new Date().toISOString() });
    return { root, cfg: path.join(root, 'cfg') };
}

const args = (s) => [SCRIPT, 'write', '--session', A, '--root', s.root, '--config-dir', s.cfg];
const monthFile = (root) => path.join(root, 'docs', '90-agent', 'records', new Date().toISOString().slice(0, 7) + '.md');

// Holds the session's registry lock for as long as record.js runs. withLock
// breaks a lock older than five seconds (lib/registry.js LOCK_STALE_MS), so
// its mtime is kept fresh rather than trusting the child to be quick.
function runLocked(s, input) {
    const lock = path.join(s.root, '.fankeel', 'sessions', A + '.lock');
    fs.mkdirSync(lock);
    const keep = setInterval(() => { const t = new Date(); fs.utimesSync(lock, t, t); }, 200);
    return new Promise((resolve) => {
        const child = execFile(process.execPath, args(s), { encoding: 'utf8', timeout: 60000 }, (err, stdout, stderr) => {
            clearInterval(keep);
            fs.rmdirSync(lock);
            resolve({ out: String(stdout || '') + String(stderr || ''), code: err ? err.code : 0 });
        });
        child.stdin.end(input);
    });
}

test('a registry entry that cannot be updated exits 1, names the registry, and writes no month file', async () => {
    const s = seed();
    const out = await runLocked(s, GOOD);
    assert.equal(out.code, 1, out.out);
    assert.match(out.out, /^Nothing written: the registry entry for /m);
    assert.equal(fs.existsSync(monthFile(s.root)), false);
    assert.equal(registry.readSession(s.root, A).record, undefined);
});

test('a failed registry write leaves an existing month file byte for byte as it was', async () => {
    const s = seed();
    execFileSync(process.execPath, args(s), { encoding: 'utf8', input: GOOD });
    const before = fs.readFileSync(monthFile(s.root), 'utf8');
    const first = registry.readSession(s.root, A).record;
    const out = await runLocked(s, GOOD.replace('舊任務沒有紀錄。', '舊任務沒有紀錄，要另外補。'));
    assert.equal(out.code, 1, out.out);
    assert.equal(fs.readFileSync(monthFile(s.root), 'utf8'), before);
    assert.deepEqual(registry.readSession(s.root, A).record, first);
});
