'use strict';
// station-signal-test-1: `serve` closes the station — and so takes down the
// tailscale proxy it made — on SIGINT and SIGTERM. A child killed with
// child.kill('SIGINT') on Windows is terminated, not signalled, so the handler
// is driven through an EventEmitter standing in for `process`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { closeOnSignals } = require('../scripts/station.js');

for (const sig of ['SIGINT', 'SIGTERM']) {
    test(sig + ' closes the station first, then exits 0, once', () => {
        const proc = new EventEmitter();
        const order = [];
        closeOnSignals({ close: () => order.push('close') }, proc, (code) => order.push('exit ' + code));
        assert.equal(proc.listenerCount(sig), 1);
        proc.emit(sig);
        assert.deepEqual(order, ['close', 'exit 0']);
        assert.equal(proc.listenerCount(sig), 0, 'once: a second signal is not swallowed');
    });
}

test('main()\'s serve verb installs the handlers', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'station.js'), 'utf8');
    const serveBranch = src.slice(src.indexOf("if (args.verb === 'serve') {"));
    assert.ok(serveBranch.includes('closeOnSignals(s)'), 'the serve branch must call closeOnSignals(s)');
});
