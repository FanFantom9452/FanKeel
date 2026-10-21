'use strict';
// The project page (assets/station/project-page.js; design 2026-10-21-station-redesign
// §3, last bullet; mockup route-projects.html blocks project-*): head, KPI
// tiles from the same rows the overview prints, a four-week cost and landed
// trend on one scale, stage cards on one scale, TODO tabs with `todo-<id>`
// entries, recent landings.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = new Date(2026, 9, 22, 15, 0, 0).getTime();
const DAY = 864e5;
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const dayOf = (daysAgo) => { const d = new Date(NOW - daysAgo * DAY); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const A = 'F:\\w/alpha';
const R = ['survey', 'plan', 'build', 'land'];
const ses = (id, o) => Object.assign({ id, task: 'T ' + id, pkey: A, root: 'F:\\w', route: R, stage: 'land', state: 'down', gateAt: null,
    started: at(6), updated: at(2), usd: 1, agentUsd: 0, days: [], stages: [] }, o);
const S = {
    sessions: [
        ses('a1', { started: at(5), updated: at(1), days: [{ day: dayOf(1), usd: 4, who: 'main' }, { day: dayOf(1), usd: 2, who: 'agent' }],
            stages: [{ stage: 'plan', from: NOW - 5 * DAY, to: NOW - 4 * DAY, waited: 6 * 3600e3, usd: 1 }, { stage: 'build', from: NOW - 4 * DAY, to: NOW - 2 * DAY, waited: 0, usd: 3 }] }),
        ses('a2', { started: at(12), updated: at(10), days: [{ day: dayOf(10), usd: 3, who: 'main' }] }),
        ses('a3', { task: 'Running now', stage: 'build', state: 'live', updated: at(0.01) }),
        ses('z9', { pkey: 'F:\\w/other' }),
    ],
    projects: [{ todos: [{ pkey: A, open: [
        { id: 'rd-1', label: 'fix', title: 'Ready **one**', description: 'd1', state: 'ready', condition: '', due: false, dueAt: null },
        { id: 'blk-1', label: 'wait', title: 'Blocked one', description: 'd2', state: 'blocked', condition: 'after: release', due: true, dueAt: NOW - DAY },
    ] }] }],
};
const NAMES = { [A]: 'w / alpha' };

function mod(lang) {
    const { win } = page(['tip.js', 'projects-page.js', 'project-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    win.FK_PROJECT.reset();
    return { P: win.FK_PROJECT, Ps: win.FK_PROJECTS };
}
const draw = (P, o) => P.page(S, A, Object.assign({ names: NAMES, now: NOW, redraw() {} }, o));

test('the head names the project, links back and to the running session', () => {
    const { P } = mod();
    const html = draw(P);
    assert.ok(html.includes('data-block="project-head"'));
    assert.ok(html.includes('<a class="ph-back" href="#/projects">'));
    assert.ok(html.includes('<h2>alpha</h2>'));
    assert.ok(html.includes('<a class="ph-now" href="#/s/a3">'));
    assert.ok(html.includes('Running now'));
});

test('the KPI tiles print the overview\'s own row for the project', () => {
    const { P, Ps } = mod();
    const row = Ps.rowsOf(S, 30, NOW).find((r) => r.pkey === A);
    const html = draw(P);
    const tiles = [...html.matchAll(/<div class="kp" data-kp="(\w+)"><span class="kp-l">[^<]*<\/span><span class="kp-v">([^<]*)<\/span>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(tiles, [['usd', '$9.00'], ['landed', String(row.landed)], ['cpl', '$4.50'], ['dtl', '3'], ['todo', '2'], ['overdue', '1']]);
});

test('the trend is four weeks, cost main / agents and landings, each on one scale with its own tips', () => {
    const { P } = mod();
    const html = draw(P);
    assert.equal((html.match(/<span class="tr-wk" data-wk="\d"/g) || []).length, 4);
    const at3 = html.indexOf('data-wk="3"');
    const wk3 = html.slice(at3, html.indexOf('<small>', at3));
    assert.equal([...wk3.matchAll(/height:(\d+)%/g)].reduce((n, m) => n + Number(m[1]), 0), 100, 'the costliest week, main + agents, is the full height');
    assert.ok(/class="seg main" style="height:\d+%"[^>]*data-tip="/.test(wk3));
    assert.ok(/class="seg agent" style="height:\d+%"/.test(html));
    assert.ok(/class="seg land" style="height:100%"/.test(html));
});

test('stage cards share one time scale; a stage no session timed is left out', () => {
    const { P } = mod();
    const html = draw(P);
    assert.ok(html.includes('data-block="project-stages"'));
    assert.ok(/<li class="sg" data-stage="build">[\s\S]*?class="seg work" style="width:100%"/.test(html));
    assert.ok(/<li class="sg" data-stage="plan">[\s\S]*?class="seg wait" style="width:\d+%"/.test(html));
    assert.ok(!html.includes('data-stage="survey"'));
});

test('TODO tabs count each state; an entry id opens its tab and marks it', () => {
    const { P } = mod();
    let html = draw(P);
    assert.ok(html.includes('data-pp-tab="ready" aria-selected="true"'));
    assert.ok(html.includes('<li id="todo-rd-1"'));
    assert.ok(html.includes('Ready one'), 'the ** marks are dropped');
    html = draw(P, { todo: 'blk-1' });
    assert.ok(html.includes('data-pp-tab="blocked" aria-selected="true"'));
    assert.ok(html.includes('<li id="todo-blk-1" aria-current="true"'));
    assert.ok(/class="tr-due soon"/.test(html), 'a due entry is marked');
    P.onClick({ target: { getAttribute: () => 'ready', closest() { return this; } } });
    assert.equal(P.state().tab, 'ready');
});

test('recent landings list the project\'s landed sessions, newest first', () => {
    const { P } = mod();
    const html = draw(P);
    const land = html.slice(html.indexOf('data-block="project-landed"'));
    assert.ok(land.indexOf('href="#/s/a1"') < land.indexOf('href="#/s/a2"'));
    assert.ok(!land.includes('#/s/z9'));
});

test('an unknown project says so; English and every string have English', () => {
    const { P } = mod();
    assert.ok(P.page(S, 'F:\\nope', { names: {}, now: NOW }).includes('class="pp-none"'));
    const en = mod('en').P;
    assert.ok(draw(en).includes('Recent landings'));
    assert.deepEqual(stringsLeft('project-page.js', en.EN), []);
});
