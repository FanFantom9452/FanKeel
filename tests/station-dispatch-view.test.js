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
    assert.equal(count(html, /class="wa is-done" data-in="ph-1-0" hidden/g), 2);
    assert.equal(count(html, /class="wa is-done" data-in="ph-1-1" hidden/g), 1);
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

// The live dispatch table (docs/plans/2026-09-19-station-live-design.md §3–§4):
// a state on every row, the tool a running agent is on, and a row that opens
// into its prompt and its steps with any not yet answered last.
const T9 = 1789800000000;
const live = {
    dispatches: [
        { key: 'd0', turn: 3, surface: 'agent', text: 'Task 1', out: T9, back: T9 + 60000, ret: 1102, launch: 0, ids: ['r1'] },
        { key: 'd1', turn: 5, surface: 'agent', text: 'Task 2', out: T9 + 70000, back: null, ret: null, launch: 900, ids: ['r2'] },
        { key: 'd2', turn: 6, surface: 'workflow', text: 'build', out: T9 + 80000, back: null, ret: null, launch: 800, run: 'wf_1', ids: ['w1', 'w2'] },
    ],
    rows: [
        { id: 'r1', disp: 0, surface: 'agent', label: 'Task 1', agentType: 'general-purpose', model: 'claude-sonnet-5', phase: null, c: 49, k: 1210, s: 376, unpriced: [], from: T9 + 2000, to: T9 + 58000 },
        { id: 'r2', disp: 1, surface: 'agent', label: 'Task 2', agentType: 'general-purpose', model: 'claude-sonnet-5', phase: null, c: 37, k: 880, s: 180, unpriced: [], from: T9 + 72000, to: T9 + 250000 },
        { id: 'w1', disp: 2, surface: 'workflow', label: 'impl:a', agentType: null, model: 'claude-sonnet-5', phase: 'Implement', c: 46, k: 1120, s: 335, unpriced: [], from: T9 + 82000, to: T9 + 400000 },
        { id: 'w2', disp: 2, surface: 'workflow', label: 'review:a', agentType: null, model: 'claude-sonnet-5', phase: 'Review', c: 17, k: 410, s: 60, unpriced: [], from: T9 + 400000, to: T9 + 460000 },
    ],
    runs: [{ run: 'wf_1', name: 'build', agents: 2 }], agentCents: 149, agentsTotal: { cents: 149 }, unpriced: [], events: [], dropped: 0,
    at: T9 + 470000,
    states: { r1: 'done', r2: 'running', w1: 'done', w2: 'running' },
    steps: {
        r1: { steps: [{ k: 'read', f: 'lib/detail.js' }, { k: 'cmd', c: 'node --test tests/detail.test.js', r: 'ℹ pass 41' }], total: { read: 1, cmd: 1 }, dropped: {}, droppedN: 0,
            open: false, cur: null, lastAt: T9 + 58000, prompt: 'Build Task 1.', promptLen: 13 },
        // `stepsOf` keeps a tool_use with no `tool_result` in `steps` itself now,
        // marked `p: true`, at its own chronological position — `cur` names the
        // same one (the last), with the timing `steps` does not carry.
        r2: { steps: [{ k: 'read', f: 'assets/station/station.js' }, { k: 'cmd', c: 'node --test tests/station.test.js', p: true }],
            total: { read: 1 }, dropped: { find: 3 }, droppedN: 3,
            open: true, cur: { n: 'Bash', t: T9 + 240000, k: 'cmd', c: 'node --test tests/station.test.js' }, lastAt: T9 + 250000, prompt: 'Build Task 2.', promptLen: 13 },
        w1: { steps: [{ k: 'edit', f: 'assets/station/station.js' }], total: { edit: 1 }, dropped: {}, droppedN: 0, open: false, cur: null, lastAt: T9 + 400000, prompt: 'impl', promptLen: 4 },
        w2: { steps: [], total: {}, dropped: {}, droppedN: 0, open: true, cur: { n: 'Read', t: T9 + 450000, k: 'read', f: 'station/station.js' }, lastAt: T9 + 460000, prompt: 'review', promptLen: 6 },
    },
};
const LIVE_ROW = { id: 's1', state: 'live' };

test('every agent row carries its state, and a running one names the tool it is on and how long it has been on it', () => {
    const html = V.dispatchHtml(live, LIVE_ROW, { now: T9 + 480000, live: true });
    assert.equal(count(html, /<tr class="(?:ag|wa) is-running"/g), 2);
    assert.equal(count(html, /<tr class="(?:ag|wa) is-done"/g), 2);
    assert.match(html, /<span class="pill sm running"[^>]*><i class="dot live"><\/i>running<\/span>/);
    assert.match(html, /<span class="k">正在<\/span><span class="c" title="Bash: node --test tests\/station\.test\.js">/);
    assert.match(html, /<span class="c" title="Read station\/station\.js">[\s\S]*?<span class="tkr" data-b="-/);
    assert.match(html, /<span class="agdots" aria-hidden="true"><i class="done"><\/i><i class="running"><\/i><\/span><span class="phs">1 \/ 2 done<\/span>/);
    assert.match(html, /data-seg="dfilter"[\s\S]*?>running 2<\/button>/);
    assert.match(html, /running 的 2 列是到 \d\d:\d\d:\d\d 為止/);
});

test('once the list says the session is not live, a running agent reads lost, and says where it stopped', () => {
    const html = V.dispatchHtml(live, { id: 's1', state: 'stale' }, { now: T9 + 480000 });
    assert.equal(count(html, /is-running/g), 0);
    assert.equal(count(html, /<tr class="(?:ag|wa) is-lost"/g), 2);
    assert.match(html, /<span class="k">停在<\/span><span class="c" title="Bash: node --test tests\/station\.test\.js">[^<]*<\/span><span class="e">跑了 10s<\/span>/);
    assert.match(html, /→沒回來/);
    assert.doesNotMatch(html, /class="tkr"/, 'nothing ticks on a session that stopped');
});

test('an opened agent shows its prompt folded, its steps with the one in progress last and outside the cap, and what a done one returned', () => {
    const html = V.dispatchHtml(live, LIVE_ROW, { now: T9 + 480000, live: true, open: { r1: true, r2: true } });
    const r2 = html.slice(html.indexOf('<tr class="ax ag is-running">'));
    assert.match(r2, /<div class="prm"><div class="axl">prompt <span class="n">13 字元<\/span><button type="button" class="lkb" data-prm="r2" data-key="prm-r2" aria-expanded="false">展開全部<\/button><\/div><pre>Build Task 2\.<\/pre><\/div>/);
    const steps = r2.slice(r2.indexOf('<ul class="stp">'), r2.indexOf('</ul>'));
    assert.ok(steps.indexOf('station/station.js') < steps.indexOf('class="cur"'), 'the step in progress is last');
    assert.match(steps, /<li class="cur"><span class="sk cmd">指令<\/span><div><span class="cm">node --test tests\/station\.test\.js<\/span><\/div><span class="pg"><i class="dot live"><\/i>進行中 <span class="tkr"/);
    assert.match(r2, /上限 40 步，另有 3 步沒列出（搜 3）；進行中的步驟不算在上限裡，永遠留在最後/);
    assert.match(r2, /<span><b>5<\/b> 步<\/span>/, 'one kept, three dropped, one in progress');
    assert.match(html, /<tr class="ax ag is-done">[\s\S]*? 回來，回傳 <b>1,102<\/b> 字元進主 context/);
    assert.match(V.dispatchHtml(live, LIVE_ROW, { open: { r2: true }, prm: { r2: true } }), /<div class="prm open">/);
});

test('two unanswered calls in the same message both render in progress, and the cap sentence still only excludes what was actually dropped', () => {
    const twoPending = Object.assign({}, live, { steps: Object.assign({}, live.steps, {
        r2: Object.assign({}, live.steps.r2, { steps: [
            { k: 'read', f: 'assets/station/station.js' },
            { k: 'read', f: 'lib/detail.js', p: true },
            { k: 'cmd', c: 'node --test tests/station.test.js', p: true },
        ] }),
    }) });
    const html = V.dispatchHtml(twoPending, LIVE_ROW, { now: T9 + 480000, live: true, open: { r2: true } });
    const r2 = html.slice(html.indexOf('<tr class="ax ag is-running">'));
    assert.equal(count(r2, /<li class="cur"/g), 2, 'both the earlier parallel call and the one cur names render in progress');
    assert.match(r2, /上限 40 步，另有 3 步沒列出（搜 3）；進行中的步驟不算在上限裡，永遠留在最後/, 'still three dropped finds, not the two in-progress steps');
});

test('the filter shows one state at a time, opens a workflow\'s phases to do it, and cannot pick a state no agent is in', () => {
    const html = V.dispatchHtml(live, LIVE_ROW, { filter: 'running', live: true, now: T9 + 480000 });
    assert.equal(count(html, /<tr class="(?:ag|wa) is-done"/g), 0);
    assert.equal(count(html, /<tr class="(?:ag|wa) is-running"/g), 2);
    assert.doesNotMatch(html, /data-in="[^"]*" hidden/, 'a phase holding a match opens');
    assert.match(html, /<button type="button" data-v="lost" aria-pressed="false" disabled title="沒有這個狀態的 agent">lost 0<\/button>/);
});

test('a session with no dispatch says what comes next, and one resumed under its id marks where the process changed', () => {
    const none = Object.assign({}, live, { rows: [], dispatches: [] });
    assert.match(V.dispatchHtml(none, LIVE_ROW, { live: true }), /<div class="emptyd"><p class="et">還沒派出 agent<\/p><p class="es">一派出，它會在下一次更新（3 秒內）出現在這裡/);
    assert.match(V.dispatchHtml(none, { state: 'down' }), /這個 session 沒有派出任何 agent/);
    const resumed = Object.assign({}, live, { since: T9 + 75000, points: [{ n: 1, t: T9 + 71000, y: 1 }] });
    const html = V.dispatchHtml(resumed, LIVE_ROW, {});
    const gap = html.indexOf('<tr class="gaprow">');
    assert.ok(gap > html.indexOf('Task 2') && gap < html.indexOf('>build<'), 'between the last dispatch before the restart and the first after it');
    assert.match(html, /session <b>\d\d:\d\d<\/b> 結束，<b>\d\d:\d\d<\/b> 以同一個 session id 接回來/);
});

test('the session header counts the running and lost agents, and the 派工 tab carries a dot while one is running', () => {
    const s = { id: 's1', state: 'live', days: [], spans: [] };
    assert.match(V.sessionHeadHtml(s, live), /<span class="runn"><i class="dot live"><\/i>2 running<\/span> · 1 個 workflow/);
    assert.match(V.sessionHeadHtml(Object.assign({}, s, { state: 'stale' }), live), /2 lost · 1 個 workflow/);
    assert.match(V.tabsHtml(s, 'dispatch', live), /派工<small>4<\/small><i class="dot live" title="2 個 agent running"><\/i><\/a>/);
    assert.doesNotMatch(V.tabsHtml(Object.assign({}, s, { state: 'stale' }), 'dispatch', live), /dot live/);
});
