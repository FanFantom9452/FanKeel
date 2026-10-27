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
