'use strict';
// station-67: a phone message's "[圖片] <saved path>" lines are the photos it carried. The conversation
// draws each as a thumbnail served by GET /phone/img and never shows the path; a line that is not the
// shape /phone/upload saves under stays plain, escaped text.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');

const NOW = new Date(2026, 9, 30, 9, 0).getTime();
const HOME = { host: 'h', at: NOW, gates: [], tasks: [], done: [] };
const sess = (extra) => Object.assign({ id: 'aaaaaaaa-5', root: '/w', task: 't', project: 'proj', stage: 'build', route: [], state: 'holding', attached: true, waiting: null, chat: [], gate: null, background: [], at: NOW }, extra);
const R = P.parseRoute('#/s/aaaaaaaa-5');
const draw = (extra) => P.screen(HOME, R, NOW, { mode: 'app', open: {} }, sess(extra));
const WIN = 'F:\\w\\.fankeel\\build\\station\\phone\\aaaaaaaa-5\\uploads\\1730000000000-abc123.png';
const POSIX = '/w/.fankeel/build/station/phone/aaaaaaaa-5/uploads/1730000000001-def456.jpeg';

test('a phone message with [圖片] lines draws its text, then one thumbnail per photo, and no path', () => {
    const html = draw({ chat: [{ role: 'phone', text: '看這兩張\n[圖片] ' + WIN + '\n[圖片] ' + POSIX, at: NOW }] });
    assert.match(html, /<p class="bub">看這兩張<\/p>/);
    assert.equal((html.match(/<img class="shot"/g) || []).length, 2);
    assert.ok(html.includes('src="/phone/img?root=%2Fw&amp;id=aaaaaaaa-5&amp;name=1730000000000-abc123.png"'));
    assert.ok(html.includes('src="/phone/img?root=%2Fw&amp;id=aaaaaaaa-5&amp;name=1730000000001-def456.jpeg"'));
    assert.match(html, /<span class="shots">/);
    assert.match(html, /alt="傳來的圖片"/);
    assert.doesNotMatch(html, /\[圖片\]|uploads|F:\\/);
});

test('photos alone draw no empty text bubble', () => {
    const html = draw({ chat: [{ role: 'phone', text: '[圖片] ' + POSIX, at: NOW }] });
    assert.equal((html.match(/<img class="shot"/g) || []).length, 1);
    assert.doesNotMatch(html, /<p class="bub"><\/p>/);
});

test('a [圖片] line that is not a saved photo stays escaped text, and the queued message gets thumbnails too', () => {
    const html = draw({ chat: [{ role: 'phone', text: '[圖片] /etc/passwd\n[圖片] <img src=x>', at: NOW }], waiting: { text: '等著\n[圖片] ' + POSIX, at: NOW } });
    assert.ok(html.includes('[圖片] /etc/passwd'));
    assert.ok(html.includes('[圖片] &lt;img src=x&gt;'));
    assert.equal((html.match(/<img class="shot"/g) || []).length, 1, 'only the queued message has a real photo');
    assert.equal((html.match(/<img /g) || []).length, 1);
});

test('English labels the thumbnail', () => {
    P.setLang('en');
    try {
        const html = draw({ chat: [{ role: 'phone', text: '[圖片] ' + POSIX, at: NOW }] });
        assert.ok(html.includes('alt="Photo sent"'));
    } finally { P.setLang('zh'); }
});

test('a peer session draws its thumbnails through that computer\'s prefix', () => {
    const html = P.screen(HOME, P.parseRoute('#/m/lab/aaaaaaaa-5'), NOW, { mode: 'app', open: {} }, sess({ machine: 'lab', chat: [{ role: 'phone', text: '[圖片] ' + POSIX, at: NOW }] }));
    assert.ok(html.includes('src="/station/peer/lab/phone/img?root=%2Fw&amp;id=aaaaaaaa-5&amp;name='), html.slice(html.indexOf('<img')));
});

test('forward passes GET /phone/img on to the paired computer', async () => {
    const peers = require('../lib/peers.js');
    const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fk-img-'));
    fs.mkdirSync(path.join(dir, 'fankeel'));
    fs.writeFileSync(path.join(dir, 'fankeel', 'peers.json'), JSON.stringify({ peers: [{ dnsName: 'lab.ts.net', name: 'lab', token: 'T', paired: 1, seen: null, last: null }] }));
    const calls = [];
    const got = await peers.forward(dir, 'lab', 'GET', '/phone/img?root=%2Fw&id=a&name=b.png', {}, null, async (o) => { calls.push(o); return { status: 200, headers: { 'content-type': 'image/png' }, body: Buffer.from('x') }; });
    assert.equal(got.status, 200);
    assert.equal(calls.length, 1);
});
