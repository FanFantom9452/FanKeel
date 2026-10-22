'use strict';
// The phone page (docs/90-agent/plans/2026-10-21-station-remote-design.md §4
// and the approved mockup's blocks): assets/station/mobile.js drawn from a
// mobile.json-shaped model, booted in a context of its own against a fake
// fetch, and assets/station/sw.js against fake caches.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const P = require('../assets/station/mobile.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const read = (name) => fs.readFileSync(path.join(ASSETS, name), 'utf8');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
// Local time, so 今天 / 昨天 and the clock times are this machine's.
const NOW = new Date(2026, 9, 21, 11, 2).getTime();
const Q1 = [{ question: '核准這份 design？', header: 'design', multiSelect: false, options: [
    { label: '核准，進 plan (Recommended)', description: '照 Tailscale + ntfy 這版拆任務' },
    { label: '改 mockup', description: '回 tune，指出要改的 block' },
    { label: '換做法', description: '回 design 重想連線方式' }] }];
const Q2 = [Q1[0], { question: '這次一起改哪些？', header: '範圍', multiSelect: true, options: [{ label: 'gate', description: 'a' }, { label: 'tune', description: 'b' }] }];
const row = (id, state, extra) => Object.assign({ id, root: '/w', task: 'task ' + id, project: 'proj', stage: 'build', route: [], gate: state === 'gate', updated: NOW, state, attached: false, background: [], last: null }, extra);
const BG = [{ id: 'b1', type: 'shell', status: 'running', description: 'npm test', command: 'npm test', since: NOW - 90e3 },
    { id: 'b2', type: 'agent', status: 'running', description: 'review', command: '', since: NOW - 30e3 },
    { id: 'b3', type: 'shell', status: 'running', description: 'build', command: 'x', since: NOW - 10e3 }];
const HOME = { host: 'my-pc', at: NOW, gates: [Object.assign(row('aaaaaaaa-1', 'gate'), { questions: Q1, since: NOW - 60e3, until: NOW + 240e3 })],
    tasks: [row('aaaaaaaa-1', 'gate'), row('aaaaaaaa-2', 'running', { last: { role: 'desktop', text: '跑測試', at: NOW } }), row('aaaaaaaa-3', 'background', { background: BG }), row('aaaaaaaa-4', 'idle'), row('aaaaaaaa-5', 'holding', { attached: true })], done: [] };
// One session's /station/phone.json; `sess`, not `page`, so a boot test's own `page` does not shadow it.
const sess = (state, extra) => Object.assign({ id: 'aaaaaaaa-2', root: '/w', task: 't', project: 'proj', stage: 'build', route: [], state, attached: false, waiting: null, chat: [], gate: null, background: [], at: NOW }, extra);
const APP = { mode: 'app' };
const count = (html, re) => (html.match(re) || []).length;

test('parseRoute: home, a session, the old gate and task links, done, pair', () => {
    assert.deepEqual(P.parseRoute(''), { view: 'home', id: null, pair: null });
    assert.deepEqual(P.parseRoute('#/s/aaaaaaaa-2'), { view: 'chat', id: 'aaaaaaaa-2', pair: null });
    assert.deepEqual(P.parseRoute('#/gate/aaaaaaaa-1'), { view: 'chat', id: 'aaaaaaaa-1', pair: null });
    assert.deepEqual(P.parseRoute('#/task/aaaaaaaa-1'), { view: 'chat', id: 'aaaaaaaa-1', pair: null });
    assert.deepEqual(P.parseRoute('#/done'), { view: 'done', id: null, pair: null });
    assert.deepEqual(P.parseRoute('#/pair/abcd2345'), { view: 'home', id: null, pair: 'ABCD2345' });
});

test('home: 等你答 first, then holding, running and background, then idle, under three counts', () => {
    const html = P.screen(HOME, P.parseRoute('#/'), NOW, APP);
    assert.match(html, /data-block="m-home-a"/);
    const order = ['ha-ask', 'ha-list', 'ha-idle'].map((c) => html.indexOf('class="' + c));
    assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), String(order));
    assert.equal(count(html, /<span class="st ask">/g), 1);
    assert.ok(html.indexOf('aaaaaaaa-5') < html.indexOf('aaaaaaaa-2') && html.indexOf('aaaaaaaa-2') < html.indexOf('aaaaaaaa-3'));
    assert.match(html, /\+1 個/, 'a background row names two items and +N for the rest');
    assert.match(html, /你：跑測試/);
});

test('each state draws its own screen block', () => {
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    for (const [state, extra] of [['idle', {}], ['background', { background: BG }], ['running', {}], ['holding', { attached: true }]]) {
        const html = P.screen(HOME, R, NOW, APP, sess(state, extra));
        assert.ok(html.includes(P.SCREEN[state]), state);
    }
    const gate = P.screen(HOME, R, NOW, APP, sess('gate', { gate: { questions: Q1, since: NOW - 60e3, until: NOW + 240e3 } }));
    assert.match(gate, /data-block="m-gate-inline"/);
    assert.match(gate, /id="gate-card"/);
    assert.doesNotMatch(gate, /data-block="m-composer-a"/);
});

test('idle has no composer and names /fankeel-phone; background lists every item and needs no reply', () => {
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    const idle = P.screen(HOME, R, NOW, APP, sess('idle'));
    assert.doesNotMatch(idle, /id="cmp-box"/);
    assert.match(idle, /\/fankeel-phone/);
    const bg = P.screen(HOME, R, NOW, APP, sess('background', { background: BG }));
    assert.equal(count(bg, /class="bgp-i/g), 3);
    assert.match(bg, /不用回覆/);
    assert.match(bg, /data-act="attach"/);
});

test('steps group into one line when the turn is over, and show the last three while it runs', () => {
    const chat = [{ role: 'phone', text: 'go', at: NOW - 9e3 }];
    for (let i = 0; i < 5; i++) chat.push({ role: 'tool', id: 't' + i, tool: i === 1 ? 'Edit' : 'Bash', label: 'step ' + i, at: NOW - 8e3 + i }, { role: 'tool-end', id: 't' + i, ok: i !== 2, at: NOW - 7e3 + i });
    const turns = P.turnsOf(chat);
    assert.equal(turns.filter((x) => x.kind === 'steps').length, 1);
    assert.match(P.stepsLine(turns[1].items), /^5 個步驟 · 改了 1 個檔 · 1 個失敗$/);
    const ran = P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, APP, sess('running', { chat: chat.concat([{ role: 'tool', id: 't9', tool: 'Bash', label: 'last', at: NOW - 1e3 }]) }));
    assert.match(ran, /正在：last/);
    assert.match(ran, /data-block="m-tools"/);
    assert.equal(P.dur(4200), '4.2 秒');
    assert.equal(P.dur(42e3), '42 秒');
    assert.equal(P.dur(125e3), '2 分 5 秒');
});

test('the composer: a waiting message disables it; the mic is drawn only with a Speech API', () => {
    const R = P.parseRoute('#/s/aaaaaaaa-5');
    const held = sess('holding', { attached: true });
    assert.doesNotMatch(P.screen(HOME, R, NOW, Object.assign({ mic: false }, APP), held), /class="mic"/);
    assert.match(P.screen(HOME, R, NOW, Object.assign({ mic: true }, APP), held), /data-mic="cmp-box"/);
    const waiting = P.screen(HOME, R, NOW, APP, Object.assign({}, held, { waiting: { text: '等等', at: NOW } }));
    assert.match(waiting, /<textarea[^>]*id="cmp-box"[^>]*disabled/);
    assert.match(waiting, /等這回合跑完就送進去/);
});

test('codeIn reads a code off the pairing url a QR carries, or one typed', () => {
    assert.equal(P.codeIn('https://ymlab-pc.tail1234.ts.net/m#/pair/ABCD2345'), 'ABCD2345');
    assert.equal(P.codeIn(' abcd2345 '), 'ABCD2345');
    assert.equal(P.codeIn('https://x/m#/pair/ABCD23456'), null, 'nine is not eight');
    assert.equal(P.codeIn('hello'), null);
    assert.equal(P.codeIn(null), null);
});

test('answersOf is pgAnswers\' rule, and null while any question has no answer', () => {
    assert.deepEqual(P.answersOf(Q2, { 0: ['__other'], 1: ['gate', '__other'] }, { 0: '  換個做法 ', 1: 'docs' }),
        { [Q2[0].question]: '換個做法', [Q2[1].question]: 'gate, docs' });
    assert.deepEqual(P.answersOf(Q2, { 0: ['改 mockup'], 1: ['gate', 'tune'] }, {}), { [Q2[0].question]: '改 mockup', [Q2[1].question]: 'gate, tune' });
    assert.equal(P.answersOf(Q2, { 0: ['改 mockup'], 1: ['__other'] }, { 1: '   ' }), null, 'a 自己寫 with nothing typed is no answer');
    assert.equal(P.answersOf(Q2, { 0: ['改 mockup'] }, {}), null);
    assert.equal(P.answersOf([], {}, {}), null);
});

test('collect reads the sheet\'s inputs: the picks per question, and the typed text only where its box is ticked', () => {
    const input = (name, value, checked) => ({ name, value, checked, getAttribute: () => null });
    const own = (qi, value) => ({ name: '', value, checked: false, getAttribute: (a) => (a === 'data-own' ? String(qi) : null) });
    const got = P.collect([input('q0', '改 mockup', false), input('q0', '__other', true), own(0, '換個做法'),
        input('q1', 'gate', true), input('q1', 'tune', false), input('q1', '__other', false), own(1, 'not ticked')], 2);
    assert.deepEqual(got, { picks: { 0: ['__other'], 1: ['gate'] }, others: { 0: '換個做法' } });
});

test('pair-scan: the viewfinder where a camera can scan, the typed code otherwise; pair-error names the machine', () => {
    const cam = P.screen(null, P.parseRoute(''), NOW, { mode: 'pair', camera: true });
    assert.match(cam, /data-block="pair-scan"/);
    assert.match(cam, /<div class="vf" role="img"/);
    assert.match(cam, /data-act="manual"/);
    assert.doesNotMatch(cam, /data-pair-form/);
    assert.doesNotMatch(cam, /data-block="tabbar"/);
    const typed = P.screen(null, P.parseRoute(''), NOW, { mode: 'pair', camera: false, say: 'wrong pairing code <b>' });
    assert.match(typed, /data-pair-form="1"/);
    assert.match(typed, /<input class="code" name="code"/);
    assert.doesNotMatch(typed, /class="vf"/);
    assert.match(typed, /<p class="say" role="status">wrong pairing code &lt;b&gt;<\/p>/);
    const off = P.screen(null, P.parseRoute(''), NOW, { mode: 'off', host: 'ymlab-pc' });
    assert.match(off, /data-block="pair-error"/);
    assert.match(off, /<h2>連不到 ymlab-pc<\/h2>/);
    assert.match(off, /data-act="retry"/);
    assert.match(off, /data-act="repair"/);
    assert.match(P.screen(null, null, NOW, { mode: 'off' }), /<h2>連不到 測站<\/h2>/);
});

const GATE = { questions: Q1, since: NOW - 60e3, until: NOW + 240e3 };

test('every value from the registry is escaped', () => {
    const bad = '<img src=x onerror=alert(1)>';
    const home = Object.assign({}, HOME, {
        host: bad,
        gates: [Object.assign({}, HOME.gates[0], { task: bad, project: bad, questions: [{ question: bad, options: [{ label: bad, description: bad }] }] })],
        tasks: HOME.tasks.map((x) => Object.assign({}, x, { task: bad, project: bad, last: { role: 'desktop', text: bad, at: NOW } })),
        done: [{ id: 'dddd-4', root: '/w', task: bad, project: bad, stage: 'land', route: [], kind: 'end', at: NOW - 20 * 60e3, usd: 1, stages: 6 }],
    });
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    const chat = [{ role: 'phone', text: bad, at: NOW - 3e3 }, { role: 'assistant', text: bad, at: NOW - 1e3 }];
    const screens = [
        P.screen(home, P.parseRoute('#/'), NOW, APP),
        P.screen(home, P.parseRoute('#/done'), NOW, APP),
        P.screen(home, R, NOW, APP, sess('holding', { task: bad, attached: true, chat, waiting: { text: bad, at: NOW } })),
        P.screen(home, R, NOW, APP, sess('background', { background: [Object.assign({}, BG[0], { description: bad })] })),
        P.screen(home, R, NOW, APP, sess('gate', { gate: Object.assign({}, GATE, { questions: home.gates[0].questions }) })),
    ];
    for (const html of screens) {
        assert.ok(!html.includes('<img'), html.slice(0, 160));
        assert.ok(html.includes('&lt;img'), html.slice(0, 160));
    }
});

test('English: the same keys in both tables, and no CJK left on home, a chat in each state, or the pair screens', () => {
    assert.deepEqual(Object.keys(P.STR.en).sort(), Object.keys(P.STR.zh).sort());
    for (const [k, v] of Object.entries(P.STR.en)) assert.ok(!CJK.test(v), k + ' is not English: ' + v);
    const ascii = (o) => JSON.parse(JSON.stringify(o).replace(/[^\x00-\x7f]+/g, 'x'));
    const home = ascii(HOME);
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    P.setLang('en');
    try {
        const screens = [
            P.screen(home, P.parseRoute('#/'), NOW, APP),
            P.screen(home, P.parseRoute('#/done'), NOW, APP),
            ...['idle', 'running', 'background', 'holding'].map((s) => P.screen(home, R, NOW, Object.assign({ mic: true }, APP), ascii(sess(s, { attached: s === 'holding', background: BG })))),
            P.screen(home, R, NOW, APP, ascii(sess('gate', { gate: Object.assign({}, GATE, { questions: Q2 }) }))),
            P.screen(null, null, NOW, { mode: 'pair', camera: true }),
            P.screen(null, null, NOW, { mode: 'pair', camera: false, say: 'x' }),
            P.screen(null, null, NOW, { mode: 'off', host: 'ymlab-pc' }),
        ];
        for (const html of screens) assert.equal(CJK.exec(html), null, html.slice(0, 160));
        assert.match(screens[6], /Send answer/);
    } finally {
        P.setLang('zh');
    }
});

test('every class the page draws has a rule, the real page\'s overrides stay, and the old sheet and tab bar are gone', () => {
    const css = read('mobile.css') + read('station.css');
    const STATION = new Set(['dot', 'live', 'hm-stw', 'route', 'now', 'todo', 'pill', 'gate', 'gq-rec', 'glyph', 'gseg', 'done', 'gedge', 'gcore']);
    const R = P.parseRoute('#/s/aaaaaaaa-2');
    const all = [P.screen(HOME, P.parseRoute('#/'), NOW, APP)]
        .concat(['idle', 'running', 'background', 'holding'].map((s) => P.screen(HOME, R, NOW, Object.assign({ mic: true }, APP), sess(s, { attached: s === 'holding', background: BG }))))
        .concat([P.screen(HOME, R, NOW, Object.assign({ mic: true }, APP), sess('gate', { gate: Object.assign({}, GATE, { questions: Q2 }) })),
            P.screen(null, null, NOW, { mode: 'pair', camera: true }), P.screen(null, null, NOW, { mode: 'pair', camera: false, say: 'x' }), P.screen(null, null, NOW, { mode: 'off' })]);
    for (const html of all) {
        for (const m of html.matchAll(/class="([^"]+)"/g)) {
            for (const c of m[1].split(/\s+/)) if (!STATION.has(c)) assert.ok(new RegExp('\\.' + c + '(?![\\w-])').test(css), c);
        }
    }
    const mcss = read('mobile.css');
    assert.ok(mcss.includes('body.m{min-width:0'), 'station.css holds every page at 1000 px');
    assert.match(mcss, /@media \(min-width:601px\)\{/);
    assert.ok(mcss.includes('.vf video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'));
    assert.ok(mcss.includes('.opt .own{'), 'the 自己寫 box is not hidden like the radios');
    assert.match(mcss, /@media \(prefers-reduced-motion:reduce\)\{/);
    assert.doesNotMatch(mcss, /\.gest|\.mk|\.phone\{|\.cbar|\.shade|\.nt-|\.rm-|\.m-switch|\.tabbar|\.sheet/);
});

// The page in a context of its own: a document with #app, a fake fetch, and
// the listeners it adds kept so a test can fire the real events at them.
const SRC = read('mobile.js');
function boot(o) {
    const app = { innerHTML: '' };
    const calls = [];
    const store = Object.assign({}, o.store);
    const on = { doc: {}, win: {} };
    const listen = (where) => (type, fn) => { (on[where][type] = on[where][type] || []).push(fn); };
    const doc = {
        getElementById: (id) => (id === 'app' ? app : null), documentElement: {}, body: { insertAdjacentHTML() {} },
        addEventListener: listen('doc'), querySelector: () => null, visibilityState: 'visible',
    };
    const win = Object.assign({
        document: doc, location: { hash: o.hash || '' },
        navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36' },
        localStorage: { getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
        addEventListener: listen('win'), setInterval() {}, setTimeout, URLSearchParams,
        fetch: (url, init) => { calls.push({ url, init: init || {} }); return o.fetch(url, init || {}); },
    }, o.win);
    vm.runInNewContext(SRC, { window: win });
    const fire = (where, type, e) => { (on[where][type] || []).forEach((fn) => fn(e)); return e; };
    const reads = () => calls.filter((c) => c.url === '/station/mobile.json').length;
    return { app, calls, store, win, doc, reads, fire: (type, e) => fire('doc', type, e || {}), fireWin: (type, e) => fire('win', type, e || {}) };
}
// The gate card as answer() reads it: data-id, its .gc-st line, its .cta button, its inputs.
function cardForm(id, inputs) {
    const say = { textContent: '' };
    const btn = { disabled: false };
    return {
        id: 'gate-card', say, btn,
        getAttribute: (a) => (a === 'data-id' ? id : null),
        querySelector: (s) => (s === '.gc-st' ? say : s === '.cta' ? btn : null),
        querySelectorAll: () => inputs,
    };
}
// The composer as its submit reads it: the one textarea.
const composerForm = (text) => ({ id: 'composer', getAttribute: () => null, querySelector: (s) => (s === 'textarea' ? { value: text } : null) });
const pick = (name, value, checked) => ({ name, value, checked, getAttribute: () => null });
const ownBox = (qi, value) => ({ name: '', value, checked: false, getAttribute: (a) => (a === 'data-own' ? String(qi) : null) });
const pairForm = (value) => ({ id: '', getAttribute: (a) => (a === 'data-pair-form' ? '1' : null), querySelector: () => ({ value }) });
const submit = (target) => ({ target, prevented: false, preventDefault() { this.prevented = true; } });
const tap = (attrs) => {
    const el = { getAttribute: (a) => (Object.prototype.hasOwnProperty.call(attrs, a) ? attrs[a] : null) };
    el.closest = () => el;
    return { target: el };
};
const reply = (status, body) => Promise.resolve({
    status, ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
});
const settle = () => new Promise((r) => setTimeout(r, 30));

const PHONE = '/station/phone.json?id=';
// mobile.json is HOME, phone.json is `one`, and every POST is a 201.
const routed = (one) => (url) => (url === '/station/mobile.json' ? reply(200, HOME) : url.startsWith(PHONE) ? reply(200, one) : reply(201, ''));
const callsTo = (page, url) => page.calls.filter((c) => c.url === url);

test('boot: an unpaired phone sees pair-scan, a paired one the session list, an unreachable station pair-error', async () => {
    const unpaired = boot({ fetch: () => reply(401, 'pair this phone first') });
    await settle();
    assert.equal(unpaired.calls[0].url, '/station/mobile.json');
    assert.match(unpaired.app.innerHTML, /data-block="pair-scan"/);
    assert.match(unpaired.app.innerHTML, /data-pair-form="1"/, 'no BarcodeDetector here: the typed code');
    const paired = boot({ fetch: () => reply(200, HOME) });
    await settle();
    assert.match(paired.app.innerHTML, /data-block="m-home-a"/);
    assert.equal(paired.store['station.m.host'], 'my-pc');
    assert.equal(paired.win.FK_M.parseRoute('#/done').view, 'done');
    const away = boot({ store: { 'station.m.host': 'ymlab-pc' }, fetch: () => Promise.reject(new Error('offline')) });
    await settle();
    assert.match(away.app.innerHTML, /data-block="pair-error"/);
    assert.match(away.app.innerHTML, /連不到 ymlab-pc/);
});

test('boot: a pairing url opened on an unpaired phone pairs with its code, then shows the session list', async () => {
    let reads = 0;
    const page = boot({
        hash: '#/pair/ABCD2345',
        fetch: (url) => {
            if (url === '/station/remote/pair') return reply(201, { device: { id: '0123456789abcdef', name: 'Android' } });
            reads += 1;
            return reads === 1 ? reply(401, 'pair this phone first') : reply(200, HOME);
        },
    });
    await settle();
    const pair = page.calls.find((c) => c.url === '/station/remote/pair');
    assert.ok(pair, 'no pairing POST');
    assert.equal(pair.init.body, 'code=ABCD2345&name=Android');
    assert.equal(page.win.location.hash, '#/');
    assert.match(page.app.innerHTML, /data-block="m-home-a"/);
});

test('boot: a hash change to #/s/<id> reads that session\'s phone.json and draws its screen', async () => {
    const page = boot({ hash: '#/', fetch: routed(sess('running')) });
    await settle();
    page.win.location.hash = '#/s/aaaaaaaa-2';
    page.fireWin('hashchange');
    await settle();
    assert.ok(page.calls.some((c) => c.url === PHONE + 'aaaaaaaa-2'));
    assert.match(page.app.innerHTML, /data-block="m-attach"/);
});

test('boot: the composer posts /phone/say, and its 201 reads phone.json again', async () => {
    const page = boot({ hash: '#/s/aaaaaaaa-5', fetch: routed(sess('holding', { id: 'aaaaaaaa-5', attached: true })) });
    await settle();
    const before = callsTo(page, PHONE + 'aaaaaaaa-5').length;
    const e = page.fire('submit', submit(composerForm('跑測試')));
    assert.equal(e.prevented, true);
    await settle();
    const sent = callsTo(page, '/phone/say');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.method, 'POST');
    assert.equal(sent[0].init.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/w', id: 'aaaaaaaa-5', text: '跑測試' }).toString());
    assert.ok(callsTo(page, PHONE + 'aaaaaaaa-5').length > before);
});

test('boot: a /phone/say refusal keeps the draft in the composer and says why', async () => {
    const one = sess('holding', { id: 'aaaaaaaa-5', attached: true });
    const ok = routed(one);
    const page = boot({ hash: '#/s/aaaaaaaa-5', fetch: (url) => (url === '/phone/say' ? reply(409, 'not attached') : ok(url)) });
    await settle();
    page.fire('submit', submit(composerForm('跑測試')));
    await settle();
    assert.equal(callsTo(page, '/phone/say').length, 1);
    assert.match(page.app.innerHTML, /<textarea[^>]*id="cmp-box"[^>]*>跑測試<\/textarea>/);
    assert.ok(page.app.innerHTML.includes('<p class="note" role="status">測站沒收下（409）：not attached</p>'));
});

test('boot: 接上這個 session posts /phone/attach with the session\'s root and id', async () => {
    const page = boot({ hash: '#/s/aaaaaaaa-2', fetch: routed(sess('running')) });
    await settle();
    page.fire('click', tap({ 'data-act': 'attach' }));
    await settle();
    const sent = callsTo(page, '/phone/attach');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/w', id: 'aaaaaaaa-2' }).toString());
});

test('boot: the gate card\'s 送出答案 posts answersOf\'s JSON to /answer', async () => {
    const page = boot({ hash: '#/s/aaaaaaaa-1', fetch: routed(sess('gate', { id: 'aaaaaaaa-1', gate: GATE })) });
    await settle();
    const f = cardForm('aaaaaaaa-1', [pick('q0', '改 mockup', true), pick('q0', '__other', false), ownBox(0, 'ignored')]);
    const e = page.fire('submit', submit(f));
    assert.equal(e.prevented, true);
    await settle();
    const sent = callsTo(page, '/answer');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/w', id: 'aaaaaaaa-1', answers: JSON.stringify({ [Q1[0].question]: '改 mockup' }) }).toString());
});

test('boot: retry reads again, repair and manual show pair-scan', async () => {
    let up = false;
    const page = boot({ store: { 'station.m.host': 'ymlab-pc' }, fetch: () => (up ? reply(200, HOME) : Promise.reject(new Error('offline'))) });
    await settle();
    assert.match(page.app.innerHTML, /data-block="pair-error"/);
    up = true;
    page.fire('click', tap({ 'data-act': 'retry' }));
    await settle();
    assert.equal(page.reads(), 2);
    assert.match(page.app.innerHTML, /data-block="m-home-a"/);
    page.fire('click', tap({ 'data-act': 'repair' }));
    assert.match(page.app.innerHTML, /data-block="pair-scan"/);
    page.app.innerHTML = '';
    page.fire('click', tap({ 'data-act': 'manual' }));
    assert.match(page.app.innerHTML, /data-pair-form="1"/);
});

test('boot: coming back into view reads the session list again', async () => {
    const page = boot({ hash: '#/', fetch: () => reply(200, HOME) });
    await settle();
    page.doc.visibilityState = 'hidden';
    page.fire('visibilitychange');
    assert.equal(page.reads(), 1);
    page.doc.visibilityState = 'visible';
    page.fire('visibilitychange');
    await settle();
    assert.equal(page.reads(), 2);
});

test('boot: a screen that fails to draw is thrown, not shown as a station out of reach', async () => {
    const thrown = [];
    const page = boot({ fetch: () => reply(200, { host: 'ymlab-pc', gates: [], tasks: { length: 1 } }), win: { setTimeout: (fn) => { thrown.push(fn); } } });
    await settle();
    assert.doesNotMatch(page.app.innerHTML, /pair-error/);
    assert.equal(thrown.length, 1);
    assert.throws(thrown[0], { name: 'TypeError' }, 'the page runs in its own realm, so its TypeError is not this one');
});

test('boot: the typed code pairs, a bad one says what a code is, a refusal and a lost station say so', async () => {
    let answer;
    const page = boot({ fetch: (url) => (url === '/station/remote/pair' ? answer() : reply(401, 'pair this phone first')) });
    await settle();
    page.fire('submit', submit(pairForm('nope')));
    assert.match(page.app.innerHTML, /<p class="say" role="status">配對碼是 8 個英文字母或數字<\/p>/);
    let release;
    answer = () => new Promise((r) => { release = r; });
    const e = page.fire('submit', submit(pairForm(' abcd2345 ')));
    assert.equal(e.prevented, true);
    assert.match(page.app.innerHTML, /配對中…/);
    assert.equal(page.calls.find((c) => c.url === '/station/remote/pair').init.body, 'code=ABCD2345&name=Android');
    release(reply(403, 'wrong pairing code'));
    await settle();
    assert.match(page.app.innerHTML, /配對沒成功（403）：wrong pairing code/);
    answer = () => Promise.reject(new Error('offline'));
    page.fire('submit', submit(pairForm('ABCD2345')));
    await settle();
    assert.match(page.app.innerHTML, /連不到測站：再試一次/);
});

test('boot: typing in a 自己寫 box ticks its own __other', async () => {
    const page = boot({ fetch: () => reply(200, HOME) });
    await settle();
    for (const type of ['input', 'focusin']) {
        const other = { checked: false };
        const label = { querySelector: (s) => (s === 'input[value="__other"]' ? other : null) };
        page.fire(type, { target: { getAttribute: (a) => (a === 'data-own' ? '0' : null), closest: () => label } });
        assert.equal(other.checked, true, type);
    }
});

// boot() with the page's polls kept by interval, so a test runs one when it
// likes, and every assignment to #app counted as a draw.
function polled(o) {
    const ticks = {};
    const page = boot(Object.assign({}, o, { win: Object.assign({ setInterval: (fn, ms) => { ticks[ms] = fn; } }, o.win) }));
    let draws = 0;
    let html = '';
    Object.defineProperty(page.app, 'innerHTML', { get: () => html, set: (v) => { draws += 1; html = v; } });
    return Object.assign(page, { tick: (ms) => ticks[ms](), draws: () => draws });
}
const CHAT_MS = 2000;

test('boot: a second gate for the same session is answered with phone.json\'s questions, not the session list\'s', async () => {
    const Q3 = [{ question: '第二道 gate：要合併嗎？', header: 'build', multiSelect: false, options: [{ label: '合併', description: '' }] }];
    const page = boot({ hash: '#/s/aaaaaaaa-1', fetch: routed(sess('gate', { id: 'aaaaaaaa-1', gate: Object.assign({}, GATE, { questions: Q3, until: NOW + 600e3 }) })) });
    await settle();
    page.fire('submit', submit(cardForm('aaaaaaaa-1', [pick('q0', '合併', true)])));
    await settle();
    const sent = callsTo(page, '/answer');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/w', id: 'aaaaaaaa-1', answers: JSON.stringify({ [Q3[0].question]: '合併' }) }).toString());
});

test('boot: going back from a conversation to #/ reads the session list again', async () => {
    let home = HOME;
    const page = boot({ hash: '#/s/aaaaaaaa-1', fetch: (url) => (url === '/station/mobile.json' ? reply(200, home) : url.startsWith(PHONE) ? reply(200, sess('gate', { id: 'aaaaaaaa-1', gate: GATE })) : reply(201, '')) });
    await settle();
    assert.equal(page.reads(), 1);
    home = Object.assign({}, HOME, { gates: [], tasks: HOME.tasks.map((x) => (x.state === 'gate' ? Object.assign({}, x, { state: 'running', gate: false }) : x)) });
    page.win.location.hash = '#/';
    page.fireWin('hashchange');
    await settle();
    assert.equal(page.reads(), 2);
    assert.match(page.app.innerHTML, /data-block="m-home-a"/);
    assert.doesNotMatch(page.app.innerHTML, /class="st ask"/, 'the gate just answered is not 等你答 any more');
});

test('boot: a session whose phone.json is a 404 is drawn once, not on every read', async () => {
    const page = polled({ hash: '#/s/aaaaaaaa-5', fetch: (url) => (url === '/station/mobile.json' ? reply(200, HOME) : reply(404, 'no such session')) });
    await settle();
    assert.equal(page.draws(), 1);
    page.tick(CHAT_MS);
    await settle();
    page.tick(CHAT_MS);
    await settle();
    assert.equal(callsTo(page, PHONE + 'aaaaaaaa-5').length, 3);
    assert.equal(page.draws(), 1, 'a redraw every two seconds takes the composer\'s focus');
});

test('boot: an unchanged read draws nothing, a new reply patches only .cv, and the same gate keeps its card', async () => {
    let one = sess('holding', { id: 'aaaaaaaa-5', attached: true, chat: [{ role: 'assistant', text: '第一句', at: NOW - 5e3 }] });
    const page = polled({ hash: '#/s/aaaaaaaa-5', fetch: (url) => (url === '/station/mobile.json' ? reply(200, HOME) : url.startsWith(PHONE) ? reply(200, Object.assign({}, one, { at: Date.now() })) : reply(201, '')) });
    await settle();
    assert.equal(page.draws(), 1);
    page.tick(CHAT_MS);
    await settle();
    assert.equal(page.draws(), 1, 'the same JSON but its read time draws nothing');
    const cv = { innerHTML: '', scrollHeight: 0, scrollTop: 0, clientHeight: 0 };
    page.doc.querySelector = (s) => (s === '.cv' ? cv : null);
    one = Object.assign({}, one, { chat: one.chat.concat([{ role: 'assistant', text: '第二句', at: NOW }]) });
    page.tick(CHAT_MS);
    await settle();
    assert.equal(page.draws(), 1, 'a reply in the same state is not a whole redraw');
    assert.match(cv.innerHTML, /第二句/);
    one = sess('gate', { id: 'aaaaaaaa-5', gate: GATE });
    page.tick(CHAT_MS);
    await settle();
    assert.equal(page.draws(), 2, 'a new state draws the whole screen');
    cv.innerHTML = '';
    one = Object.assign({}, one, { chat: [{ role: 'assistant', text: '第三句', at: NOW }] });
    page.tick(CHAT_MS);
    await settle();
    assert.equal(page.draws(), 2, 'the gate card of the same until is not redrawn');
    assert.equal(cv.innerHTML, '', 'nor is the conversation around it');
});

// A Web Speech recogniser the test drives: every instance the page made.
function speech() {
    const made = [];
    function SR() { this.started = false; made.push(this); }
    SR.prototype.start = function () { this.started = true; };
    SR.prototype.stop = function () { if (this.onend) this.onend(); };
    return { SR, made };
}
const classes = () => {
    const on = new Set();
    return { on, add: (c) => on.add(c), remove: (c) => on.delete(c), toggle: (c, v) => (v ? on.add(c) : on.delete(c)) };
};

test('boot: the mic fills the composer as it hears, wakes the send button, and says why it stopped', async () => {
    const sp = speech();
    function Event(type, init) { this.type = type; this.bubbles = Boolean(init && init.bubbles); }
    const page = boot({ hash: '#/s/aaaaaaaa-5', fetch: routed(sess('holding', { id: 'aaaaaaaa-5', attached: true })), win: { SpeechRecognition: sp.SR, Event } });
    await settle();
    assert.match(page.app.innerHTML, /data-mic="cmp-box"/);
    const line = { textContent: '' };
    const send = { disabled: true };
    const form = { querySelector: (s) => (s === '[data-say]' ? line : null) };
    const box = {
        id: 'cmp-box', value: '', classList: classes(), getAttribute: () => null, dispatched: [],
        dispatchEvent(e) { this.dispatched.push(e); page.fire(e.type, { type: e.type, target: box }); },
    };
    page.doc.getElementById = (id) => (id === 'cmp-box' ? box : id === 'app' ? page.app : null);
    page.doc.querySelector = (s) => (s === '#composer .send' ? send : null);
    const btn = { classList: classes(), getAttribute: (a) => (a === 'data-mic' ? 'cmp-box' : null), closest: (s) => (s === 'form' ? form : s === '[data-act],[data-mic]' ? btn : null) };
    page.fire('click', { target: btn });
    const rec = sp.made[0];
    assert.equal(rec.started, true);
    assert.equal(rec.lang, 'zh-TW');
    assert.ok(btn.classList.on.has('on'));
    assert.equal(line.textContent, '聆聽中… 再按一次停止');
    rec.onresult({ results: [Object.assign([{ transcript: '跑' }], { isFinal: true }), Object.assign([{ transcript: '測試' }], { isFinal: false })] });
    assert.equal(box.value, '跑測試');
    assert.ok(box.classList.on.has('interim'));
    assert.deepEqual(box.dispatched.map((e) => [e.type, e.bubbles]), [['input', true]]);
    assert.equal(send.disabled, false, 'the input listener saw the heard text');
    rec.onerror({ error: 'not-allowed' });
    rec.onend();
    assert.ok(!btn.classList.on.has('on'));
    assert.match(line.textContent, /^沒有麥克風權限/, 'the end of a refused mic keeps saying why');
    page.fire('click', { target: btn });
    assert.equal(sp.made.length, 2, 'a mic that ended starts again');
    sp.made[1].onerror({ error: 'no-speech' });
    assert.match(line.textContent, /^沒聽清楚/);
});

test('boot: 交還電腦 posts /phone/detach with the session\'s root and id', async () => {
    const page = boot({ hash: '#/s/aaaaaaaa-5', fetch: routed(sess('holding', { id: 'aaaaaaaa-5', attached: true })) });
    await settle();
    assert.match(page.app.innerHTML, /data-act="detach"/);
    page.fire('click', tap({ 'data-act': 'detach' }));
    await settle();
    const sent = callsTo(page, '/phone/detach');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/w', id: 'aaaaaaaa-5' }).toString());
});

// The station answers /phone/detach 200, not 201 (scripts/station.js).
test('boot: a 200 from /phone/detach reads phone.json again and shows no refusal', async () => {
    const one = sess('holding', { id: 'aaaaaaaa-5', attached: true });
    const page = boot({ hash: '#/s/aaaaaaaa-5', fetch: (url) => (url === '/phone/detach' ? reply(200, 'detached\n') : routed(one)(url)) });
    await settle();
    const before = callsTo(page, PHONE + 'aaaaaaaa-5').length;
    page.fire('click', tap({ 'data-act': 'detach' }));
    await settle();
    assert.equal(callsTo(page, '/phone/detach').length, 1);
    assert.ok(callsTo(page, PHONE + 'aaaaaaaa-5').length > before, 'the page reads phone.json again');
    assert.doesNotMatch(page.app.innerHTML, /測站沒收下/);
});

test('boot: tapping a finished turn\'s steps line opens its rows, and a second tap closes them', async () => {
    const chat = [{ role: 'phone', text: 'go', at: NOW - 9e3 }, { role: 'tool', id: 't0', tool: 'Bash', label: 'npm test', at: NOW - 8e3 },
        { role: 'tool-end', id: 't0', ok: true, at: NOW - 7e3 }, { role: 'assistant', text: '好了', at: NOW - 6e3 }];
    const page = boot({ hash: '#/s/aaaaaaaa-5', fetch: routed(sess('holding', { id: 'aaaaaaaa-5', attached: true, chat })) });
    await settle();
    assert.match(page.app.innerHTML, /data-key="t0" aria-expanded="false"/);
    assert.doesNotMatch(page.app.innerHTML, /class="tl-list"/);
    page.fire('click', tap({ 'data-act': 'steps', 'data-key': 't0' }));
    assert.match(page.app.innerHTML, /data-key="t0" aria-expanded="true"/);
    assert.match(page.app.innerHTML, /class="tl-list"/);
    page.fire('click', tap({ 'data-act': 'steps', 'data-key': 't0' }));
    assert.match(page.app.innerHTML, /data-key="t0" aria-expanded="false"/);
});

// The service worker against fake caches and a fetch that can go offline.
function worker(fetchImpl) {
    const on = {};
    const cache = new Map();
    const deleted = [];
    const caches = {
        open: () => Promise.resolve({
            addAll: (files) => { files.forEach((f) => cache.set(f, 'cached ' + f)); return Promise.resolve(); },
            put: (k, v) => { cache.set(k, v); return Promise.resolve(); },
        }),
        keys: () => Promise.resolve(['fankeel-m-0', 'fankeel-m-1', 'someone-else']),
        delete: (k) => { deleted.push(k); return Promise.resolve(true); },
        match: (k) => Promise.resolve(cache.get(k)),
    };
    const self = { addEventListener: (type, fn) => { on[type] = fn; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() }, location: { origin: ORIGIN } };
    vm.runInNewContext(read('sw.js'), { self, caches, fetch: fetchImpl, URL, Response: { error: () => 'network error' } });
    return { on, cache, deleted };
}
const ORIGIN = 'https://ymlab-pc.tail1234.ts.net';
const event = (url, method) => {
    const e = { request: { method: method || 'GET', url }, p: undefined, respondWith(p) { e.p = p; } };
    return e;
};

test('sw.js caches the shell at install, serves it network-first, and leaves everything else alone', async () => {
    const live = { ok: true, clone() { return 'copy'; } };
    let up = true;
    const w = worker(() => (up ? Promise.resolve(live) : Promise.reject(new Error('offline'))));
    let waited;
    w.on.install({ waitUntil: (p) => { waited = p; } });
    await waited;
    assert.deepEqual([...w.cache.keys()].sort(), ['/m', '/m/icon.svg', '/m/manifest.webmanifest', '/station/mobile.css', '/station/mobile.js', '/station/station.css']);
    w.on.activate({ waitUntil: (p) => { waited = p; } });
    await waited;
    assert.deepEqual(w.deleted, ['fankeel-m-0'], 'an older cache of its own goes; this one and others stay');
    const fresh = event(ORIGIN + '/m');
    w.on.fetch(fresh);
    assert.equal(await fresh.p, live, 'network first');
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(w.cache.get('/m'), 'copy', 'and the copy kept');
    up = false;
    const offline = event(ORIGIN + '/station/mobile.js');
    w.on.fetch(offline);
    assert.equal(await offline.p, 'cached /station/mobile.js', 'the cached shell when the station cannot be reached');
    for (const e of [event(ORIGIN + '/station/mobile.json'), event(ORIGIN + '/station/talk/x'), event(ORIGIN + '/answer', 'POST'), event('https://ntfy.sh/m')]) {
        w.on.fetch(e);
        assert.equal(e.p, undefined, e.request.url + ' was intercepted');
    }
});

test('home: a subscribe button opens the ntfy app, with the web topic beside it, only when notify is set', () => {
    const sub = Object.assign({}, HOME, { notify: { app: 'ntfy://ntfy.sh/fankeel-test', web: 'https://ntfy.sh/fankeel-test' } });
    const html = P.screen(sub, P.parseRoute('#/'), NOW, APP);
    assert.match(html, /<a class="ha-subscribe" href="ntfy:\/\/ntfy\.sh\/fankeel-test">/);
    assert.match(html, /href="https:\/\/ntfy\.sh\/fankeel-test"/);
    assert.doesNotMatch(P.screen(HOME, P.parseRoute('#/'), NOW, APP), /ha-subscribe/);
});