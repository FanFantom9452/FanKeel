'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const zip = require('../lib/zip.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const WIN = process.platform === 'win32';
const HOME = WIN ? 'C:\\Users\\zedtester' : '/home/zedtester';
const SESSION = 'aaaaaaaa-1111-2222-3333-444444444444';
const A = '2026-11-01-aaaaaaaa.jsonl.gz';

function run(root, args) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8', env: { ...process.env, HOME, USERPROFILE: HOME } }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

// One bundle, one registry entry for its session, a sensitive word, and a
// map.md and CLAUDE.md that each carry the word and the home directory.
function seed({ map = true } = {}) {
    const root = tmp('fankeel-card-');
    fs.mkdirSync(path.join(root, '.fankeel', 'bundles'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'bundles', A),
        zlib.gzipSync(JSON.stringify({ bundle: 1, sessions: ['aaaaaaaa'], files: ['aaaaaaaa.jsonl'], redacted: {} }) + '\n'));
    fs.writeFileSync(path.join(root, '.fankeel', 'sensitive.txt'), 'zedsecret\n');
    if (map) fs.writeFileSync(path.join(root, '.fankeel', 'map.md'), '# demo — map\n\nread first: README.md\nzedsecret lives at ' + HOME + '\\proj\n');
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# Rules\n\n- keep four spaces\nplain prose line that is not a highlight\n## Commits\n');
    registry.ensureLayout(root);
    registry.writeSession(root, SESSION, { task: '卡片任務', stage: 'land', route: ['design', 'land'], active: false, claims: [],
        started: new Date().toISOString(), updated: new Date().toISOString() });
    return root;
}

const exported = (root, out) => path.join(root, ...(/^export: (\S+)$/m.exec(out)[1]).split('/'));
const entries = (file) => new Map(zip.read(fs.readFileSync(file)).map((e) => [e.name, e.data]));

test('--project-card adds project.md with the map, CLAUDE.md highlights and the task route, masked', () => {
    const root = seed();
    const r = run(root, ['export', '--bundles', 'aaaaaaaa', '--project-card']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^project\.md: attached$/m);
    const got = entries(exported(root, r.out));
    assert.deepEqual([...got.keys()], ['manifest.json', 'report.md', 'project.md', 'bundles/' + A]);
    const card = got.get('project.md').toString('utf8');
    assert.match(card, /^# 專案卡/);
    assert.ok(card.includes('read first: README.md'), 'the map is missing');
    assert.ok(card.includes('# Rules') && card.includes('- keep four spaces') && card.includes('## Commits'), 'CLAUDE.md headings and bullets are missing');
    assert.ok(!card.includes('plain prose line'), 'CLAUDE.md prose is not a highlight');
    assert.ok(card.includes('卡片任務') && card.includes('design → land'), 'the task route is missing');
    assert.ok(!/zedtester/i.test(card), 'the home directory survived');
    assert.ok(!card.includes('zedsecret') && card.includes('[REDACTED:word]'), 'the sensitive word survived');
});

test('without --project-card the ZIP has no project.md', () => {
    const root = seed();
    const r = run(root, ['export', '--bundles', 'aaaaaaaa']);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual([...entries(exported(root, r.out)).keys()], ['manifest.json', 'report.md', 'bundles/' + A]);
    assert.doesNotMatch(r.out, /project\.md/);
});

test('--project-card with no .fankeel/map.md is refused by name and nothing is written', () => {
    const root = seed({ map: false });
    const r = run(root, ['export', '--bundles', 'aaaaaaaa', '--project-card']);
    assert.equal(r.code, 1);
    assert.match(r.out, /Nothing written: .*map\.md/);
    assert.ok(!fs.existsSync(path.join(root, '.fankeel', 'exports')));
});
