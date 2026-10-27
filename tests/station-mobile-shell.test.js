'use strict';
// The /m redesign (.fankeel/build/2026-10-27-mobile-app/mockup.html): the tab bar, cards that open,
// the 測站 sheet, the session screen's TokenBar and six panes, and the two safe-area fixes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const P = require('../assets/station/mobile.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const CSS = fs.readFileSync(path.join(ASSETS, 'mobile.css'), 'utf8');
const NOW = new Date(2026, 9, 27, 22, 0).getTime();
const Q = [{ question: '版面照原樣排？', multiSelect: false, options: [{ label: '收成三種版型 (Recommended)' }, { label: '照原樣' }] }];
const row = (id, state, extra) => Object.assign({ id, root: '/w', task: 'task ' + id, project: 'proj', stage: 'build', route: ['survey', 'design', 'build', 'verify'], gate: state === 'gate', updated: NOW - 60e3, state, attached: false, background: [], last: null, holdUntil: null }, extra);
const BG = [{ id: 'b1', type: 'agent', status: 'running', description: 'mockup agent', command: '', since: NOW - 30e3 }];
const HOME = {
    host: 'sh-pro6000', at: NOW, device: { name: 'iPhone', paired: new Date(2026, 9, 22, 9, 0).getTime() },
    gates: [Object.assign(row('aaaaaaaa-1', 'gate'), { questions: Q, since: NOW - 60e3, until: NOW + 760e3 })],
    tasks: [row('aaaaaaaa-1', 'gate'), row('aaaaaaaa-2', 'running', { last: { role: 'desktop', text: '跑測試', at: NOW } }),
        row('aaaaaaaa-3', 'background', { background: BG }), row('aaaaaaaa-4', 'idle'),
        row('aaaaaaaa-5', 'holding', { attached: true, holdUntil: NOW + 1690e3 })],
    stopped: [],
    done: [
        { id: 'aaaaaaaa-5', root: '/w', task: 't5', project: 'proj', stage: 'survey', route: [], kind: 'stage', at: NOW - 3 * 3600e3, usd: 1.72 },
        { id: 'aaaaaaaa-5', root: '/w', task: 't5', project: 'proj', stage: 'design', route: [], kind: 'stage', at: NOW - 3 * 3600e3 + 15 * 60e3, usd: 6.49 },
    ],
};
const sess = (state, extra) => Object.assign({ id: 'aaaaaaaa-5', root: '/w', task: 't5', project: 'proj', stage: 'build', route: ['survey', 'design', 'build', 'verify'], state, attached: state === 'holding', waiting: null, chat: [], gate: null, background: [], at: NOW, holdUntil: null,
    context: { tokens: 380000, at: 350000, window: 1000000 },
    limits: { at: NOW, five: 4, fiveResets: NOW + 4 * 3600e3, seven: 46, sevenResets: NOW + 2.24 * 864e5 } }, extra);
const APP = (extra) => Object.assign({ mode: 'app', open: {} }, extra);
const count = (html, re) => (html.match(re) || []).length;

test('parseRoute: 等你 is #/ask, a session opens on 對話 and names any of the six panes', () => {
    assert.deepEqual(P.parseRoute('#/ask'), { view: 'ask', id: null, pair: null });
    assert.deepEqual(P.parseRoute('#/s/aaaaaaaa-2'), { view: 'chat', id: 'aaaaaaaa-2', pair: null, pane: 'talk' });
    for (const pane of ['talk', 'timeline', 'plan', 'dispatch', 'events', 'gate']) assert.equal(P.parseRoute('#/s/aaaaaaaa-2/' + pane).pane, pane);
    assert.equal(P.parseRoute('#/s/aaaaaaaa-2/nope').view, 'home');
});

test('the three list screens share a tab bar, last on screen, the current tab marked; 等你 counts the gates; a session and pairing hide it', () => {
    for (const hash of ['#/', '#/ask', '#/done']) {
        const html = P.screen(HOME, P.parseRoute(hash), NOW, APP());
        assert.equal(count(html, /<nav class="tabbar"/g), 1, hash);
        assert.match(html, new RegExp('<a href="' + hash + '" aria-current="page"><span class="tab-ico">'), hash);
        assert.match(html, /<b class="tab-n" aria-label="1 個等你">1<\/b>/, hash);
        assert.match(html, /<\/nav>$/, hash);
    }
    assert.doesNotMatch(P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-5'), NOW, APP(), sess('holding')), /class="tabbar"/);
    assert.doesNotMatch(P.screen(null, null, NOW, { mode: 'pair', camera: false }), /class="tabbar"/);
});

test('home: 等你 cards first, then the running ones, then idle; a card shows one status line until its chevron opens', () => {
    const shut = P.screen(HOME, P.parseRoute('#/'), NOW, APP());
    const at = ['m-home-ask', 'm-home-run', 'm-home-idle'].map((b) => shut.indexOf('data-block="' + b + '"'));
    assert.ok(at.every((i, k) => i > 0 && (k === 0 || i > at[k - 1])), String(at));
    assert.equal(count(shut, /<div class="sc ask">/g), 1);
    assert.match(shut, /<span class="sc-q">.*版面照原樣排？/);
    assert.doesNotMatch(shut, /class="sc-more"/);
    assert.match(shut, /<button type="button" class="sc-tog" data-act="fold" data-key="sc:aaaaaaaa-2" aria-expanded="false"/);
    assert.match(shut, /手機接著 · 剩 28:10/);
    const open = P.screen(HOME, P.parseRoute('#/'), NOW, APP({ open: { 'sc:aaaaaaaa-2': true, 'sc:aaaaaaaa-3': true } }));
    assert.match(open, /<p class="sm-last">.*<b>電腦<\/b>跑測試/);
    assert.match(open, /<ul class="bgl"/);
    assert.match(open, /data-key="sc:aaaaaaaa-2" aria-expanded="true"/);
});

test('等你: each held gate with its time left, its options behind a tap, and 去答', () => {
    const shut = P.screen(HOME, P.parseRoute('#/ask'), NOW, APP());
    assert.match(shut, /data-block="m-ask-a"/);
    assert.match(shut, /<p class="sc-left">.*剩 12:40 · 之後轉回電腦<\/p>/);
    assert.match(shut, /2 個選項/);
    assert.doesNotMatch(shut, /class="gopt"/);
    const open = P.screen(HOME, P.parseRoute('#/ask'), NOW, APP({ open: { 'gp:aaaaaaaa-1': true } }));
    assert.match(open, /<ul class="gopt"><li>.*收成三種版型<\/span><span class="gq-rec">建議<\/span><\/li><li>/);
    assert.match(open, /<a class="sc-btn" href="#\/s\/aaaaaaaa-1">去答/);
    assert.match(P.screen(Object.assign({}, HOME, { gates: [], tasks: [] }), P.parseRoute('#/ask'), NOW, APP()), /沒有在等你答的/);
});

test('the host pill opens the 測站 sheet: one status line, then rows that open; never on a session', () => {
    const home = P.screen(HOME, P.parseRoute('#/'), NOW, APP());
    assert.match(home, /<button type="button" class="host" data-act="sheet" aria-haspopup="dialog" aria-expanded="false"/);
    assert.doesNotMatch(home, /m-remote-sheet/);
    const sheet = P.screen(HOME, P.parseRoute('#/'), NOW, APP({ sheet: true }));
    assert.match(sheet, /data-block="m-remote-sheet"/);
    assert.match(sheet, /已連上 sh-pro6000/);
    assert.match(sheet, /<span class="rs-v">iPhone<\/span><\/span><span class="rs-side">10\/22 配對<\/span>/);
    assert.match(sheet, /<span class="rs-v">task aaaaaaaa-5<\/span><\/span><span class="rs-side">剩 28:10<\/span>/);
    assert.doesNotMatch(sheet, /class="rs-x"/);
    assert.match(P.screen(HOME, P.parseRoute('#/'), NOW, APP({ sheet: true, open: { 'rs:held': true } })), /<div class="rs-x">.*data-act="detach" data-id="aaaaaaaa-5"/);
    assert.match(P.screen(Object.assign({}, HOME, { device: null }), P.parseRoute('#/'), NOW, APP({ sheet: true })), /<span class="rs-v">這台電腦<\/span>/);
    assert.doesNotMatch(P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-5'), NOW, APP({ sheet: true }), sess('holding')), /m-remote-sheet/);
});

test('a session screen: header, a TokenBar of three meters that opens to labelled rows, and six pane tabs', () => {
    const R = P.parseRoute('#/s/aaaaaaaa-5');
    const shut = P.screen(HOME, R, NOW, APP(), sess('holding'));
    const top = shut.slice(shut.indexOf('<div class="dt-top">'), shut.indexOf('</nav>'));
    assert.ok(top.indexOf('<header class="ch-h">') < top.indexOf('class="tkb"') && top.indexOf('class="tkb"') < top.indexOf('<nav class="panes"'));
    assert.equal(count(shut, /<span class="tkm-i">/g), 3);
    assert.match(shut, /<b>38%<\/b>.*<b>4%<\/b>.*<b>46%<\/b>/);
    assert.match(shut, /data-key="tk" aria-expanded="false"/);
    assert.doesNotMatch(shut, /class="tkx"/);
    assert.equal(count(shut, /<nav class="panes"[^>]*>(?:<a [^>]*>[\s\S]*?<\/a>){6}<\/nav>/g), 1);
    assert.match(shut, /<a href="#\/s\/aaaaaaaa-5\/talk" aria-current="page">/);
    assert.match(shut, /id="cmp-box"/, '對話 keeps the composer');
    const open = P.screen(HOME, R, NOW, APP({ open: { tk: true } }), sess('holding'));
    assert.equal(count(open, /<div class="tkx-r">/g), 3);
    assert.match(open, /380k \/ 1M · 壓縮線 350k/);
    assert.match(open, /<b style="--p:20%"><\/b>/, 'the 5h line: where the time says it should be');
    assert.match(open, /<b style="--p:68%"><\/b>/);
    const bare = P.screen(HOME, R, NOW, APP({ open: { tk: true } }), sess('holding', { context: null, limits: null }));
    assert.equal(count(bare, /<b>—<\/b>/g), 3);
    assert.match(bare, /還沒有讀數/);
});

test('the panes: 概覽 finished stages, 計畫 the route, 派工 the background, 事件 the steps, 關卡 the questions; rows open', () => {
    const at = (pane, p, ui) => P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-5/' + pane), NOW, APP(ui), p || sess('holding'));
    const ov = at('timeline');
    assert.match(ov, /data-block="m-pane-timeline"/);
    assert.match(ov, /<b class="usd">\$8\.21<\/b><span>2 站 · /);
    assert.equal(count(ov, /<li class="ov-r">/g), 2);
    assert.match(ov, /15 分/);
    assert.doesNotMatch(ov, /id="cmp-box"/, 'only 對話 has the composer');
    assert.match(at('timeline', null, { open: { ['ov:design:' + HOME.done[1].at]: true } }), /<dl class="ov-x">.*全部的 79%/);
    const pl = at('plan');
    assert.equal(count(pl, /<li class="ov-r ev">/g), 4);
    assert.match(pl, /進行中/);
    const dp = at('dispatch', sess('background', { background: BG }));
    assert.match(dp, /mockup agent/);
    assert.match(dp, /<i class="dot live"/);
    assert.match(at('dispatch'), /沒有在背景跑的 agent 或 shell/);
    const chat = [{ role: 'phone', text: 'go', at: NOW - 9e3 }, { role: 'tool', id: 't1', tool: 'Bash', label: 'npm test', at: NOW - 8e3 }, { role: 'tool-end', id: 't1', ok: false, at: NOW - 5e3 }];
    const ev = at('events', sess('holding', { chat }), { open: { 'ev:t1': true } });
    assert.match(ev, /<span class="lb">npm test<\/span><span class="tm">失敗 · 3\.0 秒<\/span>/);
    assert.match(ev, /<dd>Bash<\/dd>/);
    const gt = at('gate', sess('gate', { gate: { questions: Q, since: NOW - 60e3, until: NOW + 760e3 } }), { open: { 'gt:0': true } });
    assert.match(gt, /<span class="lb">版面照原樣排？<\/span><span class="tm">2 個選項<\/span>/);
    assert.match(gt, /<a class="sc-btn" href="#\/s\/aaaaaaaa-5\/talk">去答/);
    assert.match(at('gate'), /沒有在等你答的關卡/);
});

test('a sideways swipe moves one pane; a short or mostly vertical one does not', () => {
    assert.equal(P.swipeTo('talk', -90, 10), 'timeline');
    assert.equal(P.swipeTo('timeline', 90, 10), 'talk');
    assert.equal(P.swipeTo('talk', 90, 10), null);
    assert.equal(P.swipeTo('gate', -90, 10), null);
    assert.equal(P.swipeTo('plan', -40, 0), null);
    assert.equal(P.swipeTo('plan', -90, 80), null);
});

test('mobile.css: the header pads by the safe area, station.css\'s desktop .pg is cleared, the tab bar clears the home indicator, the old cards are gone', () => {
    assert.ok(CSS.includes('\nbody.m .ab.ab2{display:grid;gap:0;min-height:0;padding:calc(6px + env(safe-area-inset-top)) 8px 8px 20px}'));
    assert.ok(CSS.includes('\nbody.m .scr>.pg{flex:1;min-height:0;margin:0;padding:0;border:0;border-radius:0;background:none}'));
    assert.match(CSS, /\n\.tabbar\{[^}]*env\(safe-area-inset-bottom\)/);
    assert.doesNotMatch(CSS, /\.ha-row|\.ha-hist|\.ha-prev|\.ha-q\b/);
});

test('every class the new screens draw has a rule', () => {
    const css = CSS + fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8');
    const STATION = new Set(['dot', 'live', 'hm-stw', 'gq-rec', 'gate']);
    const chat = [{ role: 'tool', id: 't1', tool: 'Bash', label: 'x', at: NOW - 8e3 }, { role: 'tool-end', id: 't1', ok: true, at: NOW - 5e3 }];
    const open = { tk: true, ['ov:design:' + HOME.done[1].at]: true, 'pl:build': true, 'dp:b1': true, 'ev:t1': true, 'gt:0': true };
    const all = [P.screen(HOME, P.parseRoute('#/'), NOW, APP({ sheet: true, open: { 'sc:aaaaaaaa-2': true, 'rs:me': true, 'rs:held': true, 'rs:pair': true } })),
        P.screen(HOME, P.parseRoute('#/ask'), NOW, APP({ open: { 'gp:aaaaaaaa-1': true } })), P.screen(HOME, P.parseRoute('#/done'), NOW, APP())]
        .concat(['talk', 'timeline', 'plan', 'dispatch', 'events', 'gate'].map((pane) => P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-5/' + pane), NOW, APP({ open }),
            sess('gate', { chat, background: BG, gate: { questions: Q, since: NOW, until: NOW + 60e3 } }))));
    for (const html of all) for (const m of html.matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (!STATION.has(c)) assert.ok(new RegExp('\\.' + c + '(?![\\w-])').test(css), c);
});

const SRC = fs.readFileSync(path.join(ASSETS, 'mobile.js'), 'utf8');
const reply = (status, body) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) });
const settle = () => new Promise((r) => setTimeout(r, 30));
function boot(hash, one) {
    const app = { innerHTML: '' };
    const tkb = { innerHTML: '' };
    const on = { doc: {}, win: {} };
    const calls = [];
    const listen = (where) => (type, fn) => { (on[where][type] = on[where][type] || []).push(fn); };
    const doc = { getElementById: (id) => (id === 'app' ? app : null), documentElement: {}, body: { insertAdjacentHTML() {} },
        addEventListener: listen('doc'), querySelector: (s) => (s === '.tkb' ? tkb : null), visibilityState: 'visible' };
    const win = { document: doc, location: { hash }, navigator: { language: 'zh-TW', userAgent: 'x' },
        localStorage: { getItem: () => null, setItem() {} }, addEventListener: listen('win'), setInterval() {}, setTimeout, URLSearchParams,
        fetch: (url, init) => { calls.push({ url, init: init || {} }); return url === '/station/mobile.json' ? reply(200, HOME) : url.startsWith('/station/phone.json') ? reply(200, one) : reply(201, ''); } };
    vm.runInNewContext(SRC, { window: win });
    const fire = (where, type, e) => { (on[where][type] || []).forEach((fn) => fn(e)); return e; };
    return { app, tkb, win, calls, fire: (type, e) => fire('doc', type, e || {}), fireWin: (type, e) => fire('win', type, e || {}) };
}
const tap = (attrs) => {
    const el = { getAttribute: (a) => (Object.prototype.hasOwnProperty.call(attrs, a) ? attrs[a] : null) };
    el.closest = (s) => (s === '.cv,.ov' ? null : el);
    return { target: el, preventDefault() {} };
};

test('boot: the TokenBar opens in place, so the composer and its draft are not drawn again', async () => {
    const page = boot('#/s/aaaaaaaa-5', sess('holding'));
    await settle();
    const before = page.app.innerHTML;
    assert.match(before, /data-key="tk" aria-expanded="false"/);
    page.fire('click', tap({ 'data-act': 'fold', 'data-key': 'tk' }));
    assert.equal(page.app.innerHTML, before, 'no full redraw');
    assert.match(page.tkb.innerHTML, /aria-expanded="true"/);
    assert.equal(count(page.tkb.innerHTML, /class="tkx-r"/g), 3);
});

test('boot: the host pill opens and closes the sheet; Escape and a new hash close it', async () => {
    const page = boot('#/', sess('holding'));
    await settle();
    page.fire('click', tap({ 'data-act': 'sheet' }));
    assert.match(page.app.innerHTML, /data-block="m-remote-sheet"/);
    page.fire('keydown', { key: 'Escape', target: { closest: () => null }, preventDefault() {} });
    assert.doesNotMatch(page.app.innerHTML, /m-remote-sheet/);
    page.fire('click', tap({ 'data-act': 'sheet' }));
    page.win.location.hash = '#/done';
    page.fireWin('hashchange');
    assert.doesNotMatch(page.app.innerHTML, /m-remote-sheet/);
});

test('boot: 交還電腦 in the sheet detaches the session it names and reads the list again', async () => {
    const page = boot('#/', sess('holding'));
    await settle();
    const reads = page.calls.filter((c) => c.url === '/station/mobile.json').length;
    page.fire('click', tap({ 'data-act': 'detach', 'data-id': 'aaaaaaaa-5' }));
    await settle();
    const sent = page.calls.filter((c) => c.url === '/phone/detach');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].init.body, new URLSearchParams({ root: '/w', id: 'aaaaaaaa-5' }).toString());
    assert.ok(page.calls.filter((c) => c.url === '/station/mobile.json').length > reads);
});
