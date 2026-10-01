'use strict';
// The 近 30 天 chart hover: the document `mousemove` listener of
// assets/station/station.js, pressed through the page's own listener list on
// the real days page with fake chart elements. Each test is red under a
// different set of single-branch mutations of that listener (guards, the legend
// branch, the column branch, the no-cell branch, each field of `chartAt` read
// back by the 3 s redraw, and the arguments of chartFocus / chartPlace /
// chartGuide).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const DAY = '2026-09-30', TODAY = '2026-10-01';
const LEG = '.legend [data-key]:not([data-off])';

// station.js booted on `hash` with two models spent on two days, every
// document listener kept by type, and the chart's elements named by a test.
function boot(hash) {
    const listeners = {}, winListeners = {}, els = {}, named = {}, lists = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 50 }) });
    const win = { location: { hash }, innerWidth: 1000, innerHeight: 800,
        addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); }, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [{ id: 'sid0', pkey: 'F:\\ws\\alpha', root: 'F:\\ws\\alpha', task: 'alpha one', state: 'live', updated: NOW - 1000, started: NOW - 60000, stage: 'build',
                days: [{ day: TODAY, stage: 'build', model: 'claude-opus-5', who: 'main', tokens: null, cost: null, usd: 3 },
                    { day: DAY, stage: 'build', model: 'claude-sonnet-5', who: 'main', tokens: null, cost: null, usd: 1 }], spans: [] }] } };
    const fallback = Object.assign(el(), { parentNode: { insertBefore() {} }, nextSibling: null, click() {} });
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el,
        querySelectorAll: (sel) => lists[sel] || [], querySelector: (sel) => (sel in named ? named[sel] : fallback), head: { appendChild() {} } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const move = (listeners.mousemove || []).filter((fn) => String(fn).includes('.chart .hit'));
    assert.equal(move.length, 1, 'exactly one mousemove listener holds the chart hover');
    const svg = el(), guide = el(), tip = els.charttip = els.charttip || el();
    const hseg = Object.assign(el(), { attrs: { 'data-key': 'sonnet-5' } }), other = Object.assign(el(), { attrs: { 'data-key': 'opus-5' } });
    const legend = Object.assign(el(), { attrs: { 'data-key': 'sonnet-5' } });
    named['.chart svg'] = svg;
    named['.chart .hguide'] = guide;
    lists['.chart .hseg, .legend [data-key]'] = [hseg, other, legend];
    const goto = (to) => { win.location.hash = to; (winListeners.hashchange || []).forEach((fn) => fn({})); };
    const fire = (target, extra) => move[0](Object.assign({ target, clientX: 300, clientY: 200 }, extra));
    // The page is rebuilt under a pointer that has not moved: the old hover marks are gone, then the 3 s redraw runs.
    const rebuild = () => {
        [svg, guide, tip].forEach((x) => { x.attrs = {}; });
        [hseg, other, legend].forEach((x) => { delete x.attrs['data-hot']; });
        tip.innerHTML = '';
        tip.style = {};
        goto('#/days');
    };
    return { win, svg, guide, tip, hseg, other, legend, fire, goto, rebuild };
}

// A target whose closest() answers exactly the selectors it was given.
const tgt = (answers) => ({ closest: (sel) => (sel in answers ? answers[sel] : null) });
const col = (attrs) => ({ attrs, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } });
const SEG = () => col({ 'data-day': DAY, 'data-key': 'sonnet-5', 'data-cx': '55' });
const HIT = () => col({ 'data-day': DAY, 'data-cx': '77' });
const onSeg = () => tgt({ '.chart .hseg': SEG() });
const onHit = () => tgt({ '.chart .hit': HIT() });
const onLegend = () => tgt({ [LEG]: col({ 'data-key': 'sonnet-5' }) });
const outside = () => tgt({});

// ---- the guards ------------------------------------------------------------
test('off the days page a move over a column does nothing, though the bars of the last visit are still held', () => {
    const p = boot('#/days');
    p.goto('#/');
    p.fire(onSeg());
    assert.equal(p.tip.hasAttribute('data-on'), false);
    assert.equal(p.tip.innerHTML, '');
    assert.equal(p.guide.hasAttribute('data-on'), false);
});

test('on a days route whose page never drew its bars a move over a legend entry does nothing', () => {
    const p = boot('#/');
    p.win.STATION.sessions = null;
    try { p.goto('#/days'); } catch (err) { /* the page cannot draw: that is the state under test */ }
    assert.doesNotThrow(() => p.fire(onLegend()));
    assert.equal(p.svg.hasAttribute('data-focus'), false);
    assert.equal(p.tip.hasAttribute('data-on'), false);
});

test('a target with no closest is ignored without throwing', () => {
    const p = boot('#/days');
    assert.doesNotThrow(() => p.fire({}));
    assert.equal(p.svg.hasAttribute('data-focus'), false);
    assert.equal(p.tip.hasAttribute('data-on'), false);
});

// ---- the legend branch -----------------------------------------------------
test('a move onto a legend entry lights that series on the chart and the legend', () => {
    const p = boot('#/days');
    p.fire(onLegend());
    assert.equal(p.svg.getAttribute('data-focus'), 'sonnet-5');
    assert.equal(p.hseg.hasAttribute('data-hot'), true);
    assert.equal(p.legend.hasAttribute('data-hot'), true);
    assert.equal(p.other.hasAttribute('data-hot'), false);
});

test('a move onto a legend entry takes the column card and its guide away first', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    assert.equal(p.tip.hasAttribute('data-on'), true);
    p.fire(onLegend());
    assert.equal(p.tip.hasAttribute('data-on'), false);
    assert.equal(p.guide.hasAttribute('data-on'), false);
});

test('a legend entry that is clicked out is not a hover target', () => {
    const p = boot('#/days');
    p.fire(tgt({ '.legend [data-key]': col({ 'data-key': 'sonnet-5', 'data-off': '' }) }));
    assert.equal(p.svg.hasAttribute('data-focus'), false);
    assert.equal(p.tip.hasAttribute('data-on'), false);
});

test('a legend hover ends on a move to nothing: the series light goes out', () => {
    const p = boot('#/days');
    p.fire(onLegend());
    p.fire(outside());
    assert.equal(p.svg.hasAttribute('data-focus'), false);
    assert.equal(p.legend.hasAttribute('data-hot'), false);
});

test('a legend hover is put back by the redraw under a pointer that has not moved', () => {
    const p = boot('#/days');
    p.fire(onLegend());
    p.rebuild();
    assert.equal(p.svg.getAttribute('data-focus'), 'sonnet-5');
    assert.equal(p.legend.hasAttribute('data-hot'), true);
});

test('a legend move stops there: the column branch is not run for it', () => {
    const p = boot('#/days');
    p.fire(tgt({ [LEG]: col({ 'data-key': 'sonnet-5' }), '.chart .hit': HIT() }));
    assert.equal(p.tip.hasAttribute('data-on'), false);
    assert.equal(p.svg.getAttribute('data-focus'), 'sonnet-5');
});

// ---- the column branch -----------------------------------------------------
test('a move over a segment fills the card with its day, the segment and the stack, and shows it', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    assert.match(p.tip.innerHTML, new RegExp('tt-day">' + DAY));
    assert.match(p.tip.innerHTML, /tt-main/);
    assert.match(p.tip.innerHTML, /tt-sum/);
    assert.equal(p.tip.getAttribute('data-on'), '');
});

test('a move over the empty part of a column names no segment on the card', () => {
    const p = boot('#/days');
    p.fire(onHit());
    assert.match(p.tip.innerHTML, new RegExp('tt-day">' + DAY));
    assert.doesNotMatch(p.tip.innerHTML, /tt-main/);
    assert.equal(p.tip.getAttribute('data-on'), '');
});

test('a segment that lies over a column wins: the card names the segment', () => {
    const p = boot('#/days');
    p.fire(tgt({ '.chart .hseg': SEG(), '.chart .hit': col({ 'data-day': TODAY, 'data-cx': '99' }) }));
    assert.match(p.tip.innerHTML, new RegExp('tt-day">' + DAY));
    assert.equal(p.guide.getAttribute('x1'), '55');
});

test('the card sits beside the pointer', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    assert.equal(p.tip.style.left, '314px');
});

test('the card sits below the pointer', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    assert.equal(p.tip.style.top, '214px');
});

test('the guide line stands at the column the pointer is on', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    assert.equal(p.guide.getAttribute('x1'), '55');
    assert.equal(p.guide.getAttribute('x2'), '55');
    assert.equal(p.guide.getAttribute('data-on'), '');
});

test('over a segment that series is lit everywhere', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    assert.equal(p.svg.getAttribute('data-focus'), 'sonnet-5');
    assert.equal(p.hseg.hasAttribute('data-hot'), true);
    assert.equal(p.other.hasAttribute('data-hot'), false);
});

test('over the empty part of a column the light of a series goes out', () => {
    const p = boot('#/days');
    p.svg.setAttribute('data-focus', 'sonnet-5');
    p.hseg.setAttribute('data-hot', '');
    p.fire(onHit());
    assert.equal(p.svg.hasAttribute('data-focus'), false);
    assert.equal(p.hseg.hasAttribute('data-hot'), false);
    assert.equal(p.guide.getAttribute('x1'), '77');
});

// ---- the redraw reads back what the move recorded --------------------------
test('the redraw puts the card back on the same day', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    p.rebuild();
    assert.match(p.tip.innerHTML, new RegExp('tt-day">' + DAY));
});

test('the redraw puts the card back on the same segment', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    p.rebuild();
    assert.match(p.tip.innerHTML, /tt-main/);
});

test('the redraw lights the same series again', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    p.rebuild();
    assert.equal(p.svg.getAttribute('data-focus'), 'sonnet-5');
    assert.equal(p.hseg.hasAttribute('data-hot'), true);
});

test('the redraw puts the guide back on the same column', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    p.rebuild();
    assert.equal(p.guide.getAttribute('x1'), '55');
});

test('the redraw puts the card back beside the same pointer: x', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    p.rebuild();
    assert.equal(p.tip.style.left, '314px');
});

test('the redraw puts the card back beside the same pointer: y', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    p.rebuild();
    assert.equal(p.tip.style.top, '214px');
});

test('the redraw under a pointer on the empty part of a column keeps the guide and names no segment', () => {
    const p = boot('#/days');
    p.fire(onHit());
    p.rebuild();
    assert.equal(p.guide.getAttribute('x1'), '77');
    assert.doesNotMatch(p.tip.innerHTML, /tt-main/);
    assert.equal(p.svg.hasAttribute('data-focus'), false);
});

// ---- what a move replaces --------------------------------------------------
test('a move over a column replaces whatever the card held', () => {
    const p = boot('#/days');
    p.tip.innerHTML = 'stale';
    p.fire(onHit());
    assert.doesNotMatch(p.tip.innerHTML, /stale/);
});

test('a move over a column moves a guide that stood elsewhere', () => {
    const p = boot('#/days');
    p.guide.setAttribute('x1', '9');
    p.fire(onHit());
    assert.notEqual(p.guide.getAttribute('x1'), '9');
});

// ---- the no-cell branch ----------------------------------------------------
test('a move to nothing after a column hover hides the card, the guide and the light', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    p.fire(outside());
    assert.equal(p.tip.hasAttribute('data-on'), false);
    assert.equal(p.guide.hasAttribute('data-on'), false);
    assert.equal(p.svg.hasAttribute('data-focus'), false);
});

test('a move to nothing with no hover to end leaves everything as it is', () => {
    const p = boot('#/days');
    p.tip.setAttribute('data-on', '');
    p.svg.setAttribute('data-focus', 'sonnet-5');
    p.fire(outside());
    assert.equal(p.tip.hasAttribute('data-on'), true);
    assert.equal(p.svg.getAttribute('data-focus'), 'sonnet-5');
});

test('a move to nothing that ends a hover ends it once: the next one hides nothing', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    p.fire(outside());
    p.tip.setAttribute('data-on', '');
    p.fire(outside());
    assert.equal(p.tip.hasAttribute('data-on'), true);
});

test('a move to nothing ends the hover: the redraw does not bring the card back', () => {
    const p = boot('#/days');
    p.fire(onSeg());
    p.fire(outside());
    p.rebuild();
    assert.equal(p.tip.hasAttribute('data-on'), false);
    assert.equal(p.tip.innerHTML, '');
});
