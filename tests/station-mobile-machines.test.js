'use strict';
// The 測站 sheet's computers (machines-sheet, Task 5 of docs/90-agent/plans/2026-10-29-mobile-sources.md):
// one row a computer — connected, offline with when it was last reached, or unpaired with a code box —
// the state in words, not only colour; re-pairing this phone is inside this computer's own row.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');

const NOW = Date.UTC(2026, 9, 29, 13, 12);
const R = P.parseRoute('#/');
const machines = [
    { name: 'office', url: null, state: 'on', me: true, seen: NOW, paired: null, refused: false, n: 4 },
    { name: 'lab', url: 'https://lab.t.ts.net/m', state: 'on', me: false, seen: NOW, paired: Date.UTC(2026, 9, 24), refused: false, n: 3 },
    { name: 'laptop', url: 'https://laptop.t.ts.net/m', state: 'off', me: false, seen: Date.UTC(2026, 9, 28, 15, 14), paired: NOW - 864e5, refused: false, n: 2 },
    { name: 'ws1', url: 'https://ws1.t.ts.net/m', state: 'unpaired', me: false, seen: null, paired: null, refused: false, n: 0 },
];
const sheet = (m, open) => P.screen(Object.assign({ host: 'office', at: NOW, device: null, gates: [], tasks: [], done: [] }, m), R, NOW, { mode: 'app', open: open || {}, sheet: true });
const block = (h) => /data-block="machines-sheet"[\s\S]*?<\/section>/.exec(h)[0];

test('machines-sheet: one row a computer, its state in words, and only https urls as links', () => {
    const h = block(sheet({ machines }));
    assert.match(h, /電腦<span>4<\/span><span class="ok">2 台連上<\/span>/);
    assert.match(h, /<b>手機經由這台<\/b> · 4 個 session/);
    assert.match(h, /href="https:\/\/lab\.t\.ts\.net\/m"[\s\S]*?已連上/);
    assert.match(h, /href="https:\/\/laptop\.t\.ts\.net\/m"[\s\S]*?最後連上 10\/28[\s\S]*?離線/);
    assert.match(h, /ws1[\s\S]*?有測站，這台還沒跟它配對[\s\S]*?去配對/);
    assert.doesNotMatch(h, /javascript:/);
    assert.doesNotMatch(sheet({ machines }), /data-key="rs:pair"/, 're-pairing moved into this computer\'s row');
});

test('machines-sheet: an unpaired row opens a code box for that computer; this computer\'s row opens re-pairing', () => {
    const h = block(sheet({ machines }, { 'mm:ws1': true, 'mm:me': true }));
    assert.match(h, /<form class="mm-pair" data-peer-form="ws1\.t\.ts\.net">/);
    assert.match(h, /ws1 的配對碼/);
    assert.match(h, /data-act="repair"/);
});

test('machines-sheet: with no machines yet, the probed others are listed unpaired; with none, the empty line', () => {
    assert.match(block(sheet({ others: [{ name: 'lab-desktop', url: 'https://lab-desktop.t.ts.net/m' }] })), /lab-desktop[\s\S]*?去配對/);
    assert.match(block(sheet({ others: [] })), /這個 tailnet 上沒有其他開著手機遠端的測站/);
});

test('machines-sheet: names are escaped and English is English', () => {
    assert.match(block(sheet({ machines: [machines[0], Object.assign({}, machines[1], { name: '<i>c</i>' })] })), /&lt;i&gt;c&lt;\/i&gt;/);
    P.setLang('en');
    try {
        const h = block(sheet({ machines }));
        assert.match(h, /Computers/);
        assert.match(h, /Last reached/);
    } finally { P.setLang('zh'); }
});
