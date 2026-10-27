'use strict';
// The composer's photos (.fankeel/build/2026-10-27-mobile-app/round-3.md §3): up to four a message,
// each shrunk on the phone to a 1568 px long edge as JPEG 0.85, a strip with remove keys, a count,
// a ring per upload, a hint for a fifth, the limits behind a tap, and the paths sent after the text.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const P = require('../assets/station/mobile.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'mobile.js'), 'utf8');
const NOW = new Date(2026, 9, 27, 22, 0).getTime();
const one = { id: 'aaaaaaaa-5', root: '/w', task: 't', project: 'proj', stage: 'build', route: [], state: 'holding', attached: true, waiting: null, chat: [], gate: null, background: [], at: NOW };
const HOME = { host: 'h', at: NOW, gates: [], tasks: [Object.assign({}, one, { updated: NOW, last: null })], done: [] };
const reply = (status, body) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) });
const settle = () => new Promise((r) => setTimeout(r, 30));
const ui = (photos, extra) => Object.assign({ mode: 'app', open: {}, photos, mic: true }, extra);
const R = P.parseRoute('#/s/aaaaaaaa-5');

test('fitEdge keeps the ratio and never enlarges', () => {
    assert.deepEqual(P.fitEdge(4032, 3024, 1568), { w: 1568, h: 1176 });
    assert.deepEqual(P.fitEdge(1179, 2556, 1568), { w: 723, h: 1568 });
    assert.deepEqual(P.fitEdge(800, 600, 1568), { w: 800, h: 600 });
});

test('shrink draws the photo on a canvas at the long edge as JPEG 0.85; without the API, or a photo it cannot decode, it sends the file as picked', async () => {
    const drawn = [];
    const canvas = { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage: (b, x, y, w, h) => drawn.push([w, h]) }),
        toBlob: (cb, type, q) => { drawn.push([type, q]); cb({ type, size: 400e3 }); } };
    const win = { createImageBitmap: () => Promise.resolve({ width: 4032, height: 3024, close() {} }), document: { createElement: (n) => (n === 'canvas' ? canvas : null) } };
    const file = { type: 'image/heic', name: 'a.heic' };
    const blob = await P.shrink(win, file);
    assert.equal(blob.type, 'image/jpeg');
    assert.deepEqual([canvas.width, canvas.height], [1568, 1176]);
    assert.deepEqual(drawn, [[1568, 1176], ['image/jpeg', 0.85]]);
    assert.equal(await P.shrink({ document: {} }, file), file);
    assert.equal(await P.shrink({ createImageBitmap: () => Promise.reject(new Error('heic')), document: { createElement: () => canvas } }, file), file);
});

test('the strip: a thumbnail per photo with its remove key, a ring while it uploads, the count, the add tile, and send held until every upload lands', () => {
    const html = P.screen(HOME, R, NOW, ui([{ key: 'ph1', url: 'blob:1', pct: 100, path: '/u/1.jpeg' }, { key: 'ph2', url: 'blob:2', pct: 60, path: null }], { draft: '看這兩張' }), one);
    assert.equal((html.match(/<li class="ph">/g) || []).length, 2);
    assert.match(html, /<button type="button" class="ph-x" data-act="ph-x" data-key="ph2" aria-label="拿掉第 2 張">/);
    assert.equal((html.match(/<span class="ring"/g) || []).length, 1);
    assert.match(html, /style="stroke-dasharray:60 100"/);
    assert.match(html, /<span class="ph-n">.*?2\/4<\/span>/);
    assert.match(html, /data-act="ph-add" aria-label="加照片，還能加 2 張"/);
    assert.match(html, /<input type="file" id="cmp-file" accept="image\/\*" multiple hidden>/);
    assert.match(html, /<button type="submit" class="send"[^>]* disabled>/);
    assert.match(html, /第 2 張還在上傳，傳完才能送出/);
    assert.match(html, /<details class="ph-lim"><summary data-act="lim">.*?最多 4 張 · 自動縮到 1568px/);
});

test('four photos: no add tile, 4/4, the fifth-photo hint, the limits open from ui.lim, and photos alone can be sent', () => {
    const four = [1, 2, 3, 4].map((n) => ({ key: 'ph' + n, url: 'blob:' + n, pct: 100, path: '/u/' + n + '.jpeg' }));
    const html = P.screen(HOME, R, NOW, ui(four, { over: true, lim: true }), one);
    assert.doesNotMatch(html, /data-act="ph-add"/);
    assert.match(html, /4\/4/);
    assert.match(html, /<p class="ph-hint" role="status">.*?最多 4 張：多選的沒有加進來<\/p>/);
    assert.match(html, /<details class="ph-lim" open>/);
    assert.match(html, /300–600 KB/);
    assert.match(html, /<button type="submit" class="send" aria-label="送出">/);
    assert.doesNotMatch(P.screen(HOME, R, NOW, ui([]), one), /class="ph-strip"|class="ph-meta"/);
});

function boot(o) {
    const app = { innerHTML: '' };
    const box = { innerHTML: '' };
    const sendBtn = { disabled: true };
    const hint = { innerHTML: '' };
    const on = { doc: {}, win: {} };
    const calls = [];
    const listen = (where) => (type, fn) => { (on[where][type] = on[where][type] || []).push(fn); };
    const doc = {
        getElementById: (id) => (id === 'app' ? app : id === 'ph-box' ? box : null), documentElement: {}, body: { insertAdjacentHTML() {} },
        addEventListener: listen('doc'), visibilityState: 'visible',
        querySelector: (s) => (s === '#composer .send' ? sendBtn : s === '#composer .cmp-hint' ? hint : null),
    };
    let n = 0;
    const win = Object.assign({
        document: doc, location: { hash: '#/s/aaaaaaaa-5' }, navigator: { language: 'zh-TW', userAgent: 'x' },
        localStorage: { getItem: () => null, setItem() {} }, addEventListener: listen('win'), setInterval() {}, setTimeout, URLSearchParams,
        URL: { createObjectURL: () => 'blob:' + (++n), revokeObjectURL() {} },
        fetch: (url, init) => {
            calls.push({ url, init: init || {} });
            if (url === '/station/mobile.json') return reply(200, HOME);
            if (url.startsWith('/station/phone.json')) return reply(200, one);
            if (url.startsWith('/phone/upload?')) return o.upload ? o.upload(url, init) : reply(201, '/u/' + calls.filter((c) => c.url.startsWith('/phone/upload?')).length + '.png\n');
            return reply(201, '');
        },
    }, o.win);
    vm.runInNewContext(SRC, { window: win });
    const fire = (type, e) => { (on.doc[type] || []).forEach((fn) => fn(e)); return e; };
    return { app, box, sendBtn, hint, calls, win, fire };
}
const files = (k) => Array.from({ length: k }, (_, i) => ({ type: 'image/png', name: i + '.png' }));
const picked = (list) => ({ target: { id: 'cmp-file', files: list, value: 'C:\\fake', getAttribute: () => null } });
const tap = (attrs) => {
    const el = { getAttribute: (a) => (Object.prototype.hasOwnProperty.call(attrs, a) ? attrs[a] : null) };
    el.closest = (s) => (s === '.cv,.ov' ? null : el);
    return { target: el, preventDefault() {} };
};
const composerForm = (text) => ({ id: 'composer', getAttribute: () => null, querySelector: (s) => (s === 'textarea' ? { value: text } : null) });
const submit = (target) => ({ target, preventDefault() {} });
const said = (page) => new URLSearchParams(page.calls.find((c) => c.url === '/phone/say').init.body).get('text');

test('boot: five picked at once: four go up one request each, the fifth is named, and the message carries four paths after the text', async () => {
    const page = boot({});
    await settle();
    const input = picked(files(5));
    page.fire('change', input);
    await settle();
    const up = page.calls.filter((c) => c.url.startsWith('/phone/upload?'));
    assert.equal(up.length, 4);
    assert.ok(up.every((c) => /root=%2Fw&id=aaaaaaaa-5&ext=png/.test(c.url)), 'no canvas here: each goes up as picked');
    assert.equal(input.target.value, '', 'the same photo can be picked again');
    assert.equal((page.box.innerHTML.match(/<li class="ph">/g) || []).length, 4);
    assert.match(page.box.innerHTML, /class="ph-hint"/);
    assert.equal(page.sendBtn.disabled, false);
    page.fire('submit', submit(composerForm('看這四張')));
    await settle();
    assert.equal(said(page), '看這四張\n[圖片] /u/1.png\n[圖片] /u/2.png\n[圖片] /u/3.png\n[圖片] /u/4.png');
});

test('boot: a photo removed before sending is not sent, and removing one clears the fifth-photo hint', async () => {
    const page = boot({});
    await settle();
    page.fire('change', picked(files(5)));
    await settle();
    page.fire('click', tap({ 'data-act': 'ph-x', 'data-key': 'ph2' }));
    assert.equal((page.box.innerHTML.match(/<li class="ph">/g) || []).length, 3);
    assert.doesNotMatch(page.box.innerHTML, /class="ph-hint"/);
    page.fire('submit', submit(composerForm('')));
    await settle();
    assert.equal(said(page), '[圖片] /u/1.png\n[圖片] /u/3.png\n[圖片] /u/4.png');
});

test('boot: with XMLHttpRequest the ring follows the upload, and send waits for it', async () => {
    const sent = [];
    class XHR {
        constructor() { this.upload = {}; this.headers = {}; sent.push(this); }
        open(method, url) { this.method = method; this.url = url; }
        setRequestHeader(k, v) { this.headers[k] = v; }
        send(body) { this.body = body; }
    }
    const page = boot({ win: { XMLHttpRequest: XHR } });
    await settle();
    page.fire('change', picked(files(1)));
    await settle();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].method, 'POST');
    assert.match(sent[0].url, /^\/phone\/upload\?root=%2Fw&id=aaaaaaaa-5&ext=png$/);
    assert.equal(sent[0].headers['content-type'], 'image/png');
    sent[0].upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
    assert.match(page.box.innerHTML, /stroke-dasharray:50 100/);
    assert.equal(page.sendBtn.disabled, true);
    assert.match(page.hint.innerHTML, /第 1 張還在上傳/);
    sent[0].status = 201;
    sent[0].responseText = '/u/x.jpeg\n';
    sent[0].onload();
    await settle();
    assert.doesNotMatch(page.box.innerHTML, /class="ring"/);
    assert.equal(page.sendBtn.disabled, false);
});

test('boot: a refused upload drops that photo and says why', async () => {
    const page = boot({ upload: () => reply(413, 'image over 10 MB') });
    await settle();
    page.fire('change', picked(files(1)));
    await settle();
    assert.doesNotMatch(page.app.innerHTML, /<li class="ph">/);
    assert.ok(page.app.innerHTML.includes('測站沒收下（413）：image over 10 MB'));
});

test('boot: the limits caption opens and stays open when the strip is drawn again', async () => {
    const page = boot({});
    await settle();
    page.fire('change', picked(files(1)));
    await settle();
    page.fire('click', tap({ 'data-act': 'lim' }));
    assert.match(page.box.innerHTML, /<details class="ph-lim" open>/);
});

test('mobile.css: the strip, the ring, the hint, the caption, and a row of mic, field and send', () => {
    const css = fs.readFileSync(path.join(ASSETS, 'mobile.css'), 'utf8');
    for (const r of ['.ph-strip{', '.ph{', '.ph-x{', '.ring{', '.ph-add{', '.ph-hint{', '.ph-meta{', '.ph-lim summary{', '.cmp-field{']) assert.ok(css.includes('\n' + r), r);
    assert.ok(css.includes('\n.cmp-row.v2{grid-template-columns:44px minmax(0,1fr) 44px}'));
    assert.ok(css.includes('\n.cmp-row.v2.no-mic{grid-template-columns:minmax(0,1fr) 44px}'));
    const all = fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8') + css;
    const html = P.screen(HOME, R, NOW, ui([{ key: 'ph1', url: 'blob:1', pct: 40, path: null }, { key: 'ph2', url: '', pct: 100, path: '/u/2' }], { over: true, lim: true }), one);
    for (const m of html.slice(html.indexOf('<form class="cmp"')).matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) assert.ok(new RegExp('\\.' + c + '(?![\\w-])').test(all), c);
});
