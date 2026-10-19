'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const usage = require('../lib/usage.js');
const prices = require('../lib/prices.js');
const tmp = require('./tmp.js');
const { parse, problems } = require('../scripts/record.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const GOOD = [
    '要求: 每個任務收尾時留一份看得懂的紀錄。',
    '做了什麼:',
    '  - 收尾時會寫一份六欄紀錄',
    '  - 監控站會顯示這份紀錄',
    '為什麼這樣做: 紀錄原本只寫在待辦底下，直接開的任務什麼都沒留下。',
    '驗過・沒驗過: 單元測試全過；沒有在真的收尾裡跑過一次。',
    '還剩什麼: 舊任務沒有紀錄。',
].join('\n');

function seed() {
    const root = tmp('fankeel-record-');
    registry.ensureLayout(root);
    registry.writeSession(root, A, { task: '六欄紀錄', stage: 'land', route: ['design', 'land'], active: true, claims: [],
        started: new Date(Date.now() - 90 * 60000).toISOString(), updated: new Date().toISOString() });
    const cfg = path.join(root, 'cfg');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: new Date().toISOString(),
        message: { role: 'assistant', model: 'claude-sonnet-5-5', usage: { input_tokens: 1000000, output_tokens: 0 }, content: [] } }) + '\n');
    return { root, cfg, transcript: path.join(dir, A + '.jsonl') };
}

function run(s, input) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, 'write', '--session', A, '--root', s.root, '--config-dir', s.cfg], { encoding: 'utf8', input }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

const month = () => new Date().toISOString().slice(0, 7);
const recordsDir = (root) => path.join(root, 'docs', 'records');

test('a record missing 為什麼這樣做 exits 1, names the field, and writes nothing', () => {
    const s = seed();
    const out = run(s, GOOD.split('\n').filter((l) => !l.startsWith('為什麼這樣做')).join('\n'));
    assert.equal(out.code, 1);
    assert.match(out.out, /為什麼這樣做/);
    assert.equal(fs.existsSync(recordsDir(s.root)), false);
    assert.equal(registry.readSession(s.root, A).record, undefined);
});

test('a sha in 做了什麼 exits 1 and writes nothing', () => {
    const s = seed();
    const out = run(s, GOOD.replace('  - 監控站會顯示這份紀錄', '  - 監控站會顯示 4992cb98 的紀錄'));
    assert.equal(out.code, 1);
    assert.match(out.out, /4992cb98/);
    assert.equal(fs.existsSync(recordsDir(s.root)), false);
});

test('a complete record lands on the registry and as one section of the month file, and 花費 is the station formula', () => {
    const s = seed();
    const out = run(s, GOOD);
    assert.equal(out.code, 0, out.out);
    const rec = registry.readSession(s.root, A).record;
    assert.deepEqual(rec.fields.did, ['收尾時會寫一份六欄紀錄', '監控站會顯示這份紀錄']);
    assert.equal(rec.fields.ask, '每個任務收尾時留一份看得懂的紀錄。');
    // lib/station.js:775-776 prints usd + agentUsd; one million sonnet input tokens.
    const seen = usage.summariseTree(s.transcript);
    const usd = prices.costOf(seen.usage.models).usd;
    assert.equal(usd, 2);
    assert.match(rec.fields.cost, /^\$2\.00，/);
    assert.match(rec.fields.cost, /1 小時 30 分/);
    const file = path.join(recordsDir(s.root), month() + '.md');
    const text = fs.readFileSync(file, 'utf8');
    assert.equal((text.match(/^## /gm) || []).length, 1);
    assert.match(text, /^## \d{4}-\d{2}-\d{2} 六欄紀錄$/m);
    for (const name of ['要求', '做了什麼', '為什麼這樣做', '驗過・沒驗過', '花費', '還剩什麼']) assert.match(text, new RegExp('^- ' + name + '：', 'm'));
    assert.equal(rec.file, 'docs/records/' + month() + '.md');
    assert.match(out.out, new RegExp('^filed: docs/records/' + month() + '\\.md#' + rec.anchor + '$', 'm'));
    assert.match(text, new RegExp('<a id="' + rec.anchor + '"></a>'));
});

test('a second write replaces the registry copy and appends a 更正 section, leaving the first', () => {
    const s = seed();
    run(s, GOOD);
    const file = path.join(recordsDir(s.root), month() + '.md');
    const first = fs.readFileSync(file, 'utf8');
    const out = run(s, GOOD.replace('舊任務沒有紀錄。', '舊任務沒有紀錄，要另外補。'));
    assert.equal(out.code, 0, out.out);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith(first));
    assert.match(text, /^## \d{4}-\d{2}-\d{2} 六欄紀錄（更正）$/m);
    assert.equal(registry.readSession(s.root, A).record.fields.left, '舊任務沒有紀錄，要另外補。');
    assert.match(registry.readSession(s.root, A).record.anchor, /-2$/);
});

test('parse reads the five typed fields and ignores a typed 花費; problems names a long sentence', () => {
    const f = parse(GOOD + '\n花費: 很多');
    assert.equal(f.cost, undefined);
    assert.equal(f.did.length, 2);
    assert.deepEqual(problems(Object.assign({}, f, { why: '很'.repeat(81) + '。' }), []).length, 1);
});
