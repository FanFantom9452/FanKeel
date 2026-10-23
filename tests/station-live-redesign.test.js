'use strict';
// 進行中 (assets/station/live-page.js; design 2026-10-21-station-redesign §1;
// mockup route-live-a.html): the three groups, one link a row with the
// glyph, chip, task, route n/len, cost main + agents and the last move, the
// peek with only fields the row has, unnamed sessions folded, and the pulse
// stopped under reduced motion.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'live-page.css'), 'utf8');
const NOW = Date.parse('2026-10-22T09:00:00.000Z');
const iso = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();
const ROUTE5 = ['survey', 'design', 'plan', 'build', 'land'];
const base = (o) => Object.assign({ root: 'F:\\w', project: 'app', pkey: 'F:\\w/app', route: ROUTE5, stage: 'plan', state: 'live',
    started: iso(120), updated: iso(5), usd: 1.5, agentUsd: 2.25, model: 'claude-opus-4-1', gateAt: null, stages: [], days: null }, o);
const SESSIONS = [
    base({ id: 'aaaaaaaa-0001', task: 'Wait task', gateAt: iso(3) }),
    base({ id: 'bbbbbbbb-0002', task: 'Run <task>' }),
    base({ id: 'cccccccc-0003', task: null, route: [], stage: 'init', updated: iso(1) }),
    base({ id: 'dddddddd-0004', task: null, route: [], stage: 'init', updated: iso(2) }),
    base({ id: 'eeeeeeee-0005', task: 'Stale task', state: 'stale', updated: iso(300) }),
    base({ id: 'ffffffff-0006', task: 'Ended', state: 'down', gateAt: iso(9) }),
];

function live(lang) {
    const { win } = page(['tip.js', 'live-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    return win.FK_LIVE;
}
const draw = (sessions, lang) => live(lang).page({ sessions }, { names: { 'F:\\w/app': 'w / app' }, now: NOW });
// The module with a document that keeps what it listens for. station.js's
// boot draws the live page, so the module may bind before the test's draw;
// `fire` reaches only listeners live-page.js added (by the file on the stack),
// not station.js's or tip.js's.
function bound() {
    const on = [];
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const document = { getElementById: el, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [], activeElement: null,
        addEventListener(type, fn) { if (/live-page\.js/.test(new Error().stack)) on.push([type, fn]); } };
    const L = page(['tip.js', 'live-page.js'], {}, { document }).win.FK_LIVE;
    const draw = () => L.page({ sessions: SESSIONS }, { names: {}, now: NOW });
    draw();
    const fire = (type, e) => on.forEach(([t, fn]) => { if (t === type) fn(e); });
    return { document, fire, draw };
}

test('groups: a gate waiting, running, may have stopped; an ended session is in none', () => {
    const g = live().groups(SESSIONS);
    assert.deepEqual(Array.from(g.wait, (s) => s.id), ['aaaaaaaa-0001']);
    assert.deepEqual(Array.from(g.run, (s) => s.id), ['bbbbbbbb-0002', 'cccccccc-0003', 'dddddddd-0004']);
    assert.deepEqual(Array.from(g.stop, (s) => s.id), ['eeeeeeee-0005']);
});

test('the head switches 進行中 | 全部, with both counts', () => {
    const html = draw(SESSIONS);
    assert.ok(html.includes('data-block="live-head"'));
    assert.ok(html.includes('<a href="#/live" aria-current="page">進行中<b class="kn">5</b></a>'), html.slice(0, 600));
    assert.ok(html.includes('<a href="#/sessions">全部<b class="kn">6</b></a>'));
    for (const b of ['live-wait', 'live-run', 'live-stop']) assert.ok(html.includes('data-block="' + b + '"'), b);
});

test('a row is one link to the session with chip, task, route n/len, cost main + agents and an age', () => {
    const html = draw(SESSIONS);
    const row = html.slice(html.indexOf('<a class="hm-lv sxr" href="#/s/bbbbbbbb-0002"'));
    assert.ok(row.length < html.length, 'the running row links to its session');
    const one = row.slice(0, row.indexOf('</a>') + 4);
    assert.ok(one.includes('<span class="chip">app</span>'), one);
    assert.ok(one.includes('Run &lt;task&gt;'));
    assert.ok(one.includes('<span class="sx-n"><b>3</b>/5</span>'));
    assert.ok(one.includes('<li class="now" style="--c:var(--st-plan)" aria-current="step">'));
    assert.ok(one.includes('<span class="sx-usd">$3.75</span>'), 'cost is usd + agentUsd');
    assert.ok(one.includes('<span class="hm-lv-r">5m 前</span>'));
    assert.ok(one.includes('class="glyph k-only sx-g run"'));
});

test('the peek holds stage, model, cost main · agent, started, last move and id8, nothing else', () => {
    const html = draw(SESSIONS);
    const at = html.indexOf('id="pk-bbbbbbbb"');
    const pk = html.slice(at, html.indexOf('</dl>', at));
    const dts = pk.match(/<dt>[^<]*<\/dt>/g);
    assert.deepEqual(dts, ['<dt>這站</dt>', '<dt>模型</dt>', '<dt>花費</dt>', '<dt>開始</dt>', '<dt>最後動靜</dt>', '<dt>session</dt>']);
    assert.ok(pk.includes('<dd>Opus 4.1</dd>'), pk);
    assert.ok(pk.includes('主 $1.50 · 派工 $2.25'));
    assert.ok(pk.includes('<dd>bbbbbbbb</dd>'));
});

test('two or more unnamed sessions fold into one row; one stays a row', () => {
    const html = draw(SESSIONS);
    assert.ok(html.includes('<details class="sx-un" data-lv-un="run">'), html);
    assert.ok(html.includes('2 個未命名'));
    assert.equal((html.match(/<summary class="hm-lv sxr"/g) || []).length, 1);
    const lone = draw([SESSIONS[2]]);
    assert.ok(!lone.includes('sx-un'));
    assert.ok(lone.includes('href="#/s/cccccccc-0003"'));
});

test('a fold opened by its summary stays open across the poll redraw, and closes again', () => {
    const b = bound();
    const OPEN = '<details class="sx-un" data-lv-un="run" open>';
    assert.ok(!b.draw().includes(OPEN));
    const click = (open) => {
        const sm = { parentNode: { open }, getAttribute: (n) => (n === 'data-lv-sum' ? 'run' : null) };
        b.fire('click', { target: { closest: (sel) => (sel === 'summary[data-lv-sum]' ? sm : null) } });
    };
    click(false);
    assert.ok(b.draw().includes(OPEN), 'the click opened the fold, the redraw keeps it');
    click(true);
    assert.ok(!b.draw().includes(OPEN), 'the click closed the fold, the redraw keeps it closed');
});

test('Esc hides the peek keyboard focus showed: it blurs a focused row, nothing else', () => {
    const b = bound();
    let blurred = 0;
    const row = (sel) => ({ matches: (s) => s === sel, blur() { blurred++; } });
    b.document.activeElement = row('a.sxr');
    b.fire('keydown', { key: 'Enter' });
    assert.equal(blurred, 0, 'only Esc');
    b.fire('keydown', { key: 'Escape' });
    assert.equal(blurred, 1, 'Esc blurs the focused row');
    b.document.activeElement = row('input');
    b.fire('keydown', { key: 'Escape' });
    assert.equal(blurred, 1, 'Esc leaves focus elsewhere alone');
    assert.match(CSS, /a\.sxr:focus-visible>\.sx-pk\{visibility:visible/);
});

test('a stopped row is quieter, and an empty group says so', () => {
    assert.ok(draw(SESSIONS).includes('<a class="hm-lv sxr gone" href="#/s/eeeeeeee-0005"'));
    const none = draw([]);
    assert.ok(none.includes('沒有 gate 在等你'));
    assert.ok(none.includes('<span class="kn z">0</span>'));
});

test('English comes from the module table', () => {
    const html = draw(SESSIONS, 'en');
    assert.ok(html.includes('2 unnamed'));
    assert.ok(html.includes('Live<b class="kn">5</b>'));
});

test('only the running stage pulses, and reduced motion stops it', () => {
    assert.match(CSS, /\.sx-g\.run \.gseg\.now[^{]*\{animation:sx-pulse/);
    assert.match(CSS, /@media \(prefers-reduced-motion:reduce\)\{[^}]*\.sx-g\.run \.gseg\.now[^{]*\{animation:none\}/);
});

test('every string of live-page.js has English', () => {
    assert.deepEqual(stringsLeft('live-page.js', live().EN), []);
});
