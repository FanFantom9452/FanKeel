'use strict';
// assets/station/tour-closing.js — the last five cuts (verify … outro), each
// drawn alone at its own local frames, in both languages: what each still of
// the storyboard shows, that every string keeps to its box, that the mono
// face holds only ASCII, and that no terminal is drawn anywhere.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../assets/station/tour.js');
const D = require('../assets/station/tour-doc.js');
const { CUTS } = require('../assets/station/tour-closing.js');
const { fakeCtx, sweep } = require('./tour-ctx.js');

const LANGS = { zh: T.palette(() => '', 'zh'), en: T.palette(() => '', 'en') };
const cut = (name) => CUTS.find((c) => c.name === name);
function shot(name, l, lang) {
    const ctx = fakeCtx();
    cut(name).draw(ctx, LANGS[lang || 'zh'], l);
    return ctx.texts();
}
const s = (key, lang) => D.S[key][lang || 'zh'];

test('five cuts, 240 or 360 frames, their blocks on the beat', () => {
    assert.deepEqual(CUTS.map((c) => [c.name, c.len]), [['verify', 360], ['audit', 360], ['land', 360], ['clash', 240], ['outro', 360]]);
    for (const c of CUTS) {
        assert.equal(c.beats[0], 0, c.name);
        for (const b of c.beats) assert.ok(b % 30 === 0 && b < c.len, c.name + ' ' + b);
    }
});

// Criterion: each still of cut-verify … cut-outro draws what the
// storyboard's still shows. Red when: a cut draws an empty page, or skips
// its change of state.
test('verify: three rows of evidence; row two fails at 180 and is fixed at 270', () => {
    const one = shot('verify', 75);
    assert.ok(one.includes('transfer.test.ts') && one.includes('✓'));
    const red = shot('verify', 195, 'en');
    assert.ok(red.includes('✕') && red.some((x) => x.includes('old case fails')), red.join(' | '));
    const fixed = shot('verify', 330, 'en');
    assert.ok(!fixed.includes('✕') && fixed.some((x) => x.includes('passes with the default added')), fixed.join(' | '));
});

test('audit: the docs tree, two pages marked stale, one moved into archive/', () => {
    const mid = shot('audit', 195);
    assert.equal(mid.filter((x) => x === s('audit.stale')).length, 2, mid.join(' | '));
    const end = shot('audit', 330, 'en');
    assert.equal(end.filter((x) => x === 'Stale').length, 1, end.join(' | '));
    assert.ok(end.includes('archived') && end.includes('still says getStock(sku), added to TODO'));
});

test('land: TODO.md, the task\'s own entry struck, then a clean working tree', () => {
    const mid = shot('land', 225);
    assert.ok(mid.includes('Ready') && mid.includes('Blocked') && mid.includes(s('land.slip')));
    assert.ok(!mid.includes(s('land.clean') + ' '));
    const end = shot('land', 330, 'en');
    assert.ok(end.includes('Working tree clean ') && end.includes('  nothing to commit, working tree clean'), end.join(' | '));
});

test('clash: two session cards on one file, CLASH on the bar line, then the caption', () => {
    const before = shot('clash', 105);
    assert.ok(before.includes('session 1') && before.includes('session 2') && !before.some((x) => x.startsWith('CLASH')));
    const hit = shot('clash', 135, 'en');
    assert.ok(hit.includes('CLASH · same file'), hit.join(' | '));
    assert.equal(hit.filter((x) => x === 'src/stock/warehouse.ts').length, 2);
    assert.ok(shot('clash', 225, 'en').includes(s('cap.clash', 'en')));
});

test('outro: the install lines typed, the tagline, then the whole route', () => {
    const typed = shot('outro', 45);
    assert.ok(typed.some((x) => x.startsWith('claude plugin') && x.length < 51), typed.join(' | '));
    const end = shot('outro', 300, 'en');
    assert.ok(end.includes('claude plugin marketplace add FanFantom9452/FanKeel') && end.includes('claude plugin install fankeel@fankeel'));
    assert.ok(end.join(' ').includes('Build with AI as long as you like'), end.join(' | '));
    assert.deepEqual(T.ROUTE.filter((x) => end.includes(x)), T.ROUTE);
    assert.ok(shot('outro', 300).includes('跟 AI 開發得再久，也不堆過時的引用和死程式。'));
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
    for (const k of ['pr.verify', 'pr.audit', 'pr.land', 'verify.fail', 'audit.archived', 'land.clean', 'cap.clash', 'outro.tag']) {
        assert.ok(keys.has('zh ' + k) && keys.has('en ' + k), k);
    }
});

test('no terminal: nothing here draws a statusline or a terminal chrome', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'tour-closing.js'), 'utf8');
    assert.doesNotMatch(src, /termCut|landCloseup|vsCode|FANKEEL|TERMINAL/);
});
