'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const KEY = 'sk-ant-' + 'x'.repeat(24);
const GOOD = [
    '要求: 收尾時把整場對話存下來。',
    '做了什麼:',
    '  - 收尾時可以匯出整場對話',
    '為什麼這樣做: 沒有原始紀錄，只能聽一個 agent 的說法。',
    '驗過・沒驗過: 單元測試全過；沒有在真的收尾裡跑過。',
    '還剩什麼: 沒有。',
].join('\n');

function seed() {
    const root = tmp('fankeel-recb-');
    registry.ensureLayout(root);
    const now = new Date().toISOString();
    registry.writeSession(root, A, { task: '匯出對話', stage: 'land', route: ['design', 'land'], active: true, claims: [], started: now, updated: now });
    fs.writeFileSync(path.join(root, '.fankeel', 'sensitive.txt'), 'Trovara\n');
    const cfg = path.join(root, 'cfg');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(path.join(dir, A, 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), JSON.stringify({ type: 'user', timestamp: now, message: { role: 'user', content: 'key ' + KEY + ' for trovara' } }) + '\n');
    fs.writeFileSync(path.join(dir, A, 'subagents', 'agent-x.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }) + '\n');
    return { root, cfg };
}

function run(s, args, input) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', s.root, '--config-dir', s.cfg], { encoding: 'utf8', input: input || '' }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

const monthFile = (root) => path.join(root, 'docs', '90-agent', 'records', new Date().toISOString().slice(0, 7) + '.md');

test('session before write is refused and writes nothing', () => {
    const s = seed();
    const r = run(s, ['session', '--session', A]);
    assert.equal(r.code, 1);
    assert.match(r.out, /record\.js write/);
    assert.equal(fs.existsSync(path.join(s.root, '.fankeel', 'bundles')), false);
});

test('session writes a masked local bundle, ignored by git, and links it under the record', () => {
    const s = seed();
    assert.equal(run(s, ['write', '--session', A], GOOD).code, 0);
    const r = run(s, ['session', '--session', A]);
    assert.equal(r.code, 0, r.out);
    const dir = path.join(s.root, '.fankeel', 'bundles');
    const [name] = fs.readdirSync(dir);
    assert.match(name, /^\d{4}-\d{2}-\d{2}-aaaaaaaa\.jsonl\.gz$/);
    const text = zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString('utf8');
    assert.ok(!text.includes(KEY), 'the key survived');
    assert.ok(text.includes('[REDACTED:key]') && text.includes('[REDACTED:word]'));
    assert.ok(text.includes(A + '/subagents/agent-x.jsonl'));
    assert.match(fs.readFileSync(path.join(s.root, '.fankeel', '.gitignore'), 'utf8'), /^bundles\/$/m);
    assert.match(fs.readFileSync(monthFile(s.root), 'utf8'), /- 對話紀錄：\.fankeel\/bundles\/\S+（[\d.]+ MB，local）/);
    assert.equal(registry.readSession(s.root, A).record.bundle.committed, false);
});

test('--commit puts a small bundle in the records bucket', () => {
    const s = seed();
    run(s, ['write', '--session', A], GOOD);
    assert.equal(run(s, ['session', '--session', A, '--commit']).code, 0);
    const dir = path.join(s.root, 'docs', '90-agent', 'records', 'sessions');
    assert.equal(fs.readdirSync(dir).length, 1);
    assert.match(fs.readFileSync(monthFile(s.root), 'utf8'), /committed）/);
});

test('sessions --list names each bundle and whether a retro of it is filed', () => {
    const s = seed();
    run(s, ['write', '--session', A], GOOD);
    run(s, ['session', '--session', A]);
    const r = run(s, ['sessions', '--list']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /\.fankeel\/bundles\/\S+aaaaaaaa\.jsonl\.gz\s+[\d.]+ MB\s+local\s+retro: none/);
});

test('appendUnder puts the line at the end of its own entry, before the next one', () => {
    const { appendUnder } = require('../scripts/record.js');
    const file = path.join(tmp('fankeel-recb-'), 'm.md');
    fs.writeFileSync(file, '# m\n\n<a id="r-1"></a>\n\n## one\n\n- 還剩什麼：沒有。\n\n<a id="r-1-2"></a>\n\n## two\n');
    assert.equal(appendUnder(file, 'r-1', '- 對話紀錄：x'), true);
    assert.equal(fs.readFileSync(file, 'utf8'), '# m\n\n<a id="r-1"></a>\n\n## one\n\n- 還剩什麼：沒有。\n- 對話紀錄：x\n\n<a id="r-1-2"></a>\n\n## two\n');
    assert.equal(appendUnder(file, 'r-9', '- y'), false);
});
