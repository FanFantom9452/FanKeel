'use strict';
// station-66: the phone's gate screen draws the report's mermaid diagrams over the gate card
// (phone.json `diagrams`, lib/mobile.js), narrowed to the phone by mobile.css.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../assets/station/mobile.js');

const read = (n) => fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', n), 'utf8');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const NOW = new Date(2026, 9, 30, 10, 0).getTime();
const ID = 'aaaaaaaa-5';
const Q = [{ question: '往下走？', multiSelect: false, options: [{ label: 'build (Recommended)' }, { label: '再想想' }] }];
const HOME = { host: 'h', at: NOW, device: null, gates: [], tasks: [], stopped: [], done: [] };
const APP = { mode: 'app', open: {} };
const DIAGRAMS = [{ line: 3, code: 'flowchart TD\n  A["Start"] --> B["<b>Done</b>"]' }, { line: 12, code: 'flowchart LR\n  X --> Y' }];
const gate = (extra) => Object.assign({ id: ID, root: '/w', task: 't5', project: 'proj', stage: 'survey', route: ['survey', 'design'], state: 'gate', attached: false,
    waiting: null, chat: [], gate: { questions: Q, until: NOW + 760e3 }, diagrams: DIAGRAMS, background: [], at: NOW, holdUntil: null, context: null, limits: null }, extra);
const screen = (p) => P.screen(HOME, P.parseRoute('#/s/' + ID), NOW, APP, p);

test('a held gate draws its report\'s diagrams in .gc-dg, in order, before the gate card; the source is escaped', () => {
    const html = screen(gate());
    const at = html.indexOf('<section class="gc-dg"');
    assert.ok(at > 0 && at < html.indexOf('<form class="gc gopts"'));
    assert.equal((html.match(/<figure class="dg" data-mermaid data-l="/g) || []).length, 2);
    assert.ok(html.indexOf('data-l="3"') < html.indexOf('data-l="12"'));
    assert.ok(html.includes('&lt;b&gt;Done&lt;/b&gt;') && !html.includes('<b>Done</b>'));
    assert.ok(html.includes('點圖上的方塊標記它'));
});

test('no diagrams, or a gate that is not held, draws no .gc-dg', () => {
    assert.doesNotMatch(screen(gate({ diagrams: [] })), /gc-dg/);
    assert.doesNotMatch(screen(gate({ diagrams: undefined })), /gc-dg/);
    assert.doesNotMatch(screen(gate({ state: 'running', gate: null })), /gc-dg/);
});

test('English: the diagram strings are in both tables and the English screen\'s heading holds no CJK', () => {
    for (const k of ['dg.label', 'dg.hint', 'dg.marked']) assert.ok(P.STR.zh[k] && P.STR.en[k], k);
    assert.equal(P.STR.zh['dg.marked'], '標記：');
    assert.equal(P.STR.en['dg.marked'], 'Marked: ');
    P.setLang('en');
    try {
        const ascii = JSON.parse(JSON.stringify(gate()).replace(/[^\x00-\x7f]+/g, 'x'));
        const html = screen(ascii);
        assert.match(html, /<section class="gc-dg"/);
        assert.equal(CJK.exec(/<p class="gc-dgh">[\s\S]*?<\/p>/.exec(html)[0]), null);
    } finally {
        P.setLang('zh');
    }
});

test('mobile.css styles .gc-dg, its heading and its figure, and hides the desktop hint that says "on the right"', () => {
    const css = read('mobile.css');
    for (const rule of ['.gc-dg{', '.gc-dgh{', '.gc-dg .dg{', '.gc-dg .dg-hint{display:none}', '.gc-dg .dg-pan{']) assert.ok(css.includes(rule), rule);
});
