'use strict';
// The 手機遠端 card (assets/station/remote-card.js;
// docs/90-agent/plans/2026-10-21-station-remote-design.md §3; mockup blocks
// remote-on, remote-off): what it draws for each answer GET /station/remote
// gives, that it asks once and holds the answer across the page's redraws,
// what each control posts, and that every string has English and every class
// a rule in station.css.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../assets/station/remote-card.js');
const { stringsLeft } = require('./station-module.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'remote-card.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const NAME = 'ymlab-pc.tail1234.ts.net';
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const QUIET = { server: 'https://ntfy.sh', gate: false, stage: false, end: false };
const ACTIVE = { on: true, active: true, url: 'https://' + NAME + '/', dnsName: NAME, warning: null, code: 'ABCD2345', until: NOW + 600e3,
    pairUrl: 'https://' + NAME + '/m#/pair/ABCD2345',
    devices: [{ id: '0011223344556677', name: 'Galaxy S24', paired: NOW - 86400e3, seen: NOW - 120e3 },
        { id: '8899aabbccddeeff', name: '<b>tab</b>', paired: NOW - 7200e3, seen: NOW - 3 * 3600e3 }],
    notify: { server: 'https://ntfy.sh', topic: 'fankeel-00112233445566778899', gate: true, stage: false, end: true } };
const OFF = { on: false, active: false, url: null, dnsName: null, warning: null, devices: [], notify: QUIET };
const STUCK = { on: true, active: false, url: null, dnsName: null, warning: 'tailscale is Stopped, not Running', devices: [], notify: QUIET };

// The card as the page loads it: a window with the nonce (and FK_I18N when a
// language is given), a document holding only #rm-card and the listeners, and
// a fetch that logs each call and answers from `answers`
// ('<METHOD> <url>' → {status, json, text}); a GET answers `state` by default.
function boot(opts) {
    const o = opts || {};
    const listeners = {};
    const card = { outerHTML: '' };
    const calls = [];
    const copied = [];
    const answers = o.answers || {};
    const fetch = (url, init) => {
        const method = (init && init.method) || 'GET';
        calls.push({ method, url, body: init && init.body ? new URLSearchParams(String(init.body)) : null });
        const a = answers[method + ' ' + url] || (method === 'GET' ? { status: 200, json: o.state || ACTIVE } : { status: 200, text: '' });
        return Promise.resolve({ ok: a.status < 400, status: a.status, json: () => Promise.resolve(a.json), text: () => Promise.resolve(a.text || '') });
    };
    const win = { STATION: { serve: true, nonce: 'N0NCE' }, navigator: { clipboard: { writeText: (t) => { copied.push(t); return Promise.resolve(); } } } };
    if (o.lang) win.FK_I18N = { lang: o.lang };
    const doc = { getElementById: (id) => (id === 'rm-card' ? card : null), addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); } };
    const box = { window: win, document: doc, fetch, URLSearchParams, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    const fire = (type, ctl) => (listeners[type] || []).forEach((fn) => fn({ target: { closest: (sel) => (sel === '#rm-card [data-rm]' ? ctl : null) } }));
    return { R: box.module.exports, card, calls, copied, fire };
}
const settle = () => new Promise((r) => setTimeout(r, 0));
const ctl = (attrs, checked) => ({ checked: Boolean(checked), textContent: '', getAttribute: (k) => (k in attrs ? attrs[k] : null) });

test('off: the switch unchecked and only this computer, nothing else', () => {
    const h = R.view(OFF, NOW);
    assert.match(h, /^<section class="dcard rm rm-off" id="rm-card" data-block="remote-off">/);
    assert.match(h, /<i class="dot down"><\/i>只在這台電腦看得到（127\.0\.0\.1）/);
    assert.match(h, /data-rm="switch" aria-label="手機遠端">/);
    for (const no of ['rm-url', 'rm-pair', 'data-rm="trigger"', 'data-rm="revoke"']) assert.ok(!h.includes(no), no);
});

test('on while Tailscale is not serving the station: the warning and the triggers, no url or QR', () => {
    const h = R.view(STUCK, NOW);
    assert.match(h, /^<section class="dcard rm" id="rm-card" data-block="remote-on">/);
    assert.match(h, /data-rm="switch" checked aria-label=/);
    assert.ok(h.includes('<i class="dot stale"></i>Tailscale 沒有替測站開門：tailscale is Stopped, not Running'));
    assert.equal((h.match(/data-rm="trigger"/g) || []).length, 3);
    assert.ok(h.includes('打開任一個就會產生 topic'));
    for (const no of ['rm-url', 'rm-pair', 'data-rm="revoke"']) assert.ok(!h.includes(no), no);
});

test('active: the url with 複製, the QR of the live code typed out, each phone with 解除, the triggers as set', () => {
    const h = R.view(ACTIVE, NOW);
    assert.ok(h.includes('<i class="dot live"></i>Tailscale 已連上 <span class="mono">ymlab-pc</span>'));
    assert.ok(h.includes('<code>https://' + NAME + '/</code><button type="button" class="btn" data-rm="copy" data-url="https://' + NAME + '/">'));
    assert.ok(h.includes('<img src="/station/remote/qr.svg?c=ABCD2345" alt="">'));
    assert.ok(h.includes('<code class="rm-code">ABCD2345</code>'));
    assert.match(h, /data-rm="code">[\s\S]*?換一個<\/button>/);
    assert.deepEqual([...h.matchAll(/data-rm="revoke" data-id="([^"]+)"/g)].map((m) => m[1]), ['0011223344556677', '8899aabbccddeeff']);
    assert.ok(h.includes('Galaxy S24 · 2 分鐘前'));
    assert.ok(h.includes('&lt;b&gt;tab&lt;/b&gt; · 3 小時前'));
    assert.ok(!h.includes('<b>tab</b>'), 'a device name reached the page unescaped');
    assert.match(h, /data-key="notify\.gate" checked>gate 待答/);
    assert.match(h, /data-key="notify\.stage">stage 完成/);
    assert.match(h, /data-key="notify\.end" checked>任務結束/);
    assert.ok(h.includes('訂閱 <code>https://ntfy.sh/fankeel-00112233445566778899</code>'));
});

test('no phone paired, an answer that failed, and a refused action each say so', () => {
    assert.ok(R.view(Object.assign({}, ACTIVE, { devices: [] }), NOW).includes('<span class="rm-none">還沒有配對的手機</span>'));
    const e = R.view({ error: '403' }, NOW);
    assert.match(e, /data-block="remote-off"/);
    assert.ok(e.includes('讀不到手機遠端的狀態：403'));
    assert.ok(R.view(Object.assign({}, OFF, { said: '409 — <x>' }), NOW).includes('<p class="rm-say">409 — &lt;x&gt;</p>'));
});

test('html: nothing on a file; served, one GET held across redraws and painted into #rm-card', async () => {
    assert.equal(R.html(false), '');
    const b = boot();
    const first = b.R.html(true);
    assert.match(first, /^<section class="dcard rm rm-off" id="rm-card" data-block="remote-off">/);
    assert.ok(first.includes('讀取手機遠端的狀態…'));
    assert.match(first, /data-rm="switch" disabled/);
    b.R.html(true);
    assert.deepEqual(b.calls.map((c) => c.method + ' ' + c.url), ['GET /station/remote'], 'asked once while the first answer is on its way');
    await settle();
    assert.match(b.card.outerHTML, /data-block="remote-on"/);
    assert.ok(b.card.outerHTML.includes('ABCD2345'));
    assert.match(b.R.html(true), /data-block="remote-on"/);
    assert.equal(b.calls.length, 1, 'a redraw draws the held answer and does not ask again');
});

test('each control posts with the nonce, then reads the state again', async () => {
    const b = boot();
    b.R.html(true);
    await settle();
    b.fire('change', null);
    b.fire('click', null);
    b.fire('change', ctl({ 'data-rm': 'switch' }, false));
    await settle();
    b.fire('change', ctl({ 'data-rm': 'trigger', 'data-key': 'notify.stage' }, true));
    await settle();
    b.fire('click', ctl({ 'data-rm': 'code' }));
    await settle();
    b.fire('click', ctl({ 'data-rm': 'revoke', 'data-id': '8899aabbccddeeff' }));
    await settle();
    b.fire('click', ctl({ 'data-rm': 'switch' }, true));
    await settle();
    const posts = b.calls.filter((c) => c.method === 'POST').map((c) => [c.url, Object.fromEntries(c.body)]);
    assert.deepEqual(posts, [
        ['/profile', { nonce: 'N0NCE', scope: 'machine', key: 'station.remote', value: 'false' }],
        ['/profile', { nonce: 'N0NCE', scope: 'machine', key: 'notify.stage', value: 'true' }],
        ['/station/remote/code', { nonce: 'N0NCE' }],
        ['/station/remote/revoke', { nonce: 'N0NCE', id: '8899aabbccddeeff' }],
    ], 'a click on the switch is its change event\'s business, not the click\'s');
    assert.deepEqual(b.calls.map((c) => c.method), ['GET', 'POST', 'GET', 'POST', 'GET', 'POST', 'GET', 'POST', 'GET']);
});

test('a refused post shows the server\'s reason on the card', async () => {
    const b = boot({ answers: { 'POST /station/remote/code': { status: 409, text: 'remote is off\n' } } });
    b.R.html(true);
    await settle();
    b.fire('click', ctl({ 'data-rm': 'code' }));
    await settle();
    assert.ok(b.card.outerHTML.includes('<p class="rm-say">409 — remote is off</p>'));
});

test('複製 puts the url on the clipboard and says so, posting nothing', async () => {
    const b = boot();
    const c = ctl({ 'data-rm': 'copy', 'data-url': 'https://' + NAME + '/' });
    b.fire('click', c);
    await settle();
    assert.deepEqual(b.copied, ['https://' + NAME + '/']);
    assert.equal(c.textContent, '已複製');
    assert.equal(b.calls.length, 0);
});

test('in English the card carries no CJK, and every string has English', () => {
    const b = boot({ lang: 'en' });
    for (const s of [ACTIVE, OFF, STUCK, { error: '403' }, Object.assign({}, ACTIVE, { devices: [] })]) {
        const h = b.R.view(s, NOW);
        assert.ok(!CJK.test(h), h);
    }
    assert.ok(!CJK.test(b.R.html(true)));
    assert.deepEqual(stringsLeft('remote-card.js', R.EN), []);
});

test('every class the card draws has a rule in station.css', () => {
    const names = new Set();
    for (const s of [ACTIVE, OFF, STUCK, Object.assign({}, ACTIVE, { devices: [], said: 'x' })]) {
        for (const m of R.view(s, NOW).matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (/^(?:rm|m-switch|qr)/.test(c)) names.add(c);
    }
    for (const c of ['rm', 'rm-off', 'rm-st', 'rm-url', 'rm-pair', 'qr', 'rm-code', 'rm-sub', 'rm-devs', 'rm-dev', 'rm-none', 'rm-trg', 'rm-topic', 'rm-say', 'm-switch']) {
        assert.ok(names.has(c), c + ' is not drawn');
    }
    for (const c of names) assert.match(CSS, new RegExp('\\.' + c + '(?![\\w-])'), c + ' has no rule');
    assert.ok(CSS.includes('.qr img{display:block;width:100%;height:100%}'));
    assert.ok(CSS.includes('@media (prefers-reduced-motion:reduce){.m-switch .tr,.m-switch .tr::after{transition:none}}'));
    assert.ok(!CSS.includes('.qr .fp') && !CSS.includes('.qr .mid'), 'the mockup\'s faux QR stays out');
});
