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
const M = {
    host: 'ymlab-pc', at: NOW,
    gates: [
        { id: 'aaaa-1', root: '/ws/fankeel', task: 'station 遠端存取討論', project: 'fankeel', stage: 'design', route: ['survey', 'design', 'plan'], questions: Q1, since: NOW - 240e3, until: NOW + 60e3 },
        { id: 'bbbb-2', root: '/ws/fankeel', task: 'TODO 全表盤點', project: 'fankeel', stage: 'survey', route: ['survey', 'plan'], questions: Q2, since: NOW - 60e3, until: NOW + 60e3 },
    ],
    tasks: [
        { id: 'aaaa-1', root: '/ws/fankeel', task: 'station 遠端存取討論', project: 'fankeel', stage: 'design', route: ['survey', 'design', 'plan', 'build'], gate: true, updated: NOW - 240e3 },
        { id: 'cccc-3', root: '/ws/ils', task: 'FSC 下一輪', project: 'ils-bench', stage: 'build', route: ['survey', 'design', 'plan', 'build', 'verify'], gate: false, updated: NOW - 180e3 },
    ],
    done: [
        { id: 'dddd-4', root: '/ws/fankeel', task: 'TODO 全表盤點', project: 'fankeel', stage: 'land', route: [], kind: 'end', at: NOW - 20 * 60e3, usd: 79.71, stages: 6 },
        { id: 'dddd-4', root: '/ws/fankeel', task: 'TODO 全表盤點', project: 'fankeel', stage: 'land', route: [], kind: 'stage', at: NOW - 49 * 60e3, usd: 2.58 },
        { id: 'eeee-5', root: '/ws/ils', task: 'fsc-14', project: 'ils-bench', stage: 'verify', route: [], kind: 'stage', at: NOW - 13 * 3600e3, usd: null },
    ],
};
const APP = { mode: 'app' };
const count = (html, re) => (html.match(re) || []).length;

test('the hash names the tab, an open gate, a task to find, or a pairing code', () => {
    const r = (tab, open, focus, pair) => ({ tab, open: open || null, focus: focus || null, pair: pair || null });
    assert.deepEqual(P.parseRoute(''), r('gates'));
    assert.deepEqual(P.parseRoute('#/gates'), r('gates'));
    assert.deepEqual(P.parseRoute('#/tasks'), r('tasks'));
    assert.deepEqual(P.parseRoute('#/done'), r('done'));
    assert.deepEqual(P.parseRoute('#/gate/aaaa-1'), r('gates', 'aaaa-1'));
    assert.deepEqual(P.parseRoute('#/task/cccc-3'), r('tasks', null, 'cccc-3'));
    assert.deepEqual(P.parseRoute('#/pair/abcd2345'), r('gates', null, null, 'ABCD2345'));
    assert.deepEqual(P.parseRoute('#/pair/short'), r('gates'));
    assert.deepEqual(P.parseRoute('#/gate/<x>'), r('gates'));
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

test('待答: one row per held gate, oldest first, the badge counting them, a long wait in the signal colour', () => {
    const html = P.screen(M, P.parseRoute('#/gates'), NOW, APP);
    assert.match(html, /data-block="tab-gates"/);
    assert.match(html, /data-block="tabbar"/);
    assert.deepEqual([...html.matchAll(/data-gate="([^"]+)"/g)].map((m) => m[1]), ['aaaa-1', 'bbbb-2']);
    assert.match(html, /<span class="bdg" aria-label="2 個在等">2<\/span>/);
    assert.match(html, /<a class="tb" href="#\/gates" aria-current="page">/);
    assert.match(html, /href="#\/gate\/aaaa-1"/);
    assert.match(html, /<span class="ago wait">4 分<\/span>/);
    assert.match(html, /<span class="ago">1 分<\/span>/);
    assert.match(html, /還有 1 題/, 'a second question is counted on its row');
    assert.match(html, /<h1>待答<\/h1><span class="n">2<\/span>/);
    assert.match(html, /<i class="dot live"><\/i>ymlab-pc/);
    assert.doesNotMatch(html, /data-block="gate-sheet"/);
});

test('with no gate held, 待答 is gates-empty and the badge is gone', () => {
    const html = P.screen(Object.assign({}, M, { gates: [] }), P.parseRoute('#/gates'), NOW, APP);
    assert.match(html, /data-block="gates-empty"/);
    assert.match(html, /沒有在等你的 gate/);
    assert.equal(count(html, /class="bdg"/g), 0);
    assert.equal(count(html, /data-gate=/g), 0);
});

test('the gate sheet: every question, the recommended option picked under its own label, a 自己寫答案 box, the report link', () => {
    const one = P.screen(M, P.parseRoute('#/gate/aaaa-1'), NOW, APP);
    assert.match(one, /<form class="sheet" id="gate-sheet" data-block="gate-sheet" data-id="aaaa-1"/);
    assert.match(one, /<div class="dim" data-close="1"/);
    assert.match(one, /<input type="radio" name="q0" value="核准，進 plan \(Recommended\)" checked>/);
    assert.match(one, /<span class="opt-l">核准，進 plan<span class="gq-rec">建議<\/span><\/span>/);
    assert.match(one, /<input type="radio" name="q0" value="改 mockup">/);
    assert.match(one, /<input type="radio" name="q0" value="__other">/);
    assert.match(one, /<input class="own" type="text" data-own="0"/);
    assert.match(one, /href="\/f\/aaaa-1\/gate">.*看 design 報告/);
    assert.match(one, /等了 4 分/);
    assert.match(one, /<p class="sh-say" role="status"><\/p><button type="submit" class="cta">送出答案<\/button>/);
    const two = P.screen(M, P.parseRoute('#/gate/bbbb-2'), NOW, APP);
    assert.equal(count(two, /<h2 class="sh-q"/g), 2);
    assert.match(two, /<input type="checkbox" name="q1" value="gate">/);
    assert.match(two, /<input type="checkbox" name="q1" value="__other">/);
    const held = P.screen(M, P.parseRoute('#/gate/aaaa-1'), NOW, { mode: 'app', picks: { 0: ['改 mockup'] } });
    assert.match(held, /value="改 mockup" checked>/);
    assert.doesNotMatch(held, /\(Recommended\)" checked/);
    assert.doesNotMatch(P.screen(M, P.parseRoute('#/gate/nobody'), NOW, APP), /gate-sheet/, 'a gate no longer held opens nothing');
});

test('任務: each running task with its route dots, its stage and a 待答 pill when a gate waits', () => {
    const html = P.screen(M, P.parseRoute('#/task/cccc-3'), NOW, APP);
    assert.match(html, /data-block="tab-tasks"/);
    assert.match(html, /<a class="tb" href="#\/tasks" aria-current="page">/);
    assert.equal(count(html, /<a class="row"/g), 2);
    assert.match(html, /href="\/f\/aaaa-1\/design"/);
    assert.match(html, /<i style="background:var\(--st-survey\)"><\/i><i class="now" style="--c:var\(--st-design\);background:var\(--c\)"><\/i><i class="todo"><\/i><i class="todo"><\/i>/);
    assert.equal(count(html, /class="pill gate"/g), 1);
    assert.match(html, /href="\/f\/cccc-3\/build" data-focus="1"/);
    assert.match(html, /<span class="bdg"[^>]*>2<\/span>/, 'the 待答 badge on every tab');
    assert.match(html, /<h1>任務<\/h1><span class="n">2<\/span>/);
});

test('完成: an ended task and a finished stage with their cost, today and yesterday apart', () => {
    const html = P.screen(M, P.parseRoute('#/done'), NOW, APP);
    assert.match(html, /data-block="tab-done"/);
    assert.match(html, /<div class="grp-h">今天<span>到 11:02<\/span><\/div>/);
    assert.match(html, /<div class="grp-h">昨天<\/div>/);
    assert.match(html, /<a class="row fin" href="\/f\/dddd-4\/land">.*任務結束.*<span class="usd">\$79\.71<\/span><span class="ago">10:42<\/span>/);
    assert.match(html, /完成 ·<\/span><span class="pj">fankeel<\/span>.*<span class="usd">\$2\.58<\/span><span class="ago">10:13<\/span>/);
    assert.match(html, /<span class="usd">—<\/span><span class="ago">22:02<\/span>/, 'nothing priced is a dash');
    assert.doesNotMatch(html, /<span class="n">/, '完成 carries no count');
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

test('every value from the registry is escaped', () => {
    const bad = '<img src=x onerror=alert(1)>';
    const m = {
        host: bad,
        gates: [Object.assign({}, M.gates[0], { task: bad, project: bad, questions: [{ question: bad, options: [{ label: bad, description: bad }] }] })],
        tasks: [Object.assign({}, M.tasks[0], { task: bad })],
        done: [Object.assign({}, M.done[0], { task: bad })],
    };
    for (const hash of ['#/gate/aaaa-1', '#/tasks', '#/done']) {
        const html = P.screen(m, P.parseRoute(hash), NOW, APP);
        assert.ok(!html.includes('<img'), hash);
        assert.ok(html.includes('&lt;img'), hash);
    }
});

test('English: the same keys in both tables, and no CJK left on any screen', () => {
    assert.deepEqual(Object.keys(P.STR.en).sort(), Object.keys(P.STR.zh).sort());
    for (const [k, v] of Object.entries(P.STR.en)) assert.ok(!CJK.test(v), k + ' is not English: ' + v);
    const ascii = JSON.parse(JSON.stringify(M).replace(/[^\x00-\x7f]+/g, 'x'));
    P.setLang('en');
    try {
        const screens = [
            P.screen(ascii, P.parseRoute('#/gate/bbbb-2'), NOW, APP),
            P.screen(ascii, P.parseRoute('#/tasks'), NOW, APP),
            P.screen(ascii, P.parseRoute('#/done'), NOW, APP),
            P.screen(Object.assign({}, ascii, { gates: [] }), P.parseRoute(''), NOW, APP),
            P.screen(null, null, NOW, { mode: 'pair', camera: true }),
            P.screen(null, null, NOW, { mode: 'pair', camera: false, say: 'x' }),
            P.screen(null, null, NOW, { mode: 'off', host: 'ymlab-pc' }),
        ];
        for (const html of screens) assert.equal(CJK.exec(html), null, html.slice(0, 160));
        assert.match(screens[0], /Send answer/);
    } finally {
        P.setLang('zh');
    }
});

test('mobile.css carries a rule for every class the screens draw, and the real page\'s overrides', () => {
    const css = read('mobile.css');
    // Drawn from station.css, which the shell loads first, as the mockup did.
    const STATION = new Set(['dot', 'live', 'hm-stw', 'route', 'now', 'todo', 'pill', 'gate', 'gq-rec', 'glyph', 'gseg', 'done', 'gedge', 'gcore']);
    const html = [
        P.screen(M, P.parseRoute('#/gate/bbbb-2'), NOW, APP), P.screen(M, P.parseRoute('#/task/cccc-3'), NOW, APP), P.screen(M, P.parseRoute('#/done'), NOW, APP),
        P.screen(Object.assign({}, M, { gates: [] }), null, NOW, APP), P.screen(null, null, NOW, { mode: 'pair', camera: true }),
        P.screen(null, null, NOW, { mode: 'pair', camera: false, say: 'x' }), P.screen(null, null, NOW, { mode: 'off' }),
    ].join('');
    const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
    for (const c of classes) {
        if (STATION.has(c)) continue;
        assert.match(css, new RegExp('\\.' + c + '(?![\\w-])'), '.' + c + ' has no rule in mobile.css');
    }
    assert.ok(css.includes('body.m{min-width:0'), 'station.css holds every page at 1000 px');
    assert.match(css, /@media \(min-width:601px\)\{/);
    assert.ok(css.includes('.vf video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'));
    assert.ok(css.includes('.opt .own{'), 'the 自己寫 box is not hidden like the radios');
    assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{/);
    assert.doesNotMatch(css, /\.gest|\.mk|\.phone\{|\.cbar|\.shade|\.nt-|\.rm-|\.m-switch/, 'the mockup\'s frame and the desktop card stay out');
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
// A gate sheet as answer() reads it: data-id, its .sh-say line, its .cta button, its inputs.
function sheetForm(id, inputs) {
    const say = { textContent: '' };
    const btn = { disabled: false };
    return {
        id: 'gate-sheet', say, btn,
        getAttribute: (a) => (a === 'data-id' ? id : null),
        querySelector: (s) => (s === '.sh-say' ? say : s === '.cta' ? btn : null),
        querySelectorAll: () => inputs,
    };
}
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

test('boot: an unpaired phone sees pair-scan, a paired one 待答, an unreachable station pair-error', async () => {
    const unpaired = boot({ fetch: () => reply(401, 'pair this phone first') });
    await settle();
    assert.equal(unpaired.calls[0].url, '/station/mobile.json');
    assert.match(unpaired.app.innerHTML, /data-block="pair-scan"/);
    assert.match(unpaired.app.innerHTML, /data-pair-form="1"/, 'no BarcodeDetector here: the typed code');
    const paired = boot({ fetch: () => reply(200, M) });
    await settle();
    assert.match(paired.app.innerHTML, /data-block="tab-gates"/);
    assert.equal(paired.store['station.m.host'], 'ymlab-pc');
    assert.equal(paired.win.FK_M.parseRoute('#/done').tab, 'done');
    const away = boot({ store: { 'station.m.host': 'ymlab-pc' }, fetch: () => Promise.reject(new Error('offline')) });
    await settle();
    assert.match(away.app.innerHTML, /data-block="pair-error"/);
    assert.match(away.app.innerHTML, /連不到 ymlab-pc/);
});

test('boot: a pairing url opened on an unpaired phone pairs with its code, then shows 待答', async () => {
    let reads = 0;
    const page = boot({
        hash: '#/pair/ABCD2345',
        fetch: (url) => {
            if (url === '/station/remote/pair') return reply(201, { device: { id: '0123456789abcdef', name: 'Android' } });
            reads += 1;
            return reads === 1 ? reply(401, 'pair this phone first') : reply(200, M);
        },
    });
    await settle();
    const pair = page.calls.find((c) => c.url === '/station/remote/pair');
    assert.ok(pair, 'no pairing POST');
    assert.equal(pair.init.method, 'POST');
    assert.equal(pair.init.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.equal(pair.init.body, 'code=ABCD2345&name=Android');
    assert.equal(page.win.location.hash, '#/gates');
    assert.match(page.app.innerHTML, /data-block="tab-gates"/);
});

test('boot: 送出答案 posts the picked answers to /answer, and its 201 closes the sheet and reads again', async () => {
    const page = boot({ hash: '#/gate/aaaa-1', fetch: (url) => (url === '/answer' ? reply(201, '') : reply(200, M)) });
    await settle();
    const f = sheetForm('aaaa-1', [pick('q0', '改 mockup', true), pick('q0', '__other', false), ownBox(0, 'ignored')]);
    const e = page.fire('submit', submit(f));
    assert.equal(e.prevented, true);
    assert.equal(f.say.textContent, '送出中…');
    assert.equal(f.btn.disabled, true);
    await settle();
    const sent = page.calls.filter((c) => c.url === '/answer');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.method, 'POST');
    assert.equal(sent[0].init.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/ws/fankeel', id: 'aaaa-1', answers: JSON.stringify({ [Q1[0].question]: '改 mockup' }) }).toString());
    assert.equal(page.win.location.hash, '#/gates');
    assert.equal(page.reads(), 2);
});

test('boot: a refused or lost answer, a question left blank, a gate no longer held each change only the sheet\'s line', async () => {
    let answer = () => reply(409, ' already answered ');
    const page = boot({ hash: '#/gate/aaaa-1', fetch: (url) => (url === '/answer' ? answer() : reply(200, M)) });
    await settle();
    const f = sheetForm('aaaa-1', [pick('q0', '改 mockup', true)]);
    page.fire('submit', submit(f));
    await settle();
    assert.equal(f.say.textContent, '測站沒收下（409）：already answered');
    assert.equal(f.btn.disabled, false);
    assert.equal(page.win.location.hash, '#/gate/aaaa-1');
    answer = () => Promise.reject(new Error('offline'));
    page.fire('submit', submit(f));
    await settle();
    assert.equal(f.say.textContent, '沒送到：可以再按一次');
    assert.equal(f.btn.disabled, false);
    const blank = sheetForm('aaaa-1', [pick('q0', '__other', true), ownBox(0, '   ')]);
    page.fire('submit', submit(blank));
    assert.equal(blank.say.textContent, '每一題都要有答案');
    const gone = sheetForm('nobody', [pick('q0', '改 mockup', true)]);
    page.fire('submit', submit(gone));
    assert.equal(gone.say.textContent, '這個 gate 已經不在等了');
    assert.equal(page.calls.filter((c) => c.url === '/answer').length, 2, 'a blank or gone sheet posts nothing');
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

test('boot: a tap on the dim or grab closes the sheet; retry reads again, repair and manual show pair-scan', async () => {
    let up = false;
    const page = boot({ hash: '#/gate/aaaa-1', store: { 'station.m.host': 'ymlab-pc' }, fetch: () => (up ? reply(200, M) : Promise.reject(new Error('offline'))) });
    await settle();
    assert.match(page.app.innerHTML, /data-block="pair-error"/);
    up = true;
    page.fire('click', tap({ 'data-act': 'retry' }));
    await settle();
    assert.equal(page.reads(), 2);
    assert.match(page.app.innerHTML, /data-block="gate-sheet"/);
    page.fire('click', tap({ 'data-close': '1' }));
    assert.equal(page.win.location.hash, '#/gates');
    page.fire('click', tap({ 'data-act': 'repair' }));
    assert.match(page.app.innerHTML, /data-block="pair-scan"/);
    page.app.innerHTML = '';
    page.fire('click', tap({ 'data-act': 'manual' }));
    assert.match(page.app.innerHTML, /data-pair-form="1"/);
});

test('boot: Escape closes an open sheet and nothing else', async () => {
    const page = boot({ hash: '#/gate/aaaa-1', fetch: () => reply(200, M) });
    await settle();
    page.fire('keydown', { key: 'a' });
    assert.equal(page.win.location.hash, '#/gate/aaaa-1');
    page.fire('keydown', { key: 'Escape' });
    assert.equal(page.win.location.hash, '#/gates');
});

test('boot: typing in a 自己寫 box ticks its own __other', async () => {
    const page = boot({ fetch: () => reply(200, M) });
    await settle();
    for (const type of ['input', 'focusin']) {
        const other = { checked: false };
        const label = { querySelector: (s) => (s === 'input[value="__other"]' ? other : null) };
        page.fire(type, { target: { getAttribute: (a) => (a === 'data-own' ? '0' : null), closest: () => label } });
        assert.equal(other.checked, true, type);
    }
});

test('boot: a hash change redraws, and one naming a gate not held reads again', async () => {
    const page = boot({ hash: '#/gates', fetch: () => reply(200, M) });
    await settle();
    page.win.location.hash = '#/done';
    page.fireWin('hashchange');
    assert.match(page.app.innerHTML, /data-block="tab-done"/);
    assert.equal(page.reads(), 1);
    page.win.location.hash = '#/gate/zzzz-9';
    page.fireWin('hashchange');
    await settle();
    assert.equal(page.reads(), 2);
});

test('boot: coming back into view reads again, but never under an open sheet, so what was typed stays', async () => {
    const page = boot({ hash: '#/gates', fetch: () => reply(200, M) });
    await settle();
    page.doc.visibilityState = 'hidden';
    page.fire('visibilitychange');
    assert.equal(page.reads(), 1);
    page.doc.visibilityState = 'visible';
    page.fire('visibilitychange');
    await settle();
    assert.equal(page.reads(), 2);
    page.win.location.hash = '#/gate/aaaa-1';
    page.fireWin('hashchange');
    page.app.innerHTML = 'the sheet as typed';
    page.fire('visibilitychange');
    await settle();
    assert.equal(page.reads(), 2);
    assert.equal(page.app.innerHTML, 'the sheet as typed');
});

test('boot: a screen that fails to draw is thrown, not shown as a station out of reach', async () => {
    const thrown = [];
    const page = boot({ fetch: () => reply(200, { host: 'ymlab-pc', gates: { length: 1 } }), win: { setTimeout: (fn) => { thrown.push(fn); } } });
    await settle();
    assert.doesNotMatch(page.app.innerHTML, /pair-error/);
    assert.equal(thrown.length, 1);
    assert.throws(thrown[0], /gates\.map is not a function/);
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
