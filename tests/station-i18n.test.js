'use strict';
// The station in two languages (design §5; mockup block lang-switch). Every
// string station.js draws goes through loc(key, zh, vars): the Chinese is at
// the call, the English in assets/station/i18n.js. In English the left bar,
// the crumbs and the masthead carry no CJK character; the Chinese boot is the
// control that shows this test can see one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I = require('../assets/station/i18n.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const LINES = SRC.split('\n');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const LIT = /'(?:[^'\\\n]|\\.)*'/g;
// The switch's own titles, and the Chinese option's own name, are in the language they name, on purpose.
const ALLOW = new Set(["'介面用繁體中文'", "'介面改用繁體中文'", "'繁中'"]);
const KEYED = /\bloc\('([a-z]+\.[A-Za-z0-9]+)', '((?:[^'\\\n]|\\.)*)'/g;
const LEAD = /\bloc\('[a-z]+\.[A-Za-z0-9]+',\s*$/;
// Marker text → key prefix, in file order; `fmt` before the first marker.
const SECTIONS = [['the three levels: shared', 'shared'], ['the project page', 'proj'], ['the session page', 'ses'],
    ['the live page', 'live'], ['the left bar', 'nav'], ['設定: the seven-step wizard', 'wiz'], ['tune: a block changed', 'tune'],
    ['儀表板 (`#/`)', 'dash'], ['the detail panel', 'det'], ['派工:', 'disp'], ['記成 TODO', 'todo'], ['比較', 'cmp'],
    ['the header search', 'q'], ['language:', 'mast'], ['live refresh', 'poll'], ['serve health polling', 'health']];
const PREFIX = (() => {
    const out = [];
    let p = 'fmt';
    for (const l of LINES) {
        if (l.startsWith('    // ---- ')) {
            const hit = SECTIONS.find(([mark]) => l.includes(mark));
            if (hit) p = hit[1];
        }
        out.push(p);
    }
    return out;
})();

test('i18n.js: English for every key, no CJK in it, and the language picked from storage, then the browser', () => {
    for (const [k, v] of Object.entries(I.STRINGS.en)) {
        assert.match(k, /^[a-z]+\.[A-Za-z0-9]+$/, k);
        assert.equal(typeof v, 'string', k);
        assert.doesNotMatch(v, CJK, k + ' is not English');
    }
    const win = (kept, language) => ({ navigator: { language }, localStorage: { getItem: () => kept, setItem() {} } });
    assert.equal(I.pick(win('en', 'zh-TW')), 'en');
    assert.equal(I.pick(win('zh', 'en-US')), 'zh');
    assert.equal(I.pick(win(null, 'zh-TW')), 'zh');
    assert.equal(I.pick(win(null, 'en-US')), 'en');
    assert.equal(I.pick(win(null, '')), 'zh');
    assert.equal(I.pick({}), 'zh');
});

test('t: English by key with {vars} filled, Chinese otherwise, and set() stores the choice', () => {
    const kept = {};
    const w = { navigator: { language: 'en-US' }, localStorage: { getItem: (k) => kept[k] || null, setItem: (k, v) => { kept[k] = v; } } };
    const api = I.make(w);
    assert.equal(api.lang, 'en');
    assert.equal(api.t('mast.station', '測站'), 'station');
    assert.equal(api.t('no.suchKey', '中文'), '中文');
    assert.equal(api.t('no.suchKey', '等了 {t}', { t: '4m' }), '等了 4m');
    assert.equal(api.set('zh'), true);
    assert.equal(kept['station.lang'], 'zh');
    assert.equal(api.t('mast.station', '測站'), '測站');
    assert.equal(api.set('fr'), false);
});

test('every CJK string literal in station.js is the Chinese of a loc() call (the extraction worklist)', () => {
    const left = [];
    LINES.forEach((text, i) => {
        if (/^\s*\/\//.test(text)) return;
        LIT.lastIndex = 0;
        let m;
        while ((m = LIT.exec(text))) {
            if (!CJK.test(m[0]) || ALLOW.has(m[0])) continue;
            if (LEAD.test(text.slice(0, m.index))) continue;
            left.push((i + 1) + '\t' + PREFIX[i] + '\t' + m[0]);
        }
    });
    assert.deepEqual(left, [], left.length + ' literals left (line, key prefix, literal):\n' + left.join('\n'));
});

test('each loc() key has its section\'s prefix, one Chinese string, and an English entry; every entry is used', () => {
    const zhOf = new Map();
    const bad = [];
    LINES.forEach((text, i) => {
        KEYED.lastIndex = 0;
        let m;
        while ((m = KEYED.exec(text))) {
            const [key, zh] = [m[1], m[2]];
            if (key.split('.')[0] !== PREFIX[i]) bad.push((i + 1) + ' ' + key + ' is in section ' + PREFIX[i]);
            if (zhOf.has(key) && zhOf.get(key) !== zh) bad.push((i + 1) + ' ' + key + ' carries two strings');
            zhOf.set(key, zh);
            if (!Object.prototype.hasOwnProperty.call(I.STRINGS.en, key)) bad.push((i + 1) + ' ' + key + ' has no English');
        }
    });
    for (const k of Object.keys(I.STRINGS.en)) if (!zhOf.has(k)) bad.push(k + ' is in i18n.js and used nowhere');
    assert.ok(zhOf.size > 200, 'only ' + zhOf.size + ' keys found');
    assert.deepEqual(bad, []);
});

// station.js booted as the browser runs it, with i18n.js's API on the window.
function boot(lang) {
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const kept = { 'station.lang': lang };
    const root = el('html');
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date(2026, 8, 27, 16, 0).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const doc = { hidden: false, documentElement: root, title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }), head: { appendChild() {} } };
    win.FK_I18N = I.make(win);
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }) });
    return { els, root, doc };
}

test('EN: the left bar, the crumbs and the masthead carry no CJK character', () => {
    const p = boot('en');
    const where = (s) => (s.match(new RegExp(CJK.source, 'g')) || []).join('');
    assert.ok(p.els.nav.innerHTML.length > 200, 'the nav was drawn');
    assert.equal(where(p.els.nav.innerHTML), '', 'nav');
    assert.equal(where(p.els.side.innerHTML), '', 'crumbs');
    assert.equal(p.els.brandw.textContent, 'station');
    assert.equal(p.els.q.placeholder, 'Search tasks, sessions, files touched…');
    for (const id of ['brand', 'side', 'q']) {
        assert.ok(p.els[id].attrs['aria-label'], id + ' has an aria-label');
        assert.equal(where(p.els[id].attrs['aria-label']), '', id);
    }
    assert.equal(where(p.els.servedown.innerHTML), '', 'servedown');
    assert.equal(where(p.doc.title), '', 'title');
    assert.equal(p.root.attrs.lang, 'en');
    assert.equal(p.els.langen.attrs['aria-pressed'], 'true');
    assert.equal(p.els.langzh.attrs['aria-pressed'], 'false');
    assert.equal(p.els.langcur.textContent, 'EN');
    assert.equal(p.els.langen.attrs['aria-checked'], 'true');
    assert.equal(p.els.langzh.attrs['aria-checked'], 'false');
});

test('zh: the same boot draws the Chinese bar and masthead (the control)', () => {
    const p = boot('zh');
    assert.match(p.els.nav.innerHTML, /儀表板/);
    assert.equal(p.els.brandw.textContent, '測站');
    assert.equal(p.root.attrs.lang, 'zh-Hant');
    assert.equal(p.els.langzh.attrs['aria-pressed'], 'true');
});
