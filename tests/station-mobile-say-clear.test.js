'use strict';
// station-68: a message leaves the field the moment it is queued. A redraw while it is still in flight
// (a poll, a hash change) must not put it back; a refusal or a lost station does, with anything typed
// since after it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.js'), 'utf8');
const NOW = new Date(2026, 9, 30, 9, 0).getTime();
const ROW = { id: 'aaaaaaaa-5', root: '/w', task: 't', project: 'proj', stage: 'build', route: [], gate: false, updated: NOW, state: 'holding', attached: true, background: [], last: null };
const HOME = { host: 'my-pc', at: NOW, gates: [], tasks: [ROW], done: [] };
const sess = (extra) => Object.assign({ id: 'aaaaaaaa-5', root: '/w', task: 't', project: 'proj', stage: 'build', route: [], state: 'holding', attached: true, waiting: null, chat: [], gate: null, background: [], at: NOW }, extra);
const reply = (status, body) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) });
const settle = () => new Promise((r) => setTimeout(r, 30));
const PHONE = '/station/phone.json?id=';

function boot(fetchFn) {
    const app = { innerHTML: '' };
    const on = { doc: {}, win: {} };
    const listen = (where) => (type, fn) => { (on[where][type] = on[where][type] || []).push(fn); };
    const doc = { getElementById: (id) => (id === 'app' ? app : null), documentElement: {}, body: { insertAdjacentHTML() {} }, addEventListener: listen('doc'), querySelector: () => null, visibilityState: 'visible' };
    const win = {
        document: doc, location: { hash: '#/s/aaaaaaaa-5' }, navigator: { language: 'zh-TW', userAgent: 'x' },
        localStorage: { getItem: () => null, setItem() {} }, addEventListener: listen('win'), setInterval() {}, setTimeout, URLSearchParams,
        fetch: fetchFn,
    };
    vm.runInNewContext(SRC, { window: win });
    return { app, fire: (type, e) => (on.doc[type] || []).forEach((fn) => fn(e)), fireWin: (type) => (on.win[type] || []).forEach((fn) => fn({})) };
}
const form = (box) => ({ id: 'composer', getAttribute: () => null, querySelector: (s) => (s === 'textarea' ? box : null) });
const submit = (box) => ({ target: form(box), preventDefault() {} });
const typing = (value) => ({ target: { id: 'cmp-box', value, style: {}, scrollHeight: 40, getAttribute: () => null } });
const textarea = (page) => (/<textarea[^>]*id="cmp-box"[^>]*>([^<]*)<\/textarea>/.exec(page.app.innerHTML) || [])[1];

function held(say) {
    return (url) => (url === '/phone/say' ? say() : url === '/station/mobile.json' ? reply(200, HOME) : url.startsWith(PHONE) ? reply(200, sess()) : reply(201, ''));
}

test('a message still in flight is gone from the field, and a redraw does not put it back', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const page = boot(held(() => gate.then(() => reply(201, ''))));
    await settle();
    const box = { value: '跑測試' };
    page.fire('submit', submit(box));
    assert.equal(box.value, '', 'the field itself is emptied at once');
    page.fireWin('hashchange');
    assert.equal(textarea(page), '', 'a redraw while the request is out');
    release();
    await settle();
    assert.equal(textarea(page), '');
});

test('a queued message leaves the disabled field empty', async () => {
    let said = false;
    const page = boot((url) => {
        if (url === '/phone/say') { said = true; return reply(201, ''); }
        if (url === '/station/mobile.json') return reply(200, HOME);
        if (url.startsWith(PHONE)) return reply(200, sess(said ? { waiting: { text: '跑測試', at: NOW } } : {}));
        return reply(201, '');
    });
    await settle();
    page.fire('submit', submit({ value: '跑測試' }));
    await settle();
    page.fireWin('hashchange');
    assert.match(page.app.innerHTML, /<textarea[^>]*id="cmp-box"[^>]*disabled[^>]*><\/textarea>/);
});

test('a refusal puts the text back, after anything typed while it was out', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const page = boot(held(() => gate.then(() => reply(409, 'not attached'))));
    await settle();
    page.fire('submit', submit({ value: '跑測試' }));
    page.fire('input', typing('再補一句'));
    release();
    await settle();
    assert.equal(textarea(page), '跑測試\n再補一句');
    assert.ok(page.app.innerHTML.includes('測站沒收下（409）：not attached'));
});

test('a lost station puts the text back too, and a success keeps what was typed meanwhile', async () => {
    const lost = boot(held(() => Promise.reject(new Error('offline'))));
    await settle();
    lost.fire('submit', submit({ value: '跑測試' }));
    await settle();
    assert.equal(textarea(lost), '跑測試');
    let release;
    const gate = new Promise((r) => { release = r; });
    const ok = boot(held(() => gate.then(() => reply(201, ''))));
    await settle();
    ok.fire('submit', submit({ value: '第一句' }));
    ok.fire('input', typing('第二句'));
    release();
    await settle();
    assert.equal(textarea(ok), '第二句');
});
