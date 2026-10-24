'use strict';
// assets/station/talk-acts.js: an act turn as one row on the 對話 tab — its
// time, each tool with its brief, each sub-agent with its state, the ones with
// a transcript as buttons — and the sub-agent dialog those buttons open,
// read again every 3 s while the agent runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');
const { NAMES } = require('./station-src.js');

const SID = 'cccccccc-3333-4333-8333-333333333333';
const T0 = Date.parse('2026-10-20T10:00:00.000Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();
const two = (n) => String(n).padStart(2, '0');
const clock = (iso) => { const d = new Date(iso); return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()); };
const ACT = { kind: 'act', at: at(5), tools: [
    { id: 't1', name: 'Bash', brief: 'npm test', at: at(5) },
    { id: 't2', name: 'Read', brief: 'lib/<a>.js', at: at(6) }], agents: [
    { id: 'tu_a', description: 'review the diff', agentType: 'fankeel:fankeel-reviewer', model: 'opus', background: false, state: 'finished', agentId: 'a1' },
    { id: 'tu_x', description: 'read the map', agentType: 'Explore', model: null, background: true, state: 'running', agentId: null }] };
const VIEW = { id: 'a1', agentType: 'fankeel:fankeel-reviewer', description: 'review the diff', model: 'opus', state: 'finished', report: 'All good.', turns: [
    { kind: 'user', at: at(0), text: 'Review this diff.' },
    { kind: 'tool', at: at(1), id: 'r1', name: 'Read', brief: 'lib/x.js' },
    { kind: 'result', at: at(2), id: 'r1', text: 'body', cut: true },
    { kind: 'claude', at: at(3), text: 'All good.' }] };
const M = () => page(['talk-acts.js']).M['talk-acts.js'];
const tick = () => new Promise((r) => setImmediate(r));

test('index.html loads talk-acts.js right after session-talk.js', () => {
    assert.equal(NAMES.indexOf('talk-acts.js'), NAMES.indexOf('session-talk.js') + 1);
});

test('an act row carries its time and each tool with its brief, escaped', () => {
    const html = M().html(ACT, SID, 'tk-a2');
    assert.ok(html.startsWith('<div class="tx-act" data-block="talk-act"><time>' + clock(ACT.at) + '</time>'));
    assert.ok(html.includes('<li class="ta-tl"><b>Bash</b><code>npm test</code></li>'));
    assert.ok(html.includes('<code>lib/&lt;a&gt;.js</code>'));
});

test('past eight tools the rest fold under one line', () => {
    const many = Object.assign({}, ACT, { agents: [], tools: Array.from({ length: 11 }, (_, i) => ({ id: 'x' + i, name: 'Grep', brief: 'p' + i, at: at(i) })) });
    const html = M().html(many, SID, 'tk-a0');
    assert.equal((html.match(/<li class="ta-tl">/g) || []).length, 11);
    assert.ok(html.includes('<details data-key="tk-a0-more"><summary>另外 3 個</summary>'));
    assert.ok(html.indexOf('p7<') < html.indexOf('另外 3 個') && html.indexOf('另外 3 個') < html.indexOf('p8<'));
});

test('a sub-agent with a transcript is a button naming its session and agent; one without is plain text', () => {
    const html = M().html(ACT, SID, 'tk-a2');
    assert.ok(html.includes('<button type="button" class="ta-open" data-tact-sid="' + SID + '" data-tact-agent="a1"'));
    assert.ok(html.includes('<span class="ta-st ta-finished">已完成</span><b>review the diff</b><span class="ta-m">fankeel:fankeel-reviewer · opus</span>'));
    assert.ok(html.includes('<span class="ta-st ta-running">執行中</span><b>read the map</b><span class="ta-m">Explore · 背景</span>'));
    assert.equal((html.match(/data-tact-agent=/g) || []).length, 1);
    assert.equal((M().html(ACT, '', 'k').match(/data-tact-agent=/g) || []).length, 0, 'no session id, nothing to open');
});

test('the dialog shows what it was asked, each tool call with its result, and the report once', () => {
    const html = M().viewHtml(VIEW, '');
    assert.ok(html.includes('<b id="tact-agent-h">review the diff</b><span class="tdlg-sub">fankeel:fankeel-reviewer · opus</span><span class="ta-st ta-finished">已完成</span>'));
    assert.ok(html.includes('<summary>交辦內容</summary><div class="tad-t">Review this diff.</div>'));
    assert.ok(html.includes('<b>Read</b><code>lib/x.js</code></summary><pre class="ta-r">body\n截在 4 字</pre>'));
    assert.equal(html.split('All good.').length - 1, 1, 'the report is not drawn twice');
    assert.ok(M().viewHtml(Object.assign({}, VIEW, { state: 'running', report: null }), '').includes('還沒有回報：仍在執行'));
    assert.ok(M().viewHtml(null, 'failed').includes('讀不到這個子 agent 的 transcript'));
    assert.ok(M().viewHtml(null, '').includes('讀取中…'));
});

test('a click on a sub-agent row opens the dialog, fetches its transcript, and reads a running one again in 3 s', async () => {
    const listeners = [];
    const dlg = { open: false, innerHTML: '', onclose: null, showModal() { this.open = true; }, close() { this.open = false; if (this.onclose) this.onclose(); },
        querySelectorAll: () => [] };
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const document = { getElementById: (id) => (id === 'tact-agent' ? dlg : el()), addEventListener(type, fn) { listeners.push([type, fn]); },
        createElement: el, head: { appendChild() {} }, body: { appendChild() {} }, querySelectorAll: () => [] };
    const urls = [];
    let answer = Object.assign({}, VIEW, { state: 'running', report: null });
    const fetch = (u) => { urls.push(u); return Promise.resolve({ ok: true, json: () => answer }); };
    const p = page(['talk-acts.js'], {}, { document, fetch });
    const timers = [];
    p.win.setTimeout = (fn) => { timers.push(fn); };
    const before = listeners.length;
    p.M['talk-acts.js'].html(ACT, SID, 'tk-a2');
    const click = listeners.slice(before).find(([t]) => t === 'click')[1];
    const btn = { getAttribute: (n) => (n === 'data-tact-sid' ? SID : n === 'data-tact-agent' ? 'a1' : null) };
    click({ target: { closest: (sel) => (sel === '[data-tact-agent]' ? btn : null) } });
    assert.ok(dlg.open, 'the dialog opens at once');
    assert.ok(dlg.innerHTML.includes('讀取中…'));
    await tick();
    assert.deepEqual(urls, ['station/talk/' + SID + '/agent/a1']);
    assert.ok(dlg.innerHTML.includes('還沒有回報：仍在執行'));
    assert.equal(timers.length, 1, 'running: read again');
    answer = VIEW;
    timers.shift()();
    await tick();
    assert.equal(urls.length, 2);
    assert.ok(dlg.innerHTML.includes('<div class="tad-rep">All good.</div>'));
    assert.equal(timers.length, 0, 'finished: no more reads');
    click({ target: { closest: (sel) => (sel === '[data-tact-close]' ? {} : null) } });
    assert.equal(dlg.open, false);
});

test('while a row runs, watch asks the agents route at most every 3 s and updates the held turns in place', async () => {
    const urls = [];
    const fetch = (u) => { urls.push(u); return Promise.resolve({ ok: true, json: () => ({ agents: [{ id: 'tu_x', agentId: 'a3', state: 'finished' }] }) }); };
    const T = page(['talk-acts.js'], {}, { fetch }).M['talk-acts.js'];
    const held = { turns: [JSON.parse(JSON.stringify(ACT))] };
    T.watch(SID, held);
    T.watch(SID, held);
    assert.deepEqual(urls, ['station/talk/' + SID + '/agents'], 'one read, not two');
    await tick();
    assert.deepEqual([held.turns[0].agents[1].state, held.turns[0].agents[1].agentId], ['finished', 'a3']);
    T.watch('other', { turns: [{ kind: 'user', text: 'x' }] });
    assert.equal(urls.length, 1, 'nothing running, nothing asked');
});

test('every string has English, and the classes have rules in session-talk.css', () => {
    assert.deepEqual(stringsLeft('talk-acts.js', M().EN), []);
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'session-talk.css'), 'utf8');
    for (const name of ['.tx-act', '.ta-tl', '.ta-open', '.ta-running', '.ta-failed', '.tdlg.tad', '.ta-r', '.tad-rep', '.tx-took']) assert.ok(css.includes(name), name);
});
