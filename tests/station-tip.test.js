'use strict';
// assets/station/tip.js — the one tooltip the redesigned pages share
// (docs/99-archive/2026-10-21-station-redesign-design.md, "Rules every
// redesigned page keeps": a tooltip belongs to one segment, one label line and
// at most two values; keyboard focus shows the same tip as hover; Esc hides
// it). The module runs in its own vm with a document that records listeners.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ASSETS, 'tip.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ASSETS, 'tip.css'), 'utf8');

// An element as tip.js touches it: attributes, style, hidden, innerHTML, a
// rectangle, and `closest` for `[data-tip]` walking up `parent`.
function el(attrs, parent) {
    return {
        attrs: Object.assign({}, attrs), parent: parent || null, style: {}, hidden: false, innerHTML: '', className: '',
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        getBoundingClientRect() { return { left: 100, top: 40, width: 20, height: 8 }; },
        closest(sel) {
            if (sel === '[data-tip]' && Object.prototype.hasOwnProperty.call(this.attrs, 'data-tip')) return this;
            return this.parent ? this.parent.closest(sel) : null;
        },
    };
}

function boot() {
    const on = {};
    const made = [];
    const body = { kids: [], appendChild(e) { this.kids.push(e); } };
    const doc = {
        body,
        addEventListener(type, fn) { (on[type] = on[type] || []).push(fn); },
        createElement() { const e = el(); made.push(e); return e; },
    };
    const win = { scrollX: 0, scrollY: 10 };
    const box = vm.createContext({ window: win, document: doc, module: { exports: {} } });
    vm.runInContext(SRC, box);
    const fire = (type, e) => (on[type] || []).forEach((fn) => fn(e));
    return { T: box.module.exports, win, made, body, fire, on };
}

test('attr writes the label, at most two values, a tab stop and an accessible name', () => {
    const { T } = boot();
    const a = T.attr('build <x>', ['$1.20', '', null, '40m', 'third']);
    assert.match(a, /^ tabindex="0" data-tip="build &lt;x&gt;"/);
    assert.ok(a.includes(' data-tip-v="$1.20\u241f40m"'), a);
    assert.ok(!a.includes('third'), 'a third value is dropped');
    assert.ok(a.includes(' aria-label="build &lt;x&gt; · $1.20 · 40m"'), a);
    assert.ok(!T.attr('plan').includes('data-tip-v'), 'no values, no data-tip-v');
    assert.equal(T.SEP, '\u241f');
});

test('hover over a mark, or anything inside it, fills the one box with text and places it', () => {
    const { T, made, body, fire } = boot();
    const mark = el({ 'data-tip': 'build', 'data-tip-v': '$1.20\u241f<b>40m</b>' });
    fire('mouseover', { target: el({}, mark) });
    assert.equal(made.length, 1);
    const box = made[0];
    assert.equal(body.kids[0], box);
    assert.equal(box.className, 'fk-tip');
    assert.equal(box.attrs.role, 'tooltip');
    assert.equal(box.hidden, false);
    assert.equal(box.innerHTML, '<b>build</b><span>$1.20</span><span>&lt;b&gt;40m&lt;/b&gt;</span>');
    assert.equal(box.style.left, '110px');
    assert.equal(box.style.top, '50px');
    fire('mouseover', { target: el({ 'data-tip': 'plan' }) });
    assert.equal(made.length, 1, 'still one box');
    assert.equal(box.innerHTML, '<b>plan</b>');
    assert.equal(typeof T.hide, 'function');
});

test('leaving the mark hides the box; moving inside it does not', () => {
    const { made, fire } = boot();
    const mark = el({ 'data-tip': 'verify' });
    const inner = el({}, mark);
    fire('mouseover', { target: mark });
    fire('mouseout', { target: mark, relatedTarget: inner });
    assert.equal(made[0].hidden, false);
    fire('mouseout', { target: inner, relatedTarget: el({}) });
    assert.equal(made[0].hidden, true);
});

test('keyboard focus shows the same tip; Esc and blur hide it', () => {
    const { made, fire } = boot();
    const mark = el({ 'data-tip': 'land', 'data-tip-v': '3' });
    fire('focusin', { target: mark });
    assert.equal(made[0].innerHTML, '<b>land</b><span>3</span>');
    assert.equal(made[0].hidden, false);
    fire('keydown', { key: 'Escape' });
    assert.equal(made[0].hidden, true);
    fire('focusin', { target: mark });
    fire('focusout', { target: mark });
    assert.equal(made[0].hidden, true);
});

test('the listeners are bound once, and the module is on window', () => {
    const { T, win, on } = boot();
    T.init();
    T.init();
    assert.equal(on.mouseover.length, 1);
    assert.equal(on.keydown.length, 1);
    assert.equal(win.FK_TIP, T);
});

test('tip.css draws the box and hides it when hidden', () => {
    assert.match(CSS, /\.fk-tip\{[^}]*position:absolute/);
    assert.match(CSS, /\.fk-tip\[hidden\]\{display:none\}/);
    assert.match(CSS, /\[data-tip\]:focus-visible/);
});
