'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';
const GOOD = [
    '要求: 回顧要留下原文。',
    '做了什麼:',
    '  - 回顧的原文會存進紀錄',
    '為什麼這樣做: 轉述會走樣。',
    '驗過・沒驗過: 單元測試全過；沒有在真的收尾裡跑過。',
    '還剩什麼: 沒有。',
].join('\n');
const HANDBACK = 'retro: ' + A + ' — 12 turns read, 1 hunks\nevidence: turn 3 — "mover committed directly"\n--- a/x.md\n+++ b/x.md';

function seed() {
    const root = tmp('fankeel-recr-');
    registry.ensureLayout(root);
    const now = new Date().toISOString();
    for (const id of [A, B]) registry.writeSession(root, id, { task: 'task ' + id.slice(0, 1), stage: 'land', route: ['design', 'land'], active: true, claims: [], started: now, updated: now });
    const agent = path.join(root, 'agent-r.jsonl');
    const write = (text) => fs.writeFileSync(agent, JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'SubagentHandback', input: { message: text } }] } }) + '\n');
    write(HANDBACK);
    return { root, agent, write };
}

function run(s, args, input) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', s.root, '--config-dir', path.join(s.root, 'cfg')], { encoding: 'utf8', input: input || '' }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

const monthFile = (root) => path.join(root, 'docs', '90-agent', 'records', new Date().toISOString().slice(0, 7) + '.md');

test('a retro is filed verbatim between its anchor and the next entry', () => {
    const s = seed();
    run(s, ['write', '--session', A], GOOD);
    run(s, ['write', '--session', B], GOOD);
    const r = run(s, ['retro', '--session', A, '--transcript', s.agent], '採納: x.md hunk 1 → fixer');
    assert.equal(r.code, 0, r.out);
    const text = fs.readFileSync(monthFile(s.root), 'utf8');
    const at = text.indexOf('<summary>retro aaaaaaaa ');
    assert.ok(at > text.indexOf('<a id="r-') && at < text.lastIndexOf('<a id="r-'), 'not under A');
    assert.ok(text.includes(HANDBACK));
    assert.ok(text.includes('採納: x.md hunk 1 → fixer'));
    assert.deepEqual([registry.readSession(s.root, A).record.retro.turns, registry.readSession(s.root, A).record.retro.hunks], [12, 1]);
});

test('a hand-back that does not open with retro: is refused and nothing changes', () => {
    const s = seed();
    run(s, ['write', '--session', A], GOOD);
    const before = fs.readFileSync(monthFile(s.root), 'utf8');
    s.write('handing back now');
    const r = run(s, ['retro', '--session', A, '--transcript', s.agent]);
    assert.equal(r.code, 1);
    assert.match(r.out, /retro: <session>/);
    assert.equal(fs.readFileSync(monthFile(s.root), 'utf8'), before);
});

test('a retro with no record yet is refused', () => {
    const s = seed();
    const r = run(s, ['retro', '--session', A, '--transcript', s.agent]);
    assert.equal(r.code, 1);
    assert.match(r.out, /record\.js write/);
});

test('--cross files a report as its own section, and refuses one with no recurring: line', () => {
    const s = seed();
    assert.equal(run(s, ['retro', '--cross'], 'nothing here').code, 1);
    const r = run(s, ['retro', '--cross'], 'recurring: mover commits — 2/3 bundles — evidence: aaaaaaaa#12, bbbbbbbb#40');
    assert.equal(r.code, 0, r.out);
    const text = fs.readFileSync(monthFile(s.root), 'utf8');
    assert.match(text, /<a id="x-\d{4}-\d{2}-\d{2}"><\/a>\n\n## \d{4}-\d{2}-\d{2} 跨 session 回顧/);
    assert.ok(text.includes('recurring: mover commits'));
});

test('--bundle files a stdin retro once, listBundles then says filed, and a second call or bad head or short id is refused', () => {
    const s = seed();
    const dir = path.join(s.root, '.fankeel', 'bundles');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '2026-10-20-cccccccc.jsonl.gz'), 'x');
    const list = () => run(s, ['sessions', '--list']).out;
    assert.match(list(), /retro: none/);
    assert.equal(run(s, ['retro', '--bundle', 'cccccccc'], 'handing back now').code, 1);
    assert.equal(fs.existsSync(monthFile(s.root)), false);
    assert.equal(run(s, ['retro', '--bundle', 'ccc'], HANDBACK).code, 1);
    assert.equal(run(s, ['retro', '--bundle', 'a"b>c d1'], HANDBACK).code, 1);
    assert.equal(fs.existsSync(monthFile(s.root)), false);
    const hb = 'retro: cccccccc-1 — 5 turns read, 0 hunks\nclean';
    const r = run(s, ['retro', '--bundle', 'cccccccc'], hb);
    assert.equal(r.code, 0, r.out);
    const text = fs.readFileSync(monthFile(s.root), 'utf8');
    assert.ok(text.includes('<a id="r-cccccccc"></a>') && text.includes(hb));
    assert.match(list(), /retro: filed/);
    const again = run(s, ['retro', '--bundle', 'cccccccc'], hb);
    assert.equal(again.code, 1);
    assert.match(again.out, /already filed/);
    assert.equal(fs.readFileSync(monthFile(s.root), 'utf8'), text);
});
