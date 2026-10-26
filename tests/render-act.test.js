'use strict';
// scripts/render.js --act (entry-4): the steps file is read and refused before
// a browser is looked for, and on a machine with a browser the page is
// clicked, typed into and dragged before it is shot.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseSteps } = require('../lib/act.js');
const { findBrowser } = require('../scripts/render.js');
const tmp = require('./tmp.js');

const RENDER = path.join(__dirname, '..', 'scripts', 'render.js');
const run = (args, env) => spawnSync(process.execPath, [RENDER, ...args], { encoding: 'utf8', windowsHide: true, timeout: 90000, env: Object.assign({}, process.env, env) });

test('parseSteps reads the five kinds', () => {
    assert.deepEqual(parseSteps(JSON.stringify([{ click: '#b' }, { drag: '#d', by: [50, 0] }, { type: '#i', text: 'hi' }, { wait: 10 }, { shot: 'mid' }])), [
        { kind: 'click', sel: '#b' }, { kind: 'drag', sel: '#d', dx: 50, dy: 0 }, { kind: 'type', sel: '#i', text: 'hi' }, { kind: 'wait', ms: 10 }, { kind: 'shot', name: 'mid' },
    ]);
});

test('parseSteps refuses what it cannot run, naming the step', () => {
    for (const [text, said] of [
        ['nope', /is not JSON/], ['[]', /non-empty/], ['[{"hover":"#a"}]', /^step 1: names none/],
        ['[{"wait":-1}]', /^step 1: wait/], ['[{"shot":"../x"}]', /^step 1: shot/],
        ['[{"click":"#a"},{"drag":"#d"}]', /^step 2: drag needs by/], ['[{"type":"#i"}]', /^step 1: type needs text/],
    ]) assert.throws(() => parseSteps(text), { message: said }, text);
});

test('a bad --act file is refused before any browser is looked for', () => {
    const dir = tmp('fankeel-render-act-');
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '[{"hover":"#a"}]');
    const r = run([path.join(dir, 'x.html'), '--act', bad], { FANKEEL_BROWSER: path.join(dir, 'no-browser.exe'), FANKEEL_NO_FALLBACK: '1' });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /^render: --act step 1: names none/);
});

test('--act takes one page, not --config', () => {
    const dir = tmp('fankeel-render-act-');
    const steps = path.join(dir, 's.json');
    fs.writeFileSync(steps, '[{"wait":1}]');
    const r = run(['--config', '--act', steps], { FANKEEL_NO_FALLBACK: '1' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--act takes one page/);
});

test('with a browser, the steps run on the page before it is shot @slow', { skip: findBrowser() ? false : 'no Chromium-family browser on this machine' }, () => {
    const dir = tmp('fankeel-render-act-');
    const page = path.join(dir, 'page.html');
    fs.writeFileSync(page, '<!doctype html><meta charset="utf-8"><body style="margin:0">'
        + '<button id="b" onclick="this.textContent=\'pressed\'">go</button>'
        + '<input id="i" oninput="this.setAttribute(\'data-v\', this.value)">'
        + '<div id="d" style="width:200px;height:200px;background:#ccc" onpointerdown="this.dataset.x0=event.clientX"'
        + ' onpointerup="this.setAttribute(\'data-dx\', Math.round(event.clientX - this.dataset.x0))"></div>');
    const steps = path.join(dir, 'steps.json');
    fs.writeFileSync(steps, JSON.stringify([{ click: '#b' }, { type: '#i', text: 'hello' }, { drag: '#d', by: [50, 0] }, { shot: 'mid' }]));
    const out = path.join(dir, 'out');
    const r = run([page, '--act', steps, '--out', out, '--size', '800,600']);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trim().split(/\r?\n/), [path.join(out, 'mid.png'), path.join(out, 'render.png'), path.join(out, 'render.html')]);
    const html = fs.readFileSync(path.join(out, 'render.html'), 'utf8');
    assert.match(html, />pressed</);
    assert.match(html, /data-v="hello"/);
    assert.match(html, /data-dx="50"/);
    assert.ok(fs.statSync(path.join(out, 'mid.png')).size > 0);
});
