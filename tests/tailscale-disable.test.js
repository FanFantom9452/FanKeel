'use strict';
// Design §7: lib/tailscale.js gains disable(), `tailscale serve --https=443 off`.
// `run` is faked: no test runs the real tailscale.
const test = require('node:test');
const assert = require('node:assert/strict');
const tailscale = require('../lib/tailscale.js');

test('disable runs tailscale serve --https=443 off', () => {
    const calls = [];
    const got = tailscale.disable((args) => { calls.push(args.join(' ')); return { status: 0, stdout: '', stderr: '' }; });
    assert.deepEqual(got, { ok: true });
    assert.deepEqual(calls, ['serve --https=443 off']);
});

test('a failed or missing tailscale is a warning, never a throw', () => {
    assert.deepEqual(tailscale.disable(() => ({ status: 1, stdout: '', stderr: 'handler does not exist\nsecond line' })),
        { ok: false, warning: 'tailscale serve --https=443 off failed: handler does not exist' });
    assert.deepEqual(tailscale.disable(() => ({ status: null, stdout: '', stderr: 'spawnSync tailscale ENOENT' })),
        { ok: false, warning: 'tailscale serve --https=443 off failed: spawnSync tailscale ENOENT' });
});
