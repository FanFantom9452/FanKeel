'use strict';
// assets/station/tour-opening.js — the first six cuts (hook … build), each
// drawn alone at its own local frames, in both languages: what each still of
// the storyboard shows, that every string keeps to its box, that the mono
// face holds only ASCII, and that no terminal is drawn anywhere.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../assets/station/tour.js');
const D = require('../assets/station/tour-doc.js');
const { CUTS } = require('../assets/station/tour-opening.js');
const { fakeCtx, sweep } = require('./tour-ctx.js');

const LANGS = { zh: T.palette(() => '', 'zh'), en: T.palette(() => '', 'en') };
const cut = (name) => CUTS.find((c) => c.name === name);
function shot(name, l, lang) {
    const ctx = fakeCtx();
    cut(name).draw(ctx, LANGS[lang || 'zh'], l);
    return ctx.texts();
}
const s = (key, lang) => D.S[key][lang || 'zh'];

test('six cuts, 240 or 360 frames, their blocks on the beat', () => {
    assert.deepEqual(CUTS.map((c) => [c.name, c.len]), [['hook', 240], ['route', 240], ['survey', 360], ['design', 360], ['plan', 360], ['build', 360]]);
    for (const c of CUTS) {
        assert.equal(c.beats[0], 0, c.name);
        for (const b of c.beats) assert.ok(b % 30 === 0 && b < c.len, c.name + ' ' + b);
    }
});

// Criterion: each still of cut-hook … cut-build draws what the storyboard's
// still shows. Red when: a cut draws an empty page, or the wrong block list.
test('hook: the doc grows, then three blocks are marked stale', () => {
    for (const lang of ['zh', 'en']) {
        const early = shot('hook', 66, lang);
        assert.ok(early.includes(s('hook.title', lang)) && early.includes(s('cap.hook', lang)), early.join(' | '));
        assert.ok(!early.includes(s('stale', lang)));
        const late = shot('hook', 225, lang);
        assert.equal(late.filter((x) => x === s('stale', lang)).length, 3, late.join(' | '));
        assert.ok(late.includes('getStock(sku)') && late.includes('export-plan-v2.md'));
    }
});

test('route: the task card, and one stage lit a beat', () => {
    const t = shot('route', 225, 'en');
    assert.ok(t.includes('Multi-warehouse transfers') && t.includes(s('cap.route', 'en')));
    assert.deepEqual(T.ROUTE.filter((x) => t.includes(x)), T.ROUTE);
    const arcs = (l) => { const ctx = fakeCtx(); cut('route').draw(ctx, LANGS.zh, l); return ctx.calls.filter((c) => c[0] === 'arc').length; };
    assert.ok(arcs(105) > arcs(15), 'lit stops draw a centre and a ring');
});

test('survey: three files found, then the class callout', () => {
    const mid = shot('survey', 135);
    for (const f of ['src/stock/warehouse.ts', 'src/transfer/', 'docs/inventory.md']) assert.ok(mid.includes(f), f);
    assert.ok(!mid.includes('class: bounded'));
    const end = shot('survey', 330, 'en');
    assert.ok(end.includes('class: bounded') && end.includes(s('pr.survey', 'en')), end.join(' | '));
});

test('design: the approach, the file table, the gate, then 已核准', () => {
    const gate = shot('design', 225);
    assert.ok(gate.includes(s('design.gate')) && gate.includes(s('design.yes')) && gate.includes('src/transfer/transfer.ts'));
    assert.ok(!gate.includes(s('design.ok')));
    const ok = shot('design', 315, 'en');
    assert.ok(ok.includes('Approved') && !ok.includes('Awaiting approval'), ok.join(' | '));
});

// Criterion: plan shows A and B side by side under 同時 and C after A.
// Red when: the frame, the arrow or `Consumes: A` never appear.
test('plan: A and B in one 同時 frame, C under it waiting on A', () => {
    const before = shot('plan', 105);
    assert.ok(before.includes('src/stock/warehouse.ts') && before.includes('src/transfer/api.ts') && before.includes('src/transfer/ui.vue'));
    assert.ok(!before.includes(s('par')) && !before.includes(s('waits')));
    const after = shot('plan', 330, 'en');
    assert.ok(after.includes('In parallel') && after.includes('waits on A') && after.includes('Consumes: '), after.join(' | '));
});

test('build: A and B run together, C only after them', () => {
    const run = shot('build', 105, 'en');
    assert.equal(run.filter((x) => x === 'implementer running').length, 2, run.join(' | '));
    assert.ok(run.includes('queued'));
    const ab = shot('build', 255, 'en');
    assert.ok(ab.includes('Task A: complete') && ab.includes('Task B: complete') && ab.includes('implementer running'));
    const all = shot('build', 345, 'en');
    assert.ok(all.includes('Task C: complete'), all.join(' | '));
});

// Criterion: every string these cuts print is measured and keeps to its
// box, in both languages. Red when: a box is narrower than its English.
test('every string of these cuts fits its box in zh and en, and the mono face holds only ASCII', () => {
    const keys = new Set();
    for (const lang of ['zh', 'en']) {
        const frames = [];
        for (const c of CUTS) for (let l = 0; l < c.len; l += 5) frames.push([c, l]);
        const r = sweep(T, frames, (ctx, [c, l]) => c.draw(ctx, LANGS[lang], l));
        assert.deepEqual(r.log.filter((e) => e.over).map((e) => e.s), [], lang);
        assert.deepEqual(r.monoWide, [], lang);
        assert.deepEqual(r.nonFinite, [], lang);
        const drawn = r.log.map((e) => e.s).join('\n');
        Object.keys(D.S).forEach((k) => { if (drawn.includes(D.S[k][lang].trim())) keys.add(lang + ' ' + k); });
    }
    for (const k of ['task', 'cap.hook', 'cap.route', 'cap.plan', 'cap.build', 'pr.survey', 'pr.design', 'pr.plan', 'pr.build', 'design.ok', 'build.done']) {
        assert.ok(keys.has('zh ' + k) && keys.has('en ' + k), k);
    }
});

test('no terminal: nothing here draws a statusline or a terminal chrome', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'tour-opening.js'), 'utf8');
    assert.doesNotMatch(src, /termCut|landCloseup|vsCode|FANKEEL|TERMINAL/);
});
