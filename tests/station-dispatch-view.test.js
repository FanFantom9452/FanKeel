'use strict';
// The detail panel's task table, dispatch table and replay. Every total they
// print is the sum of the rows printed under it; these tests hold that to the
// rows handed in.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const count = (s, re) => (s.match(re) || []).length;

const x = {
    dispatches: [
        { key: 't1', turn: 3, surface: 'agent', text: 'Review task 1', out: 1000, back: 61000, ret: 1873, launch: 1066, ids: ['a1'] },
        { key: 't2', turn: 5, surface: 'workflow', text: 'survey', out: 2000, back: 90000, ret: 9602, launch: 1198, run: 'wf_1', ids: ['w1', 'w2', 'w3'] },
    ],
    rows: [
        { id: 'a1', disp: 0, surface: 'agent', label: 'Review task 1', agentType: 'fankeel-reviewer', model: 'claude-sonnet-5', phase: null, c: 123, k: 45, s: 60, unpriced: [] },
        { id: 'w1', disp: 1, surface: 'workflow', label: 'read:a', agentType: 'fankeel:fankeel-reader', model: 'claude-sonnet-5', phase: 'Read', c: 40, k: 10, s: 30, unpriced: [] },
        { id: 'w2', disp: 1, surface: 'workflow', label: 'read:b', agentType: 'fankeel:fankeel-reader', model: 'claude-sonnet-5', phase: 'Read', c: 10, k: 5, s: 20, unpriced: [] },
        { id: 'w3', disp: 1, surface: 'workflow', label: 'check', agentType: 'fankeel:fankeel-reviewer', model: 'claude-mystery-9', phase: 'Check', c: 0, k: 2, s: 5, unpriced: ['claude-mystery-9'] },
    ],
    runs: [{ run: 'wf_1', name: 'survey', agents: 3 }],
    agentCents: 173,
    agentsTotal: { cents: 173 },
    unpriced: ['claude-mystery-9'],
    steps: { a1: { steps: [{ k: 'read', f: 'lib/a.js' }, { k: 'cmd', c: 'npm test', r: 'ℹ pass 3' }], total: { read: 1, cmd: 1, find: 2 }, dropped: { find: 2 }, droppedN: 2 } },
    events: [
        { t: 500, kind: 'prompt', text: 'fix it', cmd: '/fankeel:fankeel' },
        { t: 600, kind: 'gate', qs: [{ q: 'Which?', a: 'my own', own: true }] },
        { t: 1000, kind: 'out', disp: 0, surface: 'agent', text: 'Review task 1', agentType: 'fankeel-reviewer', alias: 'sonnet' },
        { t: 61000, kind: 'back', disp: 0, ret: 1873, text: 'Review task 1' },
        { t: 62000, kind: 'commit', sha: 'abc1234', text: 'fix: it' },
    ],
    dropped: 0,
};

test('the dispatch footer and each band are the sums of their rows, and the tally sets them against agentsOf and the run file', () => {
    const html = V.dispatchHtml(x);
    const foot = html.slice(html.indexOf('<tfoot>'), html.indexOf('</tfoot>'));
    assert.match(foot, /4 個 agent/);
    assert.match(foot, /\$1\.73/);
    assert.match(foot, /62k/);
    assert.match(foot, /1m55s/);
    assert.match(foot, /11,475/, 'returned characters, launches left out');
    assert.match(html, /各列美元相加 <b>\$1\.73<\/b> <span class="eq">＝<\/span> agentsOf\(\) 的 \$1\.73/);
    assert.match(html, /workflow 派工 3 列 <span class="eq">＝<\/span> run 檔的 workflow_agent 3 列/);
    assert.match(html, /合計 2,264 字元/);
    assert.match(V.dispatchHtml(Object.assign({}, x, { agentsTotal: { cents: 174 } })), /class="ne">≠/);
});

test('a workflow folds into one row per phase, its agents hidden until the phase opens; an unknown model reads unpriced', () => {
    const html = V.dispatchHtml(x);
    assert.equal(count(html, /data-ph="/g), 2);
    assert.equal(count(html, /class="wa" data-in="ph-1-0" hidden/g), 2);
    assert.equal(count(html, /class="wa" data-in="ph-1-1" hidden/g), 1);
    assert.match(html, /title="價目表不認得：claude-mystery-9">unpriced/);
    assert.match(html, /<span class="sf workflow">workflow<\/span>/);
});

test('the task table marks the hint and a task with no ledger line, and counts completed rows against the ledger', () => {
    const tasks = [{
        plan: 'docs/plans/2026-09-11-x.md', ledgerLines: 1,
        tasks: [{ n: 1, title: 'one', status: 'complete', range: 'abc1234..def5678', turns: [3] },
            { n: 2, title: 'two', status: 'no ledger line', range: null, turns: [5] }],
        groups: [{ g: 1, tasks: [1, 2], surface: 'agents', turns: [3, 5], hint: true }],
        unmatched: ['Plan reviewer'],
    }];
    const html = V.tasksHtml(tasks);
    assert.match(html, /could have gone in one response/);
    assert.match(html, /class="pill sm pend">no ledger line/);
    assert.match(html, /標為完成的 <b>1 列<\/b> <span class="eq">＝<\/span> ledger 的 Task 行 1/);
    assert.match(html, /Plan reviewer/);
    assert.match(V.tasksHtml([]), /沒有 plan 檔/);
});

test('the replay is one row per event with a filter per kind, a gate shows the answer, a dispatch opens into its steps', () => {
    const html = V.replayHtml(x);
    assert.equal(count(html, /<li data-kind=/g), 5);
    assert.equal(count(html, /data-rk="/g), 8);
    assert.match(html, /my own<span class="own">自己寫的<\/span>/);
    assert.match(html, /展開它自己的步驟 <span class="n">2 \/ 4 步<\/span>/);
    assert.match(html, /另有 2 步沒列出（搜 2）/);
    assert.match(V.replayHtml(Object.assign({}, x, { dropped: 12 })), /丟掉了 12 列/);
    assert.equal(V.dur(59), '59s');
    assert.equal(V.dur(3725), '1h02m');
});
