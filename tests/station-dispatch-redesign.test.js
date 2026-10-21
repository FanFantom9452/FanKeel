'use strict';
// The session page's 派工 tab (assets/station/session-dispatch.js; design
// 2026-10-21-station-redesign §4): a strip a stage with a chip an agent sized
// by cost and coloured by model with its letter, then a row a dispatch whose
// duration and cost bars share one scale each.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const MIN = 60e3;
const T0 = Date.parse('2026-10-20T10:00:00.000Z');
const SID = 'bbbbbbbb-2222-4222-8222-222222222222';
const S1 = { id: SID, task: 'dispatch', state: 'down', stage: 'build', route: ['survey', 'build'], usd: 4, agentUsd: 2.25,
    stages: [{ stage: 'survey', from: T0, to: T0 + 10 * MIN, usd: 1, waited: null }, { stage: 'build', from: T0 + 10 * MIN, to: T0 + 70 * MIN, usd: 4, waited: null }] };
function detail(extra) {
    return Object.assign({
        rows: [{ id: 'a1', model: 'claude-sonnet-4-5', usd: 1.5, durMs: 5 * MIN, from: T0 + 15 * MIN, disp: 0, label: 'Task 1' },
            { id: 'a2', model: 'claude-opus-4-1', usd: 0.5, durMs: 2 * MIN, from: T0 + 5 * MIN, disp: 1, label: 'reader' },
            { id: 'a3', model: 'claude-fable-5', usd: 0.25, durMs: 1 * MIN, from: T0 + 90 * MIN, disp: 2, label: 'judge' }],
        dispatches: [{ text: 'build task 1', agentType: 'fankeel-implementer', surface: 'agent', out: T0 + 14 * MIN, ids: ['a1'] },
            { text: 'survey reader', agentType: 'fankeel-reader', surface: 'agent', out: T0 + 4 * MIN, ids: ['a2'] },
            { text: 'ask the judge', agentType: 'fankeel-judge', surface: 'agent', out: T0 + 89 * MIN, ids: ['a3'] },
            { text: 'lost', agentType: 'fankeel-reader', surface: 'agent', out: T0 + 20 * MIN, ids: [] }],
    }, extra);
}
function boot() {
    const p = page(['session-page.js', 'session-dispatch.js'], { sessions: [S1] });
    const tips = [];
    p.win.FK_TIP = { attr(label, vals) { tips.push([label, vals]); return ' data-t="' + label + '|' + vals.join('|') + '"'; } };
    return { D: p.M['session-dispatch.js'], tips };
}

test('the strip has a group a stage, a chip an agent coloured by model with its letter, and the chips add up to the agents', () => {
    const { D } = boot();
    const html = D.html(S1, detail());
    const strip = html.slice(html.indexOf('class="dx-strip"'), html.indexOf('class="dx-lh"'));
    assert.match(strip, /class="dx-g" style="--c:var\(--st-survey\)[^"]*"[\s\S]*class="dx-c opus"[^>]*><b>O<\/b>/);
    assert.match(strip, /class="dx-g" style="--c:var\(--st-build\)[^"]*"[\s\S]*class="dx-c sonnet"[^>]*><b>S<\/b>/);
    assert.match(strip, /--c:var\(--st-none\)[\s\S]*class="dx-c fable"[^>]*><b>F<\/b>/, 'an agent outside every stage');
    assert.ok(strip.includes('>不在任何一站<'));
    const sum = [...strip.matchAll(/data-usd="([0-9.]+)"/g)].reduce((n, m) => n + Number(m[1]), 0);
    assert.ok(Math.abs(sum - 2.25) < 1e-9, String(sum));
});

test('one row a dispatch; duration and cost each share one scale, the widest at 100%', () => {
    const { D } = boot();
    const list = D.html(S1, detail());
    const rows = list.slice(list.indexOf('class="dx-l"'));
    assert.equal((rows.match(/<li class="dx-r"/g) || []).length, 4);
    assert.match(rows, /class="dx-bar dx-dur"><i class="sonnet" style="width:100\.000%"/);
    assert.match(rows, /class="dx-bar dx-dur"><i class="opus" style="width:40\.000%"/);
    assert.match(rows, /class="dx-bar dx-usd"><i class="sonnet" style="width:100\.000%"/);
    assert.match(rows, /class="dx-bar dx-usd"><i class="opus" style="width:33\.333%"/);
    assert.match(rows, /class="dx-b none"[^>]*>–<\/i>/, 'a dispatch no agent came back from');
});

test('the key names each model present with its letter; every tooltip has at most two values', () => {
    const { D, tips } = boot();
    const html = D.html(S1, detail());
    const key = html.slice(html.indexOf('data-block="session-dispatch-key"'), html.indexOf('class="dx-strip"'));
    for (const [m, l] of [['fable', 'F'], ['opus', 'O'], ['sonnet', 'S']]) assert.ok(key.includes('<i class="dx-b ' + m + '">' + l + '</i>' + m), m);
    for (const [label, v] of tips) assert.ok(v.length <= 2, label);
});

test('a session that sent nothing says so', () => {
    const { D } = boot();
    assert.ok(D.html(S1, detail({ dispatches: [], rows: [] })).includes('這個 session 沒有派工'));
});

test('every string has English, and the classes have rules in session-dispatch.css', () => {
    const { D } = boot();
    assert.deepEqual(stringsLeft('session-dispatch.js', D.EN), []);
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'session-dispatch.css'), 'utf8');
    for (const name of ['.dx-strip', '.dx-g', '.dx-c', '.dx-b', '.dx-r', '.dx-bar', '.dx-key', '.dx .fable', '.dx .opus', '.dx .sonnet']) assert.ok(css.includes(name), name);
});
