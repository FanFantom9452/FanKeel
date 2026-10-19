'use strict';
// station-28 on the page: each compaction block and each cache rewrite after
// an hour away carries the context after it, its cache write and the dollars
// to the next break, its trigger in words; a line says the breaks add to the
// main session's total (assets/station/spend-talk.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const iso = (h, mi) => new Date(2026, 9, 14, h, mi).toISOString();
const TURNS = [
    { kind: 'user', at: iso(10, 0), text: '開始' },
    { kind: 'claude', at: iso(10, 1), text: 'ok' },
    { kind: 'compact', at: iso(10, 10), text: '', trigger: 'auto', preTokens: 21000 },
    { kind: 'summary', at: iso(10, 10), text: 'Summary' },
    { kind: 'user', at: iso(11, 29), text: '回來了' },
    { kind: 'claude', at: iso(11, 31), text: '好' },
];
const SPEND = { head: 0.43, total: 0.6, sessionUsd: 0.6, marks: [
    { kind: 'compact', trigger: 'auto', at: iso(10, 10), n: 3, context: 8000, writeUsd: 0.064, usd: 0.068 },
    { kind: 'expiry', trigger: 'away', at: iso(11, 30), n: 4, context: 9000, writeUsd: 0.072, usd: 0.102 },
] };
const K = { cut: (c, s, i, extra) => '[cut ' + i + (s ? '+sum' : '') + ']' + extra, row: (t) => '[' + t.text + ']', stamp: () => '[at]' };
const T = () => page(['spend-talk.js']).M['spend-talk.js'];

test('a break\'s cost span: its trigger, the context after it, its cache write, and the dollars to the next break', () => {
    assert.equal(T().cost(SPEND.marks[0]), '<span class="cm" data-block="talk-break-cost">自動壓縮<i class="sep">·</i>之後 context <b>8k</b><i class="sep">·</i>cache write <b>$0.06</b><i class="sep">·</i>到下個斷點 <b>$0.07</b></span>');
    assert.equal(T().cost(null), '');
    assert.equal(T().why('manual'), '手動壓縮');
});

test('a rewrite after an hour away is a row of its own, with the cache mark', () => {
    const row = T().away(SPEND.marks[1], K.stamp);
    assert.match(row, /^<li class="tk-cut" data-block="talk-expiry">\[at\]<div class="cut"><div class="cutbar"><code class="ck">cache<\/code><span class="cm" data-block="talk-break-cost">離開超過 1 小時，cache 過期重寫<i class="sep">·<\/i>之後 context <b>9k<\/b>/);
    assert.match(row, /到下個斷點 <b>\$0\.10<\/b><\/span><i class="ln" aria-hidden="true"><\/i><\/div><\/div><\/li>$/);
});

test('rows hands each compaction its cost, and puts a rewrite after the prompt that came back and before the reply', () => {
    const html = T().rows(TURNS, SPEND, true, K);
    assert.ok(html.startsWith('[開始][ok][cut 2+sum]<span class="cm" data-block="talk-break-cost">自動壓縮'), html);
    const at = (s) => html.indexOf(s);
    assert.ok(at('[回來了]') < at('talk-expiry') && at('talk-expiry') < at('[好]'));
});

test('a rewrite later than every turn loaded waits for more turns, and is drawn once every turn is in', () => {
    assert.doesNotMatch(T().rows(TURNS.slice(0, 4), SPEND, false, K), /talk-expiry/);
    assert.match(T().rows(TURNS.slice(0, 4), SPEND, true, K), /talk-expiry/);
});

test('the spend line says how many breaks, the dollars before the first, their sum and the main session total', () => {
    assert.equal(T().line(SPEND), '<p class="tkc" data-block="talk-spend"><b>2</b> 個斷點；第一個之前 <b>$0.43</b>，斷點起算合計 <b>$0.60</b>，主對話總額 <b>$0.60</b></p>');
    assert.equal(T().line(null), '');
    assert.equal(T().line({ head: 1, total: 1, sessionUsd: 1, marks: [] }), '');
});

test('in English the trigger reads in English, and every string has English', () => {
    const p = page(['spend-talk.js']);
    p.win.FK_I18N = { lang: 'en' };
    assert.equal(p.M['spend-talk.js'].why('auto'), 'auto compaction');
    assert.deepEqual(stringsLeft('spend-talk.js', p.M['spend-talk.js'].EN), []);
});
