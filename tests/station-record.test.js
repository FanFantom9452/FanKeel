'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../assets/station/station.js');
const { parseReport, derive } = require('../lib/gatereport.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const FIELDS = { ask: '留一份紀錄。', did: ['寫六欄紀錄', '監控站顯示它'], why: '原本沒有。', checked: '測試全過。', cost: '$1.00，5 分，0 個 agent。', left: '舊任務沒有。' };
const S = { id: 'a', state: 'down', record: { at: '2026-10-19T10:00:00.000Z', file: 'docs/90-agent/records/2026-10.md', anchor: 'r-x', fields: FIELDS } };
const dd = (html) => [...html.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => m[1].replace(/<[^>]+>/g, '|'));

test('the detail and the page draw the same six fields in order, and the month file under them', () => {
    for (const html of [V.recordHtml(S), V.recordPageHtml(S)]) {
        const labels = [...html.matchAll(/<dt>([^<]*)<\/dt>/g)].map((m) => m[1]);
        assert.deepEqual(labels, ['要求', '做了什麼', '為什麼這樣做', '驗過・沒驗過', '花費', '還剩什麼']);
        const v = dd(html);
        assert.equal(v[0], FIELDS.ask);
        assert.match(v[1], /寫六欄紀錄\|.*監控站顯示它/);
        assert.equal(v[4], FIELDS.cost);
        assert.match(html, /docs\/90-agent\/records\/2026-10\.md/);
    }
    assert.match(V.recordHtml(S), /data-block="record"/);
    assert.match(V.recordPageHtml(S), /data-block="record-page"/);
});

test('no record is one muted line, never an empty block', () => {
    assert.match(V.recordHtml({ id: 'a', state: 'down', record: null }), /^<p class="rec-none" data-block="record-none">[^<]+<\/p>$/);
    assert.match(V.recordPageHtml({ id: 'a', state: 'live', record: null }), /^<p class="recp-none" data-block="record-page-none">[^<]+<\/p>$/);
});

test('a landed row gets its 要求 as a second row; a row with none gets nothing', () => {
    assert.match(V.listAskRow(S, 'a'), /^<tr class="ask" data-block="list-ask" data-id="a" aria-selected="true"><td><\/td><td colspan="7">.*留一份紀錄。/);
    assert.equal(V.listAskRow({ id: 'b', record: null }, 'a'), '');
});

test('record text is escaped', () => {
    const bad = { id: 'a', record: { file: 'f', fields: Object.assign({}, FIELDS, { ask: '<script>x</script>' }) } };
    assert.doesNotMatch(V.recordHtml(bad) + V.recordPageHtml(bad) + V.listAskRow(bad, 'a'), /<script>/);
});

test('land\'s gate tab shows 要求, 為什麼這樣做 and 驗過・沒驗過 from a six-field report', () => {
    const text = ['4992cb98 docs: x', '要求: 留一份紀錄。', '做了什麼:', '  - 寫六欄紀錄', '為什麼這樣做: 原本沒有。',
        '驗過・沒驗過: 測試全過。', '花費: $1.00。', '還剩什麼: 舊任務沒有。', 'suite: ok'].join('\n');
    const html = V.gateTabHtml({ stage: 'land' }, { stage: 'land', path: 'x', text, gate: null, parts: derive('land', parseReport('land', text)) }, []);
    for (const s of ['留一份紀錄。', '原本沒有。', '測試全過。']) assert.ok(html.includes(s), s);
    assert.match(html, /<ul class="gv-ship"><li>寫六欄紀錄<\/li><\/ul>/);
    assert.match(html, /<ul class="gv-open"><li>舊任務沒有。<\/li><\/ul>/);
});

test('every rec-, recp- and ask- class drawn has a rule in station.css', () => {
    const html = V.recordHtml(S) + V.recordPageHtml(S) + V.listAskRow(S, 'a') + V.recordHtml({ record: null }) + V.recordPageHtml({ record: null });
    const used = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => /^(rec|recp|ask)(-|$)/.test(c)));
    for (const c of used) assert.match(CSS, new RegExp('\\.' + c + '\\b'), c);
});
