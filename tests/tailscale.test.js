'use strict';
// lib/tailscale.js (docs/90-agent/plans/2026-10-21-station-remote-design.md §2):
// VoiceLedger's ensure_tailscale_serve — `tailscale serve --bg <port>` only when
// no proxy to that port is there yet, never `funnel`, and every failure a warning.
// `run` is faked throughout: no test runs the real tailscale.
const test = require('node:test');
const assert = require('node:assert/strict');
const tailscale = require('../lib/tailscale.js');

const NAME = 'ymlab-pc.tail1234.ts.net';
// `tailscale serve status --json` while `tailscale serve --bg 28888` is on
// (replaced by the real output in step 1 when it differs).
const STATUS = {
    TCP: { 443: { HTTPS: true } },
    Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:28888' } } } },
};
const RUNNING = { BackendState: 'Running', Self: { DNSName: NAME + '.', HostName: 'ymlab-pc' } };

// A fake tailscale CLI: answers `status --json` with `self`, `serve status
// --json` with `serve` (and, after `serve --bg <port>`, with that proxy), and
// records every call.
function fake(self, serve, opts) {
    const o = opts || {};
    const calls = [];
    let config = serve;
    const run = (args) => {
        calls.push(args.join(' '));
        if (args[0] === 'status') return self === null ? { status: null, stdout: '', stderr: 'spawnSync tailscale ENOENT' } : { status: 0, stdout: JSON.stringify(self), stderr: '' };
        if (args[0] === 'serve' && args[1] === 'status') return { status: 0, stdout: config === null ? '' : JSON.stringify(config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') {
            if (o.refuse) return { status: 1, stdout: '', stderr: 'Serve is not enabled on your tailnet.\nTo enable, visit: https://login.tailscale.com/f/serve' };
            config = { TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + args[2] } } } } };
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + args.join(' ') };
    };
    return { run, calls };
}

test('selfName: the MagicDNS name without its dot, only while the tailnet is Running', () => {
    assert.deepEqual(tailscale.selfName(fake(RUNNING, {}).run), { ok: true, dnsName: NAME });
    const stopped = tailscale.selfName(fake({ BackendState: 'Stopped', Self: { DNSName: NAME + '.' } }, {}).run);
    assert.equal(stopped.ok, false);
    assert.match(stopped.warning, /Stopped/);
    const absent = tailscale.selfName(fake(null, {}).run);
    assert.equal(absent.ok, false);
    assert.match(absent.warning, /not installed or not answering/);
    const nameless = tailscale.selfName(fake({ BackendState: 'Running', Self: { DNSName: '' } }, {}).run);
    assert.match(nameless.warning, /MagicDNS/);
    assert.match(nameless.warning, /login\.tailscale\.com\/admin\/dns/);
    assert.match(nameless.warning, /docs\/01-guide\/tailscale-setup\.md/);
    const garbled = tailscale.selfName(() => ({ status: 0, stdout: 'not json', stderr: '' }));
    assert.match(garbled.warning, /did not parse/);
});

test('proxiesOf reads every handler\'s proxy, and nothing from nothing', () => {
    assert.deepEqual(tailscale.proxiesOf(STATUS), [{ hostPort: NAME + ':443', mount: '/', proxy: 'http://127.0.0.1:28888' }]);
    assert.deepEqual(tailscale.proxiesOf({}), []);
    assert.deepEqual(tailscale.proxiesOf(null), []);
    assert.deepEqual(tailscale.proxiesOf({ Web: { x: { Handlers: { '/a': { Path: '/srv' } } } } }), [], 'a file handler is not a proxy');
});

test('ensureServe runs serve --bg once when no proxy is there, and not again once it is', () => {
    const t = fake(RUNNING, {});
    assert.deepEqual(tailscale.ensureServe(28888, t.run), { ok: true, already: false });
    assert.deepEqual(tailscale.ensureServe(28888, t.run), { ok: true, already: true });
    assert.deepEqual(t.calls.filter((c) => c.startsWith('serve --bg')), ['serve --bg 28888']);
    const empty = fake(RUNNING, null);
    assert.equal(tailscale.ensureServe(28888, empty.run).ok, true, 'an empty status is no proxy yet');
});

test('a proxy already on / at :443 to something else is left alone, with a warning', () => {
    const t = fake(RUNNING, { Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:3000' } } } } });
    const got = tailscale.ensureServe(28888, t.run);
    assert.equal(got.ok, false);
    assert.match(got.warning, /already proxies .*127\.0\.0\.1:3000; not replaced/);
    assert.equal(t.calls.some((c) => c.startsWith('serve --bg')), false);
});

test('Funnel on for the machine leaves remote off and says so; funnel is never run', () => {
    const t = fake(RUNNING, Object.assign({}, STATUS, { AllowFunnel: { [NAME + ':443']: true } }));
    const got = tailscale.enable(28888, t.run);
    assert.equal(got.ok, false);
    assert.match(got.warning, /Funnel/);
    assert.equal(t.calls.some((c) => /funnel/.test(c)), false);
});

test('enable: the https url when it worked, the warning when it did not', () => {
    const t = fake(RUNNING, {});
    assert.deepEqual(tailscale.enable(28888, t.run), { ok: true, dnsName: NAME, url: 'https://' + NAME + '/', already: false });
    assert.equal(t.calls.some((c) => /funnel/.test(c)), false);
    const refused = tailscale.enable(28888, fake(RUNNING, {}, { refuse: true }).run);
    assert.equal(refused.ok, false);
    assert.match(refused.warning, /serve --bg 28888 failed: Serve is not enabled on your tailnet\./);
    const off = tailscale.enable(28888, fake({ BackendState: 'NeedsLogin', Self: {} }, {}).run);
    assert.match(off.warning, /NeedsLogin/);
});
