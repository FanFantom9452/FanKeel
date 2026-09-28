'use strict';
// assets/station/tour-doc.js — the promo's string table and the document
// page every cut is drawn as, read back through tests/tour-ctx.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/station/tour.js');
const D = require('../assets/station/tour-doc.js');
const { fakeCtx } = require('./tour-ctx.js');

const ZH = T.palette(() => '', 'zh');
const EN = T.palette(() => '', 'en');
const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;

// Criterion: every string has both languages, and the English carries no
// Chinese. Red when: a pair is left half-filled, or the en side was copied
// from the zh one.
test('every string in the table has a zh and an en, and the en holds no CJK', () => {
    const keys = Object.keys(D.S);
    assert.ok(keys.length >= 75, 'only ' + keys.length + ' strings');
    for (const k of keys) {
        assert.ok(D.S[k].zh && D.S[k].en, k);
        assert.notEqual(D.S[k].zh, D.S[k].en, k);
        assert.ok(!CJK.test(D.S[k].en), k + ': ' + D.S[k].en);
    }
    assert.equal(D.S.task.en, 'Multi-warehouse transfers');
});

test('t reads the palette\'s language and refuses a key that is not there', () => {
    assert.equal(D.t(ZH, 'task'), '多倉庫庫存與調撥');
    assert.equal(D.t(EN, 'task'), 'Multi-warehouse transfers');
    assert.throws(() => D.t(ZH, 'nope'), /tour: no string nope/);
});

function spec(extra) {
    return Object.assign({
        tab: [['cm', 'docs/'], ['tab', 'x.md']], head: 2,
        blocks: [
            { at: 30, h: 33, draw: (ctx, P, x, y, w) => D.li(ctx, P, x, y, w, [['li', 'first']]) },
            { at: 60, h: 400, draw: (ctx, P, x, y, w) => D.li(ctx, P, x, y, w, [['li', 'tall']]) },
        ],
    }, extra);
}

test('page: the tab and the header rise from 0, each block only from its own beat', () => {
    const at = (l, P) => { const ctx = fakeCtx(); D.page(ctx, P || ZH, l, spec()); return ctx.texts(); };
    assert.deepEqual(at(0), []);
    assert.deepEqual(at(18), ['docs/', 'x.md', 'plan', D.S['pr.plan'].zh]);
    assert.ok(at(29).every((s) => s !== 'first'));
    assert.ok(at(31).includes('first'));
    assert.ok(!at(59).includes('tall') && at(61).includes('tall'));
    assert.ok(at(18, EN).includes(D.S['pr.plan'].en));
});

// Criterion: a block that would fall below the window scrolls the page up.
// Red when: the page never moves, so a late block is drawn off the frame.
test('page scrolls up once a block would pass the window\'s foot, and not before', () => {
    const shift = (l) => {
        const ctx = fakeCtx();
        D.page(ctx, ZH, l, spec());
        return ctx.calls.filter((c) => c[0] === 'translate' && c[1] === 0).map((c) => c[2])[0];
    };
    assert.equal(shift(40), -0);
    assert.ok(shift(62) < 0);
    assert.ok(shift(100) < shift(62));
    const clip = fakeCtx();
    D.page(clip, ZH, 0, spec({ top: 46, bottom: 294 }));
    assert.deepEqual(clip.calls.find((c) => c[0] === 'rect'), ['rect', 0, 46, 640, 248]);
});

test('page draws its caption under the window from frame 0', () => {
    const ctx = fakeCtx();
    D.page(ctx, EN, 10, spec({ cap: 'cap.plan', bottom: 302 }));
    assert.ok(ctx.texts().includes(D.S['cap.plan'].en));
});

test('rise is 0 before its beat and 1 once settled; risen draws nothing at 0', () => {
    assert.equal(D.rise(29, 30), 0);
    assert.equal(D.rise(48, 30), 1);
    let ran = false;
    D.risen(fakeCtx(), 0, () => { ran = true; });
    assert.equal(ran, false);
});

test('the pieces: pill, dots, rail, heading, callout and cap', () => {
    let ctx = fakeCtx();
    const w = D.pill(ctx, ZH, '過時', 100, 50, 'stale');
    assert.equal(w, 2 * 12.5 + 18);
    assert.ok(ctx.calls.some((c) => c[0] === '=fillStyle' && c[1] === T.DARK.staleBg));
    ctx = fakeCtx();
    D.pill(ctx, ZH, '執行中', 300, 50, 'live', { right: true });
    assert.equal(ctx.calls.filter((c) => c[0] === 'arc').length, 1);
    ctx = fakeCtx();
    D.dots(ctx, ZH, 0, 10, 2, 7, 10);
    assert.equal(ctx.calls.filter((c) => c[0] === 'arc').length, 8);
    ctx = fakeCtx();
    D.rail(ctx, ZH, 70, 100, 500, 3, 2);
    assert.deepEqual(ctx.texts(), T.ROUTE);
    ctx = fakeCtx();
    D.heading(ctx, ZH, 'h2', '##', 'Ready', 70, 100, 500);
    assert.deepEqual(ctx.texts(), ['## ', 'Ready']);
    ctx = fakeCtx();
    D.callout(ctx, ZH, 70, 100, 500, 40, T.DARK.good, [['li', 'a']], 0.4);
    assert.deepEqual(ctx.texts(), []);
    ctx = fakeCtx();
    D.cap(ctx, ZH, 'cap.hook', 20, 0);
    assert.deepEqual(ctx.texts(), [D.S['cap.hook'].zh]);
    assert.equal(D.runsWidth(fakeCtx(), ZH, [['li', 'ab'], ['code', 'cd']]), 2 * 14.5 * 0.56 + 2 * 14.5 * 0.6);
    assert.equal(D.CX + D.CW, 570);
});
