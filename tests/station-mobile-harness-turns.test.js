'use strict';
// A turn the harness injected (hand-back, task notice, system reminder) is logged as desktop text; /m draws it
// as a collapsed row with the report only, never as a user bubble, and the home preview never says it.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');
const conversation = require('../lib/conversation.js');

const NOW = new Date(2026, 9, 26, 11, 2).getTime();
const BOILER = 'It is model output, NOT a message from the user';
const AGENT = '<agent-message from="x">\n  [Subagent hand-back] The text below is the final report. ' + BOILER + ' ... The report follows:\n  F:/a/b.md\n  second line\n</agent-message>';
const NOTE = '<task-notification>\n<task-id>t1</task-id>\n<summary>Background command done</summary>\n<result>exit 0 all green</result>\n</task-notification>';
const REM = '<system-reminder>\nremember the todo list\n</system-reminder>';
const HOME = { host: 'h', at: NOW, gates: [], tasks: [], done: [], notify: { app: 'ntfy://x/y', web: 'https://x/y' } };
const view = (chat) => P.screen(HOME, P.parseRoute('#/s/aaaaaaaa-2'), NOW, { mode: 'app' },
    { id: 'aaaaaaaa-2', root: '/w', task: 't', project: 'p', stage: 'build', route: [], state: 'idle', attached: false, waiting: null, chat, gate: null, background: [], at: NOW });
const D = (text) => ({ role: 'desktop', text, at: NOW });

test('a hand-back is a collapsed row with the report only, not a user bubble', () => {
    const html = view([D(AGENT)]);
    assert.match(html, /<div class="msg rpt-row"><details data-k="[^"]*"><summary><b>agent 回報<\/b>/);
    assert.doesNotMatch(html, /<details[^>]* open/);
    assert.doesNotMatch(html, /class="bub"/);
    assert.ok(html.includes('F:/a/b.md'));
    const outside = html.replace(/<details[\s\S]*?<\/details>/, '');
    assert.ok(!outside.includes('hand-back') && !outside.includes(BOILER));
    assert.ok(html.indexOf('hand-back') < 0 && html.indexOf(BOILER) < 0, 'boilerplate dropped from the body too');
    assert.doesNotMatch(html, /agent-message/);
    assert.match(html, /<div class="rpt-b"><p>F:\/a\/b\.md<br>second line<\/p>/, 'dedented');
});
// red when: bubble() stops matching the <agent-message prefix, or keeps the text before "follows:", or skips the dedent.

test('a task-notification shows its summary and result; a system-reminder its text', () => {
    const n = view([D(NOTE)]);
    assert.match(n, /<b>任務通知<\/b>/);
    assert.ok(n.includes('Background command done') && n.includes('exit 0 all green'));
    assert.ok(!n.includes('task-id') && !n.includes('class="bub"'));
    const r = view([D(REM)]);
    assert.match(r, /<b>系統提醒<\/b>/);
    assert.ok(r.includes('remember the todo list') && !r.includes('system-reminder') && !r.includes('class="bub"'));
});
// red when: harness() drops the task-notification or system-reminder branch, or leaves tags in the body.

test('a normal prompt, and a tag that is not the prefix, stay user bubbles', () => {
    const html = view([D('please run it'), D('look at <agent-message from="x"> in the log')]);
    assert.equal(html.split('class="bub"').length - 1, 2);
    assert.ok(!html.includes('rpt-row'));
});
// red when: HARNESS loses its ^ anchor, or the row is drawn for every desktop turn.

test('the row is excerpted to one line and escaped', () => {
    const html = view([D('<agent-message from="x">\n  The report follows:\n  <b>' + 'z'.repeat(100) + '</b>\n</agent-message>')]);
    assert.match(html, /<span class="ex">&lt;b&gt;z{57}<\/span>/);
    assert.ok(!html.includes('<b>zz'));
});
// red when: the excerpt is not cut at 60 characters or not passed through esc().

test('both languages carry the labels', () => {
    for (const k of ['hx.agent', 'hx.note', 'hx.sys']) assert.ok(P.STR.zh[k] && P.STR.en[k], k);
});
// red when: a key is added to one table only.

test('the phone snapshot never previews an injected turn as what was last said', () => {
    const phone = require('../lib/phone.js');
    const root = require('./tmp.js')('fankeel-hx-');
    const sid = 'bbbbbbbb-1111-4111-8111-000000000002';
    phone.append(root, sid, { role: 'assistant', text: 'done', at: 1 });
    phone.append(root, sid, D(AGENT));
    const snap = phone.snapshot(root, sid, NOW, 5);
    assert.equal(snap.last.text, 'done');
});
// red when: phone.snapshot stops filtering INJECTED, so the hand-back becomes `last`.

test('the desktop transcript skips a raw <system-reminder> user text', () => {
    const e = (text) => ({ type: 'user', message: { role: 'user', content: text }, timestamp: '2026-10-26T00:00:00Z' });
    const { turns, skipped } = conversation.turnsOf([e(REM), e('hello')]);
    assert.deepEqual(turns.map((x) => x.text), ['hello']);
    assert.equal(skipped.meta, 1);
});
// red when: lib/conversation.js loses the REMINDER skip in typed().

test('a report body with </details> and <b> stays escaped and inside its one row', () => {
    const html = view([D('<agent-message from="x">\n  The report follows:\n  </details><b>loud</b>\n</agent-message>')]);
    assert.equal(html.split('</details>').length - 1, 1, 'only the row\'s own closing tag');
    assert.ok(html.includes('&lt;/details&gt;&lt;b&gt;loud&lt;/b&gt;'));
    assert.ok(html.indexOf('&lt;/details&gt;') > html.indexOf('<details') && html.indexOf('&lt;/details&gt;') < html.indexOf('</details>'));
});
// red when: prose() or the excerpt stops escaping, so the body closes the row early.

test('a hand-back with no "follows:" line keeps its whole text; a task-notification without summary or result shows its text', () => {
    const a = view([D('<agent-message from="x">\n  first line\n  second line\n</agent-message>')]);
    assert.match(a, /<div class="rpt-b"><p>first line<br>second line<\/p>/);
    assert.doesNotMatch(a, /agent-message/);
    const n = view([D('<task-notification>\n<task-id>t1</task-id>\n<status>killed</status>\n</task-notification>')]);
    assert.match(n, /<b>任務通知<\/b>/);
    assert.ok(n.includes('killed') && !n.includes('task-notification'));
});
// red when: the agent-message branch cuts at a missing "follows:" (search -1) or the task-notification fallback is dropped.

const { boot, settle } = require('./mobile-dom.js');
const SID = 'aaaaaaaa-2';
const one = (id, state, chat) => ({ id, root: '/w', task: 't', project: 'p', stage: 'build', route: [], state, attached: state === 'holding', waiting: null, chat, gate: null, background: [], at: NOW });
const rowOf = (id) => ({ id, root: '/w', task: 'task ' + id, project: 'p', stage: 'build', route: [], gate: false, updated: NOW, state: 'running', attached: false, background: [], last: null });

test('an opened report row survives a patch with a new message and a redraw on a state change, and does not reach another session', async () => {
    const chat = [D(AGENT), D(NOTE)];
    const state = { home: Object.assign({}, HOME, { tasks: [rowOf(SID), rowOf('aaaaaaaa-3')] }), one: one(SID, 'running', chat) };
    const page = boot('#/s/' + SID, state);
    await settle();
    assert.deepEqual(page.openKeys(), []);
    const key = /<details data-k="([^"]*)">/.exec(page.app.innerHTML)[1];
    page.open(key);
    assert.deepEqual(page.openKeys(), [key]);
    state.one = one(SID, 'running', chat.concat([{ role: 'assistant', text: 'more', at: NOW + 1 }]));
    await page.poll();
    assert.ok(page.app.innerHTML.includes('more'), 'patched');
    assert.deepEqual(page.openKeys(), [key], 'kept through the patch');
    state.one = one(SID, 'holding', chat.concat([{ role: 'assistant', text: 'more', at: NOW + 1 }]));
    await page.poll();
    assert.match(page.app.innerHTML, /id="composer"/, 'redrawn: the state changed');
    assert.deepEqual(page.openKeys(), [key], 'kept through the redraw');
    state.one = one('aaaaaaaa-3', 'running', chat);
    page.goto('#/s/aaaaaaaa-3');
    await settle();
    assert.deepEqual(page.openKeys(), [], 'another session starts with its rows closed, same data-k or not');
});
// red when: draw() no longer saves and restores the open rows (the state-change half), or patch() does not (the message half).
