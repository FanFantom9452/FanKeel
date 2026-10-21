'use strict';
// The session page, #/s/<id> (assets/station/session-page.js; design
// 2026-10-21-station-redesign §4): the head's three bars, the tabs and the
// 關卡 link only while a gate waits, 經過 on two shared scales whose cost
// segments add up to the head's total, the event chain a stage opens to, the
// landed card, and 派工 and 對話 handed to their own modules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const MIN = 60e3;
const T0 = Date.parse('2026-10-20T10:00:00.000Z');
const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
function session(extra) {
    return Object.assign({ id: SID, root: 'F:\\ws', project: 'fankeel', pkey: 'F:\\ws/fankeel', task: 'Station redesign', state: 'down',
        stage: 'build', route: ['survey', 'build'], started: new Date(T0).toISOString(), usd: 4, agentUsd: 2, hasDetail: true,
        stages: [{ stage: 'survey', from: T0, to: T0 + 10 * MIN, burn: null, usd: 1, waited: 2 * MIN },
            { stage: 'build', from: T0 + 10 * MIN, to: T0 + 70 * MIN, burn: null, usd: 4, waited: null }] }, extra);
}
const DETAIL = {
    rows: [{ id: 'a1', model: 'claude-sonnet-4-5', usd: 1.5, from: T0 + 15 * MIN, disp: 0, durMs: 5 * MIN },
        { id: 'a2', model: 'claude-opus-4-1', usd: 0.5, from: T0 + 5 * MIN, disp: 1, durMs: 2 * MIN }],
    dispatches: [{ text: 'build task 1', agentType: 'fankeel-implementer', surface: 'agent', out: T0 + 14 * MIN, ids: ['a1'] },
        { text: 'survey reader', agentType: 'fankeel-reader', surface: 'agent', out: T0 + 4 * MIN, ids: ['a2'] }],
    events: [{ t: T0 + 12 * MIN, kind: 'out', disp: 0, text: 'build task 1', agentType: 'fankeel-implementer' },
        { t: T0 + 20 * MIN, kind: 'commit', sha: 'abc1234', text: 'fix: one' },
        { t: T0 + 80 * MIN, kind: 'commit', sha: 'zzz9999', text: 'after every stage' }],
    tasks: [{ plan: 'docs/90-agent/plans/p.md', tasks: [{ n: 1, title: 'Archived plan', status: 'complete' },
        { n: 2, title: 'Due rule', status: 'no ledger line' }] }],
};
// The page as station.js boots it, with a stand-in tooltip that prints its
// label and values into data-t and keeps every call (copied out of the vm's
// realm, whose Array.prototype strict deepEqual would reject).
function boot() {
    const p = page(['session-page.js'], { sessions: [session()] });
    const tips = [];
    p.win.FK_TIP = { attr(label, vals) { tips.push([label, Array.from(vals)]); return ' data-t="' + label + '|' + vals.join('|') + '"'; } };
    return { M: p.M['session-page.js'], win: p.win, tips };
}
// One block's section, from its data-block to the first </section> after it.
function section(html, name) {
    const i = html.indexOf('data-block="' + name + '"');
    assert.ok(i >= 0, name + ' is drawn');
    return html.slice(i, html.indexOf('</section>', i));
}
const sum = (html, attr) => [...html.matchAll(new RegExp(attr + '="([0-9.e-]+)"', 'g'))].reduce((n, m) => n + Number(m[1]), 0);

test('the head draws time as 做事 and 等你回答, cost as main and agent, and one pip an agent', () => {
    const { M } = boot();
    const head = section(M.page(session(), DETAIL, { tab: 'timeline', names: {} }), 'session-head');
    assert.match(head, /class="wk" style="flex:4080000"/);
    assert.match(head, /class="wt" style="flex:120000"/);
    assert.match(head, /class="m" style="flex:4" data-usd="4"/);
    assert.match(head, /class="a" style="flex:2" data-usd="2"/);
    assert.equal((head.match(/--dx-sonnet/g) || []).length, 1);
    assert.equal((head.match(/--dx-opus/g) || []).length, 1);
    assert.ok(head.includes('>Station redesign</h1>'));
    assert.ok(head.includes('href="#/p/' + encodeURIComponent('F:\\ws/fankeel') + '"'));
});

test('every tooltip is one label and at most two values; a pip group spells its models as letters', () => {
    const { M, tips } = boot();
    M.page(session(), DETAIL, { tab: 'timeline', names: {} });
    assert.ok(tips.length > 8, tips.length + ' tooltips');
    for (const [label, v] of tips) assert.ok(v.length <= 2, label + ': ' + v.join('|'));
    assert.deepEqual(tips.find((t) => t[0] === 'build task 1')[1], ['1 個 agent', 'S']);
    assert.deepEqual(tips.find((t) => t[0] === 'survey reader')[1], ['1 個 agent', 'O']);
});

test('the tabs are 經過, 派工 and 對話, and 關卡 shows only while a gate waits', () => {
    const { M } = boot();
    const quiet = M.page(session(), DETAIL, { tab: 'timeline' });
    assert.ok(quiet.includes('href="#/s/' + SID + '" role="tab" aria-selected="true">經過</a>'));
    assert.ok(quiet.includes('href="#/s/' + SID + '/dispatch" role="tab" aria-selected="false">派工</a>'));
    assert.ok(quiet.includes('href="#/s/' + SID + '/talk" role="tab" aria-selected="false">對話</a>'));
    assert.ok(!quiet.includes('session-gate-link'));
    const served = M.page(session({ gateAt: T0 + 70 * MIN }), DETAIL, { tab: 'timeline', serve: true });
    assert.ok(served.includes('data-block="session-gate-link" href="/f/' + SID + '/gate"'));
    const file = M.page(session({ gateAt: T0 + 70 * MIN }), DETAIL, { tab: 'timeline', serve: false });
    assert.ok(file.includes('data-block="session-gate-link" href="#/s/' + SID + '/gate"'));
    assert.ok(!quiet.includes('tk-user') && !quiet.includes('talk-counts'), 'the old ten-round talk list is gone');
});

test('經過 is one row a stage on one time scale and one cost scale, and its cost segments add up to the head', () => {
    const { M } = boot();
    const s = session();
    const run = section(M.page(s, DETAIL, { tab: 'timeline' }), 'session-run');
    const survey = run.slice(run.indexOf('data-key="rd-survey"'), run.indexOf('data-key="rd-build"'));
    const build = run.slice(run.indexOf('data-key="rd-build"'));
    assert.match(survey, /class="rd-seg" style="--w:16\.667%"/);
    assert.match(build, /class="rd-seg" style="--w:100\.000%"/);
    assert.match(survey, /class="rd-cost"><span style="--w:25\.000%">/);
    assert.match(build, /class="rd-cost"><span style="--w:100\.000%">/);
    // survey $1 holds agent a2's $0.5; build $4 holds agent a1's $1.5
    assert.match(survey, /class="m" style="flex:0.5" data-usd="0.5"/);
    assert.match(survey, /class="a" style="flex:0.5" data-usd="0.5"/);
    assert.match(build, /class="m" style="flex:2.5" data-usd="2.5"/);
    assert.match(build, /class="a" style="flex:1.5" data-usd="1.5"/);
    assert.ok(build.includes('>其他<'), 'the $1 no stage holds is a row of its own');
    assert.ok(Math.abs(sum(run, 'data-usd') - (s.usd + s.agentUsd)) < 1e-9, 'the bars add up to the head');
});

test('a stage opens to the events inside its window', () => {
    const { M } = boot();
    const run = section(M.page(session(), DETAIL, { tab: 'timeline' }), 'session-run');
    const build = run.slice(run.indexOf('data-key="rd-build"'));
    assert.ok(build.includes('data-t="commit abc1234 · '));
    assert.ok(build.includes('data-t="派工 · '));
    assert.ok(!run.includes('zzz9999'), 'an event after every stage is in no chain');
    const loading = section(M.page(session(), null, { tab: 'timeline' }), 'session-run');
    assert.ok(loading.includes('讀取細節…'));
});

test('the landed card shows the plan tasks done and not done, opens a dialog, and is left out without a plan', () => {
    const { M } = boot();
    const card = section(M.page(session(), DETAIL, { tab: 'timeline' }), 'session-landed');
    assert.match(card, /class="sl-t" data-t="T1\|Archived plan">T1</);
    assert.match(card, /class="sl-t no" data-t="T2\|Due rule">T2</);
    assert.ok(card.includes('<dialog class="tdlg sl-dlg" id="sl-dlg"'));
    assert.ok(card.includes('data-sl-open="1"'));
    for (const tasks of [[], [{ plan: 'p.md', error: 'no tasks', tasks: [] }]]) {
        assert.ok(!M.page(session(), Object.assign({}, DETAIL, { tasks }), { tab: 'timeline' }).includes('session-landed'));
    }
});

test('派工 and 對話 are drawn by their modules, handed the session', () => {
    const { M, win } = boot();
    const told = [];
    win.FK_SDISP = { html: (s, x) => { told.push(['disp', s.id, x === DETAIL]); return '<i id="sd"></i>'; } };
    win.FK_STALK = { html: (id, held, o) => { told.push(['talk', id, held.total, o.stages.length]); return '<i id="tk"></i>'; } };
    assert.ok(M.page(session(), DETAIL, { tab: 'dispatch' }).includes('<i id="sd"></i>'));
    assert.ok(M.page(session(), DETAIL, { tab: 'talk', talk: { turns: [], total: 0, state: '' } }).includes('<i id="tk"></i>'));
    assert.deepEqual(told, [['disp', SID, true], ['talk', SID, 0, 2]]);
});

test('every string has English, and the classes the page draws have rules in session-page.css', () => {
    const { M } = boot();
    assert.deepEqual(stringsLeft('session-page.js', M.EN), []);
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'session-page.css'), 'utf8');
    for (const name of ['.gt-head', '.sh-viz', '.sv-time', '.sv-cost', '.sv-pips', '.ss-tabs', '.rd-stop', '.rd-seg', '.rd-cost', '.rd-ch',
        '.sl-t', '.sl-dlg', '--dx-fable:#7a4fd0', '--dx-opus:#d9601f', '--dx-sonnet:#7d8798', '--dx-fable:#8a70e6']) {
        assert.ok(css.includes(name), name);
    }
});
