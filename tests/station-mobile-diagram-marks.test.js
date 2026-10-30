'use strict';
// station-66: on the phone's gate screen a tap on a diagram node writes the one 標記 line into
// question 1's own box and ticks that box's radio, as the desktop gate page does (tests/station-gate-mark.test.js);
// a redraw puts the marks back, and a new gate starts with none.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.js'), 'utf8');
const NOW = Date.now();
const ID = 'aaaaaaaa-5';
const Q = (q) => [{ question: q, multiSelect: false, options: [{ label: 'build (Recommended)' }, { label: '再想想' }] }];
const HOME = { host: 'h', at: NOW, device: null, gates: [], tasks: [], stopped: [], done: [] };
const phoneJson = (q, until) => ({ id: ID, root: '/w', task: 't5', project: 'proj', stage: 'survey', route: ['survey', 'design'], state: 'gate', attached: false,
    waiting: null, chat: [], gate: { questions: Q(q), until }, diagrams: [{ line: 3, code: 'flowchart TD\n  A["Start"] --> B["Done"]' }], background: [], at: NOW, holdUntil: null, context: null, limits: null });
const reply = (body) => Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
const settle = () => new Promise((r) => setTimeout(r, 30));
// the page ran in its own vm context: its arrays are not this realm's
const plain = (x) => JSON.parse(JSON.stringify(x));

// /m booted on #/s/<id> with a fake FK_DIAGRAM that records each draw(root, opts), and a document
// whose #gc-own0 is one box inside a label holding the radio `typed` ticks.
function boot(state) {
    const on = { doc: {}, win: {} };
    const listen = (where) => (type, fn) => { (on[where][type] = on[where][type] || []).push(fn); };
    const radio = { checked: false };
    const label = { querySelector: (s) => (s === 'input[value="__other"]' ? radio : null) };
    const own = { value: '', id: 'gc-own0', getAttribute: (a) => (a === 'data-own' ? '0' : null), closest: (s) => (s === 'label' ? label : null) };
    const root = {};
    const draws = [];
    const app = { innerHTML: '' };
    const doc = {
        getElementById: (id) => (id === 'app' ? app : null), documentElement: {}, body: { insertAdjacentHTML() {} }, addEventListener: listen('doc'),
        querySelector: (s) => (s === '.gc-dg' && app.innerHTML.includes('class="gc-dg"') ? root : s === '#gc-own0' ? own : null), visibilityState: 'visible',
    };
    const win = {
        document: doc, location: { hash: '#/s/' + ID }, navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/141.0 Mobile Safari/537.36' },
        localStorage: { getItem: () => null, setItem() {} }, addEventListener: listen('win'), setInterval() {}, setTimeout, URLSearchParams,
        fetch: (url) => reply(url === '/station/mobile.json' ? HOME : state.one),
        FK_DIAGRAM: { fence: (code, line) => '<figure class="dg" data-mermaid data-l="' + line + '"></figure>', draw: (r, o) => draws.push({ root: r, o }) },
    };
    vm.runInNewContext(SRC, { window: win });
    const fire = (where, type, e) => (on[where][type] || []).forEach((fn) => fn(e));
    return { win, own, radio, root, draws, app, poll: () => { fire('doc', 'visibilitychange', {}); return settle(); }, goto: (h) => { win.location.hash = h; fire('win', 'hashchange', {}); return settle(); } };
}
const tap = (page, list) => page.draws[page.draws.length - 1].o.onMark(list);

test('the gate screen draws its figures once the page is written, with marks on and none marked', async () => {
    const page = boot({ one: phoneJson('往下走？', NOW + 760e3) });
    await settle();
    assert.equal(page.draws.length, 1);
    assert.equal(page.draws[0].root, page.root);
    assert.equal(page.draws[0].o.mark, true);
    assert.deepEqual(plain(page.draws[0].o.marked), []);
    assert.equal(page.win.FK_I18N.lang, 'zh', 'diagram.js words its buttons from the page\'s language');
});

test('marking writes one 標記 line after the reader\'s own text, ticks 自己寫, and unmarking removes it', async () => {
    const page = boot({ one: phoneJson('往下走？', NOW + 760e3) });
    await settle();
    page.own.value = 'my words';
    tap(page, [{ fig: 0, id: 'A', label: 'Start' }]);
    assert.equal(page.own.value, 'my words\n標記：A「Start」');
    assert.equal(page.radio.checked, true);
    tap(page, [{ fig: 0, id: 'A', label: 'Start' }, { fig: 0, id: 'B', label: 'Done' }]);
    assert.equal(page.own.value, 'my words\n標記：A「Start」、B「Done」');
    tap(page, []);
    assert.equal(page.own.value, 'my words');
});

test('a redraw of the same gate puts the marks back into the box and onto the figure; a new gate starts clean', async () => {
    const state = { one: phoneJson('往下走？', NOW + 760e3) };
    const page = boot(state);
    await settle();
    tap(page, [{ fig: 0, id: 'A', label: 'Start' }]);
    page.own.value = '';
    await page.goto('#/s/' + ID + '/talk');
    const again = page.draws[page.draws.length - 1].o;
    assert.deepEqual(plain(again.marked), [{ fig: 0, id: 'A', label: 'Start' }]);
    assert.equal(page.own.value, '標記：A「Start」');
    state.one = phoneJson('要不要換方向？', NOW + 900e3);
    await page.poll();
    assert.deepEqual(plain(page.draws[page.draws.length - 1].o.marked), []);
});
