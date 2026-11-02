'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const zip = require('../lib/zip.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const NAME = '2026-11-02-e8d01398.jsonl.gz';
const LOCAL = '2026-11-01-aaaaaaaa.jsonl.gz';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const gz = (id) => zlib.gzipSync(JSON.stringify({ bundle: 1, sessions: [id], files: [id + '.jsonl'], redacted: {} }) + '\n');

function run(root, args) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8' }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

function zipTo(root, stem, items) {
    const file = path.join(root, stem + '.zip');
    fs.writeFileSync(file, zip.write(items.map(([name, data]) => ({ name, data: Buffer.isBuffer(data) ? data : Buffer.from(data) }))));
    return file;
}

test('an informal ZIP — a bundle and a retro.md, no manifest — is accepted and recorded as imported', () => {
    const root = tmp('fankeel-intake-');
    const file = zipTo(root, 'informal-2026-11-02', [['retro.md', 'retro: e8d01398 — 40 turns read, 0 hunks\nclean\n'], [NAME, gz('e8d01398')]]);
    const r = run(root, ['import', file]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^intake: imported · informal · project card no · fankeel \?$/m);
    assert.ok(fs.existsSync(path.join(root, '.fankeel', 'bundles', NAME)));
    const dir = path.join(root, '.fankeel', 'imports', 'informal-2026-11-02');
    assert.match(fs.readFileSync(path.join(dir, 'report.md'), 'utf8'), /^retro: e8d01398/);
    const intake = JSON.parse(fs.readFileSync(path.join(dir, 'intake.json'), 'utf8'));
    assert.equal(intake.source, 'imported');
    assert.equal(intake.informal, true);
    assert.equal(intake.projectCard, false);
    assert.equal(intake.fankeelVersion, null);
    assert.deepEqual(intake.bundles, [NAME]);
    assert.match(fs.readFileSync(path.join(root, '.fankeel', '.gitignore'), 'utf8'), /^imports\/$/m);
    const list = run(root, ['sessions', '--list']);
    assert.match(list.out, /e8d01398\.jsonl\.gz\s+[\d.]+ MB\s+imported\s+retro: none\s+card: no\s+fankeel \?/);
});

test('a formal export with project.md records the card and the sender\'s fankeel version', () => {
    const root = tmp('fankeel-intake-');
    const data = gz('e8d01398');
    const manifest = { export: 1, fankeel: { working: null, installed: '0.150.0' }, node: 'v22.13.0', platform: 'win32', osRelease: '10', claudeCode: [],
        bundles: [{ name: NAME, bytes: data.length, sha256: sha256(data) }] };
    const file = zipTo(root, 'retro-2026-11-02', [['manifest.json', JSON.stringify(manifest)], ['report.md', 'clean\n'], ['project.md', '# 專案卡\n'], ['bundles/' + NAME, data]]);
    const r = run(root, ['import', file]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^intake: imported · manifest · project card yes · fankeel 0\.150\.0$/m);
    const dir = path.join(root, '.fankeel', 'imports', 'retro-2026-11-02');
    assert.equal(fs.readFileSync(path.join(dir, 'project.md'), 'utf8'), '# 專案卡\n');
    const intake = JSON.parse(fs.readFileSync(path.join(dir, 'intake.json'), 'utf8'));
    assert.deepEqual([intake.informal, intake.projectCard, intake.fankeelVersion], [false, true, '0.150.0']);
    assert.match(run(root, ['sessions', '--list']).out, /imported\s+retro: none\s+card: yes\s+fankeel 0\.150\.0/);
});

test('a bundle made on this machine stays local in the list', () => {
    const root = tmp('fankeel-intake-');
    fs.mkdirSync(path.join(root, '.fankeel', 'bundles'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'bundles', LOCAL), gz('aaaaaaaa'));
    const file = zipTo(root, 'informal-x', [[NAME, gz('e8d01398')]]);
    assert.equal(run(root, ['import', file]).code, 0);
    const out = run(root, ['sessions', '--list']).out;
    assert.match(out, /aaaaaaaa\.jsonl\.gz\s+[\d.]+ MB\s+local\s+retro: none\s*$/m);
    assert.match(out, /e8d01398\.jsonl\.gz\s+[\d.]+ MB\s+imported/);
});

test('a ZIP with neither a manifest nor a top-level bundle is refused, and writes nothing', () => {
    const root = tmp('fankeel-intake-');
    const nested = zipTo(root, 'nested', [['bundles/' + NAME, gz('e8d01398')]]);
    const stray = zipTo(root, 'stray', [['notes.txt', 'hello'], ['retro.md', 'clean\n']]);
    for (const file of [nested, stray]) {
        const r = run(root, ['import', file]);
        assert.equal(r.code, 1, file);
        assert.match(r.out, /Nothing written: \S+ holds no export manifest\.json and no <date>-<id8>\.jsonl\.gz at its top level/);
    }
    assert.ok(!fs.existsSync(path.join(root, '.fankeel')));
});
