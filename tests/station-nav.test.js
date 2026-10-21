'use strict';
// The one-level bar and the jump box (docs/90-agent/plans/
// 2026-10-21-station-focus-design.md §3; mockup blocks nav and jump).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'land'];
const row = (id, over) => Object.assign({ id, pkey: 'F:\\ws\\alpha', root: 'F:\\ws\\alpha', project: null, task: 'task ' + id, state: 'live',
    route: ROUTE, stage: 'build', stages: [], updated: NOW - 60000, started: new Date(NOW - 3e6).toISOString(), days: [], subagents: [], notes: [], claims: [] }, over);
const SESSIONS = [
    row('a5bb742d-938e-4bf0-ad49-6912791c4eca', { task: '決策總攬對齊', stage: 'design', pending: { questions: [{ header: 'q' }] }, gateAt: NOW - 1000 }),
    row('9f451488-d5a6-4838-8cfc-9a451fd4f0e1', { task: 'TODO 全表盤點', updated: NOW - 120000 }),
    row('14affe41-bc6b-4644-94f2-4a3a5c3746dd', { task: 'ils-bench 盤點', state: 'down', stage: 'land', pkey: 'F:\\ws\\ils', root: 'F:\\ws\\ils' }),
];

function boot(hash, serve) {
    const els = {}, listeners = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', value: '', hidden: false, attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {},
        focus() { this.focused = true; }, select() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = Object.assign(el(), { id })),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: hash || '#/', protocol: 'file:', href: '' }, addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: Boolean(serve),
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: SESSIONS } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    const fire = (type, ev) => { for (const fn of listeners[type] || []) fn(Object.assign({ preventDefault() {}, stopPropagation() {} }, ev)); };
    return { V: box.module.exports, els, win, fire, get: doc.getElementById };
}

test('the bar is one level: 現在, Sessions, 花費, 文件, then 設定 and 導覽 pinned, and no fold anywhere', () => {
    const { els } = boot('#/');
    const nav = els.nav.innerHTML;
    assert.match(nav, /^<nav class="sidenav hm-flat" data-block="nav" aria-label="功能"><div class="navbox"><div class="jump" data-block="jump">/);
    const main = nav.slice(nav.indexOf('<ul class="navmain">'), nav.indexOf('<ul class="navpin">'));
    const pin = nav.slice(nav.indexOf('<ul class="navpin">'));
    assert.deepEqual([...main.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]), ['現在', 'Sessions', '花費', '文件']);
    assert.deepEqual([...pin.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]), ['設定', '導覽']);
    assert.doesNotMatch(nav, /data-navfold|navkids|navchev|<button/);
    assert.match(nav, /<a href="#\/" aria-current="page">[\s\S]*?<span>現在<\/span><span class="nb wait" title="1 個 session 在等你回答">1<\/span><\/a>/);
    assert.equal((nav.match(/class="nb/g) || []).length, 1, 'only 現在 carries a count');
    assert.deepEqual([...els.page.innerHTML.matchAll(/data-block="(home-[^"]+)"/g)].map((m) => m[1]), ['home-live', 'home-running', 'home-todo', 'home-spend']);
});

test('a sub-page, a detail page and an old hash light the bar entry that holds it', () => {
    const lit = (hash) => /<a href="([^"]+)" aria-current="page"/.exec(boot(hash).els.nav.innerHTML)[1];
    for (const h of ['#/live', '#/sessions', '#/list', '#/cmp', '#/s/9f451488-d5a6-4838-8cfc-9a451fd4f0e1']) assert.equal(lit(h), '#/sessions', h);
    for (const h of ['#/days', '#/projects', '#/p/F%3A%5Cws%5Calpha']) assert.equal(lit(h), '#/days', h);
    // 設定 is drawn from the profile keys this fixture lacks, so its entry is checked on the links alone.
    assert.match(boot('#/').V.navLinksHtml('settings', { waiting: 0 }), /<a href="#\/settings" aria-current="page"/);
});

test('with nothing waiting 現在 carries no count', () => {
    const { V } = boot('#/');
    assert.deepEqual({ ...require('../assets/station/station.js').navCounts([row('x')]) }, { waiting: 0 });
    assert.doesNotMatch(V.navHtml('now', { waiting: 0 }), /class="nb/);
});

test('jumpHits matches an id prefix, the task text or the project, live first, and nothing for an empty box', () => {
    const { V } = boot('#/');
    const name = (s) => (s.pkey.endsWith('ils') ? 'ils-bench' : 'alpha');
    assert.deepEqual(V.jumpHits(SESSIONS, '14af', name).map((s) => s.stage), ['land']);
    assert.deepEqual(V.jumpHits(SESSIONS, '盤點', name).map((s) => s.id.slice(0, 4)), ['9f45', '14af'], 'live before down');
    assert.deepEqual(V.jumpHits(SESSIONS, 'ILS-B', name).map((s) => s.id.slice(0, 4)), ['14af']);
    assert.deepEqual([...V.jumpHits(SESSIONS, '   ', name)], []);
});

test('jumpListHtml marks the chosen row, the matched id digits, and links each to its focus page', () => {
    const { V } = boot('#/');
    const html = V.jumpListHtml([SESSIONS[1], SESSIONS[2]], '9f4', 0, true, () => 'fankeel');
    assert.match(html, /^<a class="hm-jr on" role="option" aria-selected="true" href="\/f\/9f451488-d5a6-4838-8cfc-9a451fd4f0e1\/build">/);
    assert.match(html, /<span class="hm-jr-m">fankeel · <mark>9f4<\/mark>51488<\/span>/);
    assert.match(html, /<a class="hm-jr" role="option" aria-selected="false" href="\/f\/14affe41-bc6b-4644-94f2-4a3a5c3746dd\/land">/);
    assert.match(html, /<p class="jfoot">/);
    assert.match(V.jumpListHtml([], 'zz', 0, true, () => ''), /<p class="jnone">沒有符合的 session/);
});

test('typing in the box opens the list, ↓ moves the mark, Enter goes to the marked session, Ctrl K focuses the box', () => {
    const p = boot('#/', true);
    p.get('jq').value = '盤點';
    p.fire('input', { target: p.els.jq });
    assert.equal(p.els.jpop.hidden, false);
    assert.equal(p.els.jq.attrs['aria-expanded'], 'true');
    assert.match(p.els.jpop.innerHTML, /hm-jr on[^>]*href="\/f\/9f451488/);
    p.fire('keydown', { target: p.els.jq, key: 'ArrowDown' });
    assert.match(p.els.jpop.innerHTML, /hm-jr on[^>]*href="\/f\/14affe41/);
    p.fire('keydown', { target: p.els.jq, key: 'Enter' });
    assert.equal(p.win.location.href, '/f/14affe41-bc6b-4644-94f2-4a3a5c3746dd/land');
    p.els.jq.value = '';
    p.fire('input', { target: p.els.jq });
    assert.equal(p.els.jpop.hidden, true);
    p.els.jq.focused = false;
    p.fire('keydown', { target: p.els.page, key: 'k', ctrlKey: true });
    assert.equal(p.els.jq.focused, true);
});

test('↑ from the first match wraps to the last, and Esc empties the box and shuts the list', () => {
    const p = boot('#/', true);
    p.get('jq').value = 'l';
    p.fire('input', { target: p.els.jq });
    assert.equal((p.els.jpop.innerHTML.match(/role="option"/g) || []).length, 3);
    assert.match(p.els.jpop.innerHTML, /hm-jr on[^>]*href="\/f\/a5bb742d/);
    p.fire('keydown', { target: p.els.jq, key: 'ArrowUp' });
    assert.match(p.els.jpop.innerHTML, /hm-jr on[^>]*href="\/f\/14affe41/);
    p.fire('keydown', { target: p.els.jq, key: 'Escape' });
    assert.equal(p.els.jq.value, '');
    assert.equal(p.els.jpop.hidden, true);
    assert.equal(p.els.jq.attrs['aria-expanded'], 'false');
});

test('a click outside the jump box shuts the list, a click inside keeps it open', () => {
    const p = boot('#/', true);
    p.get('jq').value = '盤點';
    p.fire('input', { target: p.els.jq });
    const at = (inJump) => ({ closest: (sel) => (sel === '.jump' && inJump ? {} : null), getAttribute: () => null });
    p.fire('click', { target: at(true) });
    assert.equal(p.els.jpop.hidden, false);
    p.fire('click', { target: at(false) });
    assert.equal(p.els.jpop.hidden, true);
});

test('a redraw replaces only the links, so the box keeps what was typed', () => {
    const p = boot('#/');
    const first = p.els.nav.innerHTML;
    p.win.location.hash = '#/days';
    p.fire('hashchange', {});
    assert.equal(p.els.nav.innerHTML, first, 'the bar with the box is written once');
});
