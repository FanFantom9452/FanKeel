'use strict';

// judge-5: a filed judgement shows the user its plain summary on the spot, and
// a brief that says `html: yes` gets one self-contained page beside the record.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');
const { plainOf, wantsHtml, mdToHtml, pageOf, PLAIN_MAX } = require('../lib/judgepage.js');
const askhuman = require('../lib/askhuman.js');
const board = require('../lib/board.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'judge.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const BOARD = '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v","label":"A"}\n{"node":"b","in":"v","label":"B"}\n';
const ANSWER = 'pick: b\nwhy: fewer stops\n\n## 白話\n\n選 b。就像搭車少轉一次。\n\n## Summary\n\n| 選項 | 站數 |\n|---|---|\n| a | 5 |\n| b | 3 |\n\n```chartroom\n' + BOARD + '```\n';

function seed(brief) {
    const root = tmp('fankeel-judgepage-');
    registry.ensureLayout(root);
    registry.writeSession(root, A, { task: 'pick a ramp', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: new Date().toISOString(), updated: new Date().toISOString() });
    fs.writeFileSync(path.join(root, 'brief.md'), brief);
    fs.writeFileSync(path.join(root, 'answer.md'), ANSWER);
    return root;
}

function run(root, args) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8' }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || ''), code: e.status };
    }
}

const recordArgs = (root) => ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--answer', path.join(root, 'answer.md'), '--slug', 'ramp'];

test('plainOf cuts ## 白話 up to the next heading, is null without one, and caps at PLAIN_MAX', () => {
    assert.equal(plainOf(ANSWER), '選 b。就像搭車少轉一次。');
    assert.equal(plainOf('pick: a\n## Summary\nx'), null);
    const long = plainOf('pick: a\n\n## 白話\n\n' + '長'.repeat(PLAIN_MAX + 50));
    assert.ok(long.startsWith('長'.repeat(PLAIN_MAX)));
    assert.ok(!long.startsWith('長'.repeat(PLAIN_MAX + 1)));
    assert.ok(long.endsWith('…（全文見判決檔）'));
});

test('wantsHtml reads an html: yes line in the brief and nothing else', () => {
    assert.equal(wantsHtml('# q\n\nhtml: yes\n'), true);
    assert.equal(wantsHtml('# q\n\nHTML: Yes\n'), true);
    assert.equal(wantsHtml('# q\n\nhtml: no\n'), false);
    assert.equal(wantsHtml('# q\nwe want html: yes please\n'), false);
});

test('mdToHtml draws headings, tables, lists and code, escapes markup, and links no script url', () => {
    const html = mdToHtml('# T\n\n- one\n- `two`\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nif (a < b) x();\n```\n\n<script>alert(1)</script> [ok](docs/x.md) [bad](javascript:alert(1))\n');
    assert.match(html, /<h1>T<\/h1>/);
    assert.match(html, /<ul><li>one<\/li><li><code>two<\/code><\/li><\/ul>/);
    assert.match(html, /<th>a<\/th><th>b<\/th>/);
    assert.match(html, /<td>1<\/td><td>2<\/td>/);
    assert.match(html, /<pre><code>if \(a &lt; b\) x\(\);<\/code><\/pre>/);
    assert.ok(!html.includes('<script>'));
    assert.match(html, /<a href="docs\/x\.md">ok<\/a>/);
    assert.ok(!/href="javascript:/i.test(html));
});

test('pageOf is one self-contained page: the plain summary first, the station tokens, and a chartroom fence drawn as SVG', async () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
    const html = await pageOf('---\njudged: x\n---\n\n# Which ramp?\n\n## Answer\n\n' + ANSWER, { stationCss: css });
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<title>Which ramp\?<\/title>/);
    assert.ok(html.indexOf('class="plain"') < html.indexOf('<h1>'), 'the plain summary is not first');
    assert.match(html, /--ground:/);
    assert.match(html, /<figure class="board"><svg/);
    assert.ok(!html.includes('"chartroom":1'), 'the board source was printed instead of drawn');
    assert.ok(!/<script|<link|src="http/i.test(html), 'the page reaches outside itself');
});

test('pageOf shows the 白話 section once, in the aside, not again in the body', async () => {
    const html = await pageOf('# q\n\n## 白話\n\n選 b。就像搭車少轉一次。\n\n## Summary\n\nbody text\n', {});
    assert.equal(html.split('就像搭車少轉一次').length - 1, 1);
    assert.match(html, /body text/);
});

test('a board that does not parse is shown as a note, and the page is still written', async () => {
    const html = await pageOf('# q\n\n```chartroom\nnot json\n```\n', {});
    assert.match(html, /<figure class="board"><pre class="bad">這張圖畫不出來：/);
});

test('record prints the plain block after the filed line, and writes no page unless the brief asks', () => {
    const root = seed('# Which ramp?\n');
    const r = run(root, recordArgs(root));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /\nplain:\n選 b。就像搭車少轉一次。/);
    assert.ok(!/^html: /m.test(r.out));
    const dir = path.join(root, 'docs', 'judgements');
    assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.html')), []);
});

test('record with html: yes in the brief writes the page beside the record and names it', () => {
    const root = seed('# Which ramp?\n\nhtml: yes\n');
    const r = run(root, recordArgs(root));
    assert.equal(r.code, 0, r.out);
    const html = /^html: (.+)$/m.exec(r.out);
    assert.ok(html, r.out);
    const file = html[1].trim();
    assert.ok(file.endsWith('.html'));
    assert.match(fs.readFileSync(file, 'utf8'), /<figure class="board"><svg/);
    assert.ok(fs.existsSync(file.replace(/\.html$/, '.md')));
});

test('an answer with no ## 白話 says so on the plain: line rather than printing nothing', () => {
    const root = seed('# q\n');
    fs.writeFileSync(path.join(root, 'answer.md'), 'pick: a\nwhy: x\n');
    const r = run(root, recordArgs(root));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^plain: none — /m);
});

test('judge.js html <file> writes the page for a record already filed', () => {
    const root = seed('# Which ramp?\n');
    run(root, recordArgs(root));
    const dir = path.join(root, 'docs', 'judgements');
    const md = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.md')));
    const r = run(root, ['html', md]);
    assert.equal(r.code, 0, r.out);
    assert.ok(fs.existsSync(md.replace(/\.md$/, '.html')));
    assert.match(r.out, /judgement page: /);
});

// judge-asks-human: a record whose Answer holds an `ask human:` block.
const ASK = '---\njudged: x\n---\n\n# Which ramp?\n\n## Answer\n\npick: a\nwhy: x\n\nask human:\n'
    + '  - q: 空白頁時，網址列是哪一頁？\n'
    + '    option: /gate 有紅字 → 先修那個錯誤\n      pro: 直接修真正擋住畫面的錯\n      con: 多一輪查錯\n'
    + '    option: /gate 無紅字 (assumed)\n      pro: 原因已查清\n      con: 若沒開過 console 就不成立\n'
    + '    reason: 現場畫面只有你看過\n'
    + '  - q: 要不要暫開 <gate.station>？\n'
    + '    option: 開、驗完關回 (assumed)\n      pro: 證據最直接\n      con: 要記得關回\n'
    + '    option: 不開，改用 Playwright → 以 Playwright 證明\n      pro: profile 不動\n      con: 證明的是測試用的瀏覽器\n'
    + '    reason: profile 是你釘的\n';

// The filed answer, written by askhuman's own answersOf/sectionOf so the rows match what judge.js appends.
function answeredOf(text, picks, at) {
    const p = askhuman.parse(text);
    const map = {};
    askhuman.questionsOf(p).forEach((x, i) => { map[x.question] = picks[i]; });
    const got = askhuman.answersOf(p, map);
    return text + '\n' + askhuman.sectionOf(got.rows, got.decision, at);
}

test('an ask human block adds the glance, a details per question and the wait line while unanswered', async () => {
    const html = await pageOf(ASK, {});
    assert.ok(html.includes('判官要你回答 2 題'));
    assert.ok(html.includes('data-block="glance"'));
    assert.ok(html.includes('data-block="ask-chart"'));
    assert.ok(html.includes('data-block="ask-human-pending"'));
    assert.ok(html.includes('data-block="ask-q1" open>'), 'a pending question is not open');
    assert.ok(html.includes('data-block="ask-q2" open>'));
    assert.ok(html.includes('還沒有：等你回答'));
    assert.ok(html.includes('還沒回答'));
    assert.ok(html.includes('<span class="tag">判官假設</span>'));
    assert.ok(!html.includes('你選的'), 'a pending page marks a pick');
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'ids repeat');
});

test('an answered ask human page marks each answer row, tags 偏離假設 only on the off-assumed pick, and states the decision', async () => {
    const text = answeredOf(ASK, ['/gate 無紅字', '不開，改用 Playwright'], '2026-10-30T07:12:40Z');
    const html = await pageOf(text, {});
    assert.ok(html.includes('data-block="ask-human"'));
    assert.ok(html.includes('data-block="ask-decision"'));
    assert.ok(html.includes('<span class="k">decision:</span>照 不開，改用 Playwright → 以 Playwright 證明'));
    assert.ok(html.includes('answered: 2026-10-30T07:12:40Z'));
    assert.ok(!html.includes('還沒有：等你回答'));
    assert.equal((html.match(/你選的・偏離假設/g) || []).length, 1);
    assert.equal((html.match(/<span class="tag you">你選的<\/span>/g) || []).length, 1);
    assert.equal((html.match(/<tr class="picked"><td class="opt"/g) || []).length, 1);
    assert.equal((html.match(/<tr class="picked offrow">/g) || []).length, 1);
    assert.ok(html.includes('data-block="ask-q2" open>'), 'the off-assumed question is not open');
    assert.ok(html.includes('data-block="ask-q1">'), 'the assumed question is open');
});

test('each ask human question draws one flowchart, answered or not, and the page carries no script', async () => {
    const pending = await pageOf(ASK, {});
    const answered = await pageOf(answeredOf(ASK, ['/gate 無紅字', '開、驗完關回'], '2026-10-30T07:12:40Z'), {});
    for (const html of [pending, answered]) {
        assert.equal((html.match(/<figure class="board"><svg/g) || []).length, 2);
        assert.ok(!/<script/i.test(html), 'the page has a script');
    }
});

test('a record with no ask human block, or with ask human: nothing, keeps the plain page with no view switch', async () => {
    for (const text of ['# q\n\n## 白話\n\n選 a。\n\n## Answer\n\npick: a\n', '# q\n\n## Answer\n\npick: a\n\nask human: nothing\n']) {
        const html = await pageOf(text, {});
        assert.ok(!html.includes('data-block='), 'an ask human page appeared for a record without questions');
        assert.ok(!html.includes('<input'), 'a view switch appeared');
    }
});

test('a parsed value reaches the page escaped', async () => {
    const html = await pageOf(ASK, {});
    assert.ok(html.includes('要不要暫開 &lt;gate.station&gt;？'));
    assert.ok(!html.includes('<gate.station>'));
});

test('a chart that fails to draw falls back to a note, and the rest of the page is still written', async () => {
    const real = board.renderBoard;
    board.renderBoard = async () => { throw new Error('壞了'); };
    let html;
    try {
        html = await pageOf(ASK, {});
    } finally {
        board.renderBoard = real;
    }
    assert.equal((html.match(/<pre class="bad">這張圖畫不出來：壞了<\/pre>/g) || []).length, 2);
    assert.ok(html.includes('data-block="glance"'));
    assert.ok(html.includes('data-block="ask-q1"'));
});
