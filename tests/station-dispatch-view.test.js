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
    assert.match(V.tasksHtml([Object.assign({}, tasks[0], { ledgerLines: 2 })]),
        /標為完成的 <b>1 列<\/b> <span class="ne">≠<\/span> ledger 的 Task 行 2/, 'more Task lines than completed rows disagrees');
    assert.match(html, /Plan reviewer/);
    assert.match(V.tasksHtml([]), /沒有 plan 檔/);
});

test('the replay is one row per event with a filter per kind, a gate shows the answer, a dispatch opens into its steps', () => {
    const html = V.replayHtml(x);
    assert.equal(count(html, /<li data-kind=/g), 5);
    assert.equal(count(html, /data-rk="/g), 8);
    assert.deepEqual([...html.matchAll(/data-rk="(\w+)"[^>]*>[^<]*<span class="n">(\d+)<\/span>/g)].map((m) => m[1] + ':' + m[2]),
        ['prompt:1', 'stage:0', 'gate:1', 'out:1', 'back:1', 'edit:0', 'commit:1', 'test:0'], 'each filter counts its own kind');
    assert.match(html, /my own<span class="own">自己寫的<\/span>/);
    assert.match(html, /展開它自己的步驟 <span class="n">2 \/ 4 步<\/span>/);
    assert.match(html, /另有 2 步沒列出（搜 2）/);
    assert.match(V.replayHtml(Object.assign({}, x, { dropped: 12 })), /丟掉了 12 列/);
    assert.equal(V.dur(59), '59s');
    assert.equal(V.dur(3725), '1h02m');
});

test('splitHtml lists one line per stage in the order seq first entered it, even across a backtrack, with the turn counts summed', () => {
    const s = {
        seq: [{ stage: 'build', at: 0 }, { stage: 'verify', at: 50 }, { stage: 'build', at: 100 }],
        loops: [{ stage: 'build', turns: 10 }, { stage: 'verify', turns: 4 }, { stage: 'build', turns: 5 }],
        dispatches: [], rows: [], tasks: [],
    };
    const html = V.splitHtml(s);
    assert.ok(html.indexOf('build') < html.indexOf('verify'), 'build was entered first, so its line leads even though the backtrack revisits it after verify');
    assert.match(html, /<p class="tally">build — 主迴圈 15 回合；沒有派工<\/p>/, 'the two loops entries for build sum to one line');
    assert.match(html, /<p class="tally">verify — 主迴圈 4 回合；沒有派工<\/p>/);
});

test('concurrent dispatch is grouped by turn, not counted per call', () => {
    const s = {
        seq: [{ stage: 'build', at: 0 }],
        loops: [{ stage: 'build', turns: 8 }],
        dispatches: [
            { turn: 3, surface: 'agents', out: 10, back: 20 }, { turn: 3, surface: 'agents', out: 10, back: 20 },
            { turn: 6, surface: 'agents', out: 30, back: 40 }, { turn: 6, surface: 'agents', out: 30, back: 40 },
        ],
        rows: [
            { disp: 0, model: 'claude-sonnet-5' }, { disp: 1, model: 'claude-sonnet-5' },
            { disp: 2, model: 'claude-sonnet-5' }, { disp: 3, model: 'claude-sonnet-5' },
        ],
        tasks: [],
    };
    const html = V.splitHtml(s);
    assert.match(html, /同一回應並發 2 回（共 4 個）/, 'two turns carried the four calls, so it reads 2 回 not 4 回');
    assert.match(html, /sonnet ×4/);
});

test('an overlapping single dispatch is counted once as could-have-gone-in-one-turn', () => {
    const s = {
        seq: [{ stage: 'build', at: 0 }],
        loops: [{ stage: 'build', turns: 8 }],
        dispatches: [
            { turn: 1, surface: 'agent', out: 0, back: 100 },
            { turn: 2, surface: 'agent', out: 50, back: 150 },
            { turn: 3, surface: 'agent', out: 200, back: 300 },
        ],
        rows: [{ disp: 0, model: 'claude-sonnet-5' }, { disp: 1, model: 'claude-sonnet-5' }, { disp: 2, model: 'claude-sonnet-5' }],
        tasks: [],
    };
    const html = V.splitHtml(s);
    assert.match(html, /單發 3 次，各佔一個回合，其中 1 次在前一次回來前就派出，本可一次發出/);
    assert.equal((html.match(/本可一次發出/g) || []).length, 1, 'turn 2 overlaps turn 1 once; turn 3 does not overlap turn 2, so the credit is not doubled');
});

test('a cache with no loops field, or an empty one, says so plainly instead of printing a guessed turn count', () => {
    const base = {
        seq: [{ stage: 'survey', at: 0 }],
        dispatches: [{ turn: 1, surface: 'agent', out: 10, back: 20 }],
        rows: [{ disp: 0, model: 'claude-sonnet-5' }],
        tasks: [],
    };
    // Missing entirely (a cache older than the `loops` field) and present but
    // empty (a stage that ran with no requests of its own) must read alike:
    // both are "no per-stage turn count", not a printed zero.
    for (const s of [base, Object.assign({}, base, { loops: [] })]) {
        const html = V.splitHtml(s);
        assert.match(html, /<p class="tally">這份快取沒有逐站回合數（寫於 loops 欄位出現之前）<\/p>/);
        assert.equal(html.includes('主迴圈'), false, 'no loops field means no turn count is printed anywhere');
        assert.match(html, /survey — 派工：單發 1 次；sonnet ×1/);
    }
});

test('a plan line reports its groups in three states: dispatched in one turn, never dispatched, and could-have-gone-in-one', () => {
    const tasks = [{
        plan: 'docs/plans/2026-09-01-x.md',
        tasks: [{ n: 1 }, { n: 2 }, { n: 3 }],
        groups: [
            { g: 1, tasks: [1], turns: [3], hint: false },
            { g: 2, tasks: [2], turns: [], hint: false },
            { g: 3, tasks: [3], turns: [5, 7], hint: true },
        ],
    }];
    const html = V.splitHtml({ seq: [], loops: [], dispatches: [], rows: [], tasks });
    assert.match(html, /plan 2026-09-01-x\.md：3 個 task 分 3 組；1 組各在一個回合內派出、1 組沒有派工紀錄、1 組本可一次發出：G3（task 3，分 2 個回合）/);
});

test('a page with more than one dispatch and no task table says the rest cannot be judged independent', () => {
    const s = {
        seq: [{ stage: 'build', at: 0 }],
        loops: [{ stage: 'build', turns: 4 }],
        dispatches: [{ turn: 1, surface: 'agent', out: 0, back: 10 }, { turn: 2, surface: 'agent', out: 20, back: 30 }],
        rows: [{ disp: 0, model: 'claude-sonnet-5' }, { disp: 1, model: 'claude-sonnet-5' }],
        tasks: [],
    };
    assert.match(V.splitHtml(s), /這頁沒有任務表：其餘派工是否互不相依，無從判斷/);
    const one = Object.assign({}, s, { dispatches: [s.dispatches[0]], rows: [s.rows[0]] });
    assert.equal(V.splitHtml(one).includes('這頁沒有任務表'), false, 'a single dispatch has nothing else to judge independence against');
});

test('splitCount renders the 分工 header: turn sum and dispatch count with loops, dispatch count alone without', () => {
    const dispatches = [{ turn: 1, surface: 'agent', out: 0, back: 10 }, { turn: 2, surface: 'agent', out: 20, back: 30 },
        { turn: 3, surface: 'agent', out: 40, back: 50 }];
    assert.equal(V.splitCount({ loops: [{ stage: 'build', turns: 10 }, { stage: 'verify', turns: 5 }], dispatches }),
        '主迴圈 15 回合 · 派工 3 次');
    assert.equal(V.splitCount({ dispatches }), '派工 3 次');
    assert.equal(V.splitCount({ loops: [], dispatches }), '派工 3 次', 'an empty loops array reads the same as a missing one');
});

test('a workflow dispatch counts its own agents, and its rows still tally into the stage models', () => {
    const s = {
        seq: [{ stage: 'survey', at: 0 }],
        loops: [{ stage: 'survey', turns: 8 }],
        dispatches: [{ turn: 2, surface: 'workflow', out: 10, back: 20 }],
        rows: [{ disp: 0, model: 'claude-sonnet-5' }, { disp: 0, model: 'claude-sonnet-5' }, { disp: 0, model: 'claude-opus-4' }],
        tasks: [],
    };
    const html = V.splitHtml(s);
    assert.match(html, /<p class="tally">survey — 主迴圈 8 回合；派工：Workflow 1 次（3 個 agent）；sonnet ×2、opus ×1<\/p>/);
});
