'use strict';
// station-39: the settings page's project picker is a GLOBAL | PROJECT switch,
// and PROJECT is a type-to-filter list like the station's own search
// (assets/station/station.js pickHtml) — a case-insensitive substring of the
// path, every project when the box is empty. GLOBAL shows the four MACHINE
// keys' questions (approved mockup: .fankeel/build/2026-10-26-todo-patrol/mockup-15.html).
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./station-module.js');

const A = 'F:\\ymlab\\fankeel';
const B = 'F:\\ymlab\\SBIR\\ProjectWorkspace';
const C = 'F:\\ymlab\\fork\\Quick-IME';
const DIRS = [A, B, C];

function boot(opts) {
    opts = opts || {};
    const calls = [];
    const fetch = (url, init) => {
        calls.push({ url, body: init && init.body ? new URLSearchParams(String(init.body)) : null });
        if (url.startsWith('station/suggest')) return Promise.resolve({ ok: false });
        return Promise.resolve({ ok: true });
    };
    const projects = {};
    DIRS.forEach((d) => { projects[d] = { values: {}, sources: {}, unreadable: [] }; });
    const S = { serve: true, nonce: 'n1', profiles: { machine: { values: { 'station.remote': true, 'ui.lang': 'zh' }, sources: {}, unreadable: [] }, projects } };
    const p = page(['settings-page.js'], {}, { fetch });
    const Q = p.M['settings-page.js'];
    Q.reset();
    let draws = 0;
    const o = { hash: '#/settings', configDir: 'C:\\cfg', redraw: () => { draws++; } };
    return { Q, S, calls, doc: p.doc, draws: () => draws, html: () => Q.page(S, o) };
}
// An event target: chain[0] the element, then its ancestors, each a map of attributes.
function el(chain, extra) {
    const all = chain.concat([{ 'data-sq': '' }]);
    const node = (i) => Object.assign({
        getAttribute: (k) => (Object.prototype.hasOwnProperty.call(all[i], k) ? String(all[i][k]) : null),
        setAttribute() {},
        closest(sel) { const k = sel.slice(1, -1); for (let j = i; j < all.length; j++) if (Object.prototype.hasOwnProperty.call(all[j], k)) return node(j); return null; },
    }, i === 0 ? extra : {});
    return node(0);
}
const click = (Q, chain) => Q.onClick({ target: el(chain) });
const tick = () => new Promise((r) => setImmediate(r));

test('matchDirs keeps every project for an empty box', () => {
    const { Q } = boot();
    assert.deepEqual(Q.matchDirs(DIRS, ''), DIRS);
    assert.deepEqual(Q.matchDirs(DIRS, '   '), DIRS);
});

test('matchDirs is a case-insensitive substring of the path', () => {
    const { Q } = boot();
    assert.deepEqual(Q.matchDirs(DIRS, 'quick'), [C]);
    assert.deepEqual(Q.matchDirs(DIRS, 'YMLAB\\S'), [B]);
    assert.deepEqual(Q.matchDirs(DIRS, 'nothing'), []);
});

test('the page opens on PROJECT, and the switch moves to GLOBAL and back', () => {
    const { Q } = boot();
    assert.equal(Q.view().scope, 'project');
    Q.setScope('global');
    assert.equal(Q.view().scope, 'global');
    Q.setScope('nonsense');
    assert.equal(Q.view().scope, 'global', 'only the two scopes are taken');
    Q.setScope('project');
    assert.equal(Q.view().scope, 'project');
});

test('PROJECT draws the switch and a closed picker; the select is gone', () => {
    const b = boot();
    const h = b.html();
    assert.match(h, /<div class="sq" data-block="settings-scope-project" data-sq>/);
    assert.match(h, /data-sq-scope="global" aria-pressed="false"><b>全域<\/b>/);
    assert.match(h, /data-sq-scope="project" aria-pressed="true"><b>個別<\/b><small>3 個專案<\/small>/);
    assert.match(h, /class="sq-trig"[^>]*aria-expanded="false"/);
    assert.doesNotMatch(h, /data-sq-pq|data-sq-dir|<select/);
    assert.match(h, /data-block="quick-page"/, 'the quick setup is still under the bar');
});

test('the trigger opens the picker; every project is a row, the current one selected', () => {
    const b = boot();
    b.html();
    click(b.Q, [{ 'data-sq-trig': '' }]);
    assert.equal(b.Q.view().open, true);
    assert.ok(b.draws() >= 1);
    const h = b.html();
    assert.match(h, /data-sq-pq value=""/);
    for (const d of DIRS) assert.ok(h.includes('data-sq-dir="' + d + '"'), d);
    assert.match(h, /aria-selected="true" data-sq-dir="F:\\ymlab\\fankeel"/);
    assert.match(h, /data-sq-cnt[^>]*>3 \/ 3</);
});

test('typing in the box hides the rows that do not match in place, with no redraw', () => {
    const b = boot();
    b.html();
    click(b.Q, [{ 'data-sq-trig': '' }]);
    const before = b.draws();
    const rows = DIRS.map((d) => ({ d, hidden: false, getAttribute: () => d }));
    const cnt = { textContent: '' }, none = { hidden: true };
    b.doc.querySelectorAll = (sel) => (sel === '[data-sq-dir]' ? rows : []);
    b.doc.querySelector = (sel) => (sel === '[data-sq-cnt]' ? cnt : sel === '[data-sq-none]' ? none : null);
    b.Q.onInput({ target: el([{ 'data-sq-pq': '' }], { value: 'quick' }) });
    assert.deepEqual(rows.map((r) => r.hidden), [true, true, false]);
    assert.equal(cnt.textContent, '1 / 3');
    assert.equal(b.draws(), before, 'a redraw would take the caret out of the box');
    assert.equal(b.Q.view().pq, 'quick');
    assert.match(b.html(), /data-sq-dir="F:\\ymlab\\fankeel" hidden/, 'a later redraw keeps the filter');
    b.Q.onInput({ target: el([{ 'data-sq-pq': '' }], { value: 'zzz' }) });
    assert.equal(none.hidden, false, 'no match says how to get the list back');
});

test('picking a row starts that project over and shuts the picker', () => {
    const b = boot();
    b.html();
    click(b.Q, [{ 'data-sq-trig': '' }]);
    click(b.Q, [{ 'data-sq-dir': C }]);
    assert.equal(b.Q.state().dir, C);
    assert.equal(b.Q.state().at, 'land');
    assert.equal(b.Q.view().open, false);
    assert.equal(b.Q.view().pq, '');
});

test('the trigger is disabled while a write is in flight, so a switch cannot drop it', async () => {
    const b = boot();
    b.html();
    await tick();
    click(b.Q, [{ 'data-all': '' }]);
    assert.doesNotMatch(b.html(), /class="sq-trig"[^>]* disabled/);
    click(b.Q, [{ 'data-write': '' }]);
    assert.equal(b.Q.state().busy, true);
    assert.match(b.html(), /class="sq-trig"[^>]* disabled/);
    click(b.Q, [{ 'data-sq-dir': C }]);
    assert.equal(b.Q.state().dir, A, 'a row click while busy does nothing');
    await tick(); await tick(); await tick();
});

test('GLOBAL draws the four machine questions and not the quick setup', () => {
    const b = boot();
    click(b.Q, [{ 'data-sq-scope': 'global' }]);
    assert.equal(b.Q.view().scope, 'global');
    const h = b.html();
    assert.match(h, /data-block="settings-scope-global"/);
    for (const q of ['remote', 'hold', 'quota', 'lang']) assert.ok(h.includes('data-block="global-q-' + q + '"'), q);
    assert.match(h, /data-gq="station.remote"[\s\S]*?aria-checked="true"[^>]*data-o="true"/, 'the machine value is the answer on');
    assert.match(h, /C:\\cfg\\fankeel\\profile\.json/);
    assert.doesNotMatch(h, /data-block="quick-page"|data-write/);
    click(b.Q, [{ 'data-sq-scope': 'project' }]);
    assert.match(b.html(), /data-block="quick-page"/);
});

test('GLOBAL writes only what changed, to the machine file', async () => {
    const b = boot();
    click(b.Q, [{ 'data-sq-scope': 'global' }]);
    b.html();
    assert.match(b.html(), /data-gwrite disabled/, 'nothing changed, nothing to write');
    click(b.Q, [{ 'data-o': 'en' }, { 'data-gq': 'ui.lang' }]);
    assert.match(b.html(), /data-gwrite>寫入 1 項/);
    click(b.Q, [{ 'data-gwrite': '' }]);
    await tick(); await tick();
    const post = b.calls.find((c) => c.url === 'profile');
    assert.ok(post, 'POST /profile');
    assert.equal(post.body.get('scope'), 'machine');
    assert.deepEqual(post.body.getAll('key'), ['ui.lang']);
    assert.deepEqual(post.body.getAll('value'), ['en']);
    assert.match(b.html(), /data-gwrite disabled/, 'written, so it matches the machine again');
});

test('GLOBAL will not write a phone.hold outside 1 to 1800', () => {
    const b = boot();
    click(b.Q, [{ 'data-sq-scope': 'global' }]);
    b.html();
    click(b.Q, [{ 'data-o': 'custom' }, { 'data-gq': 'phone.hold' }]);
    b.Q.onInput({ target: el([{ 'data-gin': 'phone.hold' }], { value: '9999' }) });
    assert.match(b.html(), /data-gwrite disabled/);
    b.Q.onInput({ target: el([{ 'data-gin': 'phone.hold' }], { value: '900' }) });
    assert.match(b.html(), /data-gwrite>寫入 1 項/);
});
