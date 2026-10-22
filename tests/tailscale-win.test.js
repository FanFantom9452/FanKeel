'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runTailscale } = require('../lib/tailscale.js');

const enoent = () => { const e = new Error('spawnSync tailscale ENOENT'); e.code = 'ENOENT'; return { error: e }; };

test('on win32 a missing tailscale on PATH falls back to Program Files', () => {
    const bins = [];
    const spawn = (bin) => { bins.push(bin); return bins.length === 1 ? enoent() : { status: 0, stdout: '{}', stderr: '' }; };
    const r = runTailscale(['status', '--json'], { spawn, platform: 'win32', env: { ProgramFiles: 'D:\\Apps' } });
    assert.equal(r.status, 0);
    assert.deepEqual(bins, ['tailscale', path.win32.join('D:\\Apps', 'Tailscale', 'tailscale.exe')]);
});

test('elsewhere, and for any other error, there is no fallback', () => {
    const bins = [];
    const r = runTailscale(['status'], { spawn: (bin) => { bins.push(bin); return enoent(); }, platform: 'linux', env: {} });
    assert.equal(r.status, null);
    assert.match(r.stderr, /ENOENT/);
    assert.deepEqual(bins, ['tailscale']);
    const other = [];
    runTailscale(['status'], { spawn: (bin) => { other.push(bin); const e = new Error('EACCES'); e.code = 'EACCES'; return { error: e }; }, platform: 'win32', env: {} });
    assert.deepEqual(other, ['tailscale']);
});
