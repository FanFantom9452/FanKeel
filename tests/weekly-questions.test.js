'use strict';
// scripts/weekly.js questions: every archived report's questions and replies,
// one line each, for a later task to find "哪週、哪個專案、問了什麼、回了什麼"
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §3), and the INIT
// line that points /fankeel at it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ws = require('../lib/weekly-store.js');
const { INIT } = require('../lib/stages.js');
const { renderInit, sizeAtReference } = require('../lib/render.js');
const { main } = require('../scripts/weekly.js');
const tmp = require('./tmp.js');

const at = '2026-01-10T06:05:00.000Z';
function world() {
    const cfg = tmp('fankeel-weekly-questions-');
    const save = (since, until, questions) => ws.save(cfg, until, {
        json: Object.assign({ since, until, generated: until, projects: [], counts: { done: 0, ongoing: 0 }, events: [], carry: [], next: [] }, questions ? { questions } : {}),
        html: '<html></html>',
    });
    save('2025-12-06', '2025-12-12', [{ id: 'q1', repo: 'Trovara', text: '驗收報告要 PDF 嗎？', reply: '要。', repliedAt: at }]);
    save('2025-12-27', '2026-01-02');
    save('2026-01-03', '2026-01-09', [
        { id: 'q1', repo: 'Trovara', text: 'Gitea 帳號\t開好了嗎？' },
        { id: 'q2', repo: 'ils-bench', text: '可以先試跑嗎？', reply: '可以，\n先用料號資料。', repliedAt: at },
    ]);
    return { cfg, root: tmp('fankeel-weekly-questions-cwd-') };
}
async function run(argv, w) {
    const out = [];
    const err = [];
    const code = await main(argv, { configDir: w.cfg, cwd: w.root, log: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
    return { code, out, err };
}

test('questions lists every report\'s questions, newest first, one line each, an old archive with none skipped', async () => {
    const r = await run(['questions'], world());
    assert.equal(r.code, 0, r.err.join('\n'));
    assert.deepEqual(r.out, [
        '2026-01-09\tTrovara\tGitea 帳號 開好了嗎？\t尚未回覆',
        '2026-01-09\tils-bench\t可以先試跑嗎？\t可以， 先用料號資料。',
        '2025-12-12\tTrovara\t驗收報告要 PDF 嗎？\t要。',
    ]);
});

test('--repo, --answered, --grep and --near narrow it, and nothing left says so', async () => {
    const w = world();
    assert.equal((await run(['questions', '--repo', 'trovara'], w)).out.length, 2, 'the project name is matched ignoring case');
    assert.deepEqual((await run(['questions', '--answered'], w)).out.map((l) => l.split('\t')[1]), ['ils-bench', 'Trovara']);
    assert.deepEqual((await run(['questions', '--grep', 'pdf'], w)).out, ['2025-12-12\tTrovara\t驗收報告要 PDF 嗎？\t要。']);
    assert.deepEqual((await run(['questions', '--grep', '料號'], w)).out.length, 1, 'the reply is searched too');
    assert.deepEqual((await run(['questions', '--near', '2026-01-05'], w)).out.map((l) => l.split('\t')[0]), ['2026-01-09', '2026-01-09']);
    assert.deepEqual((await run(['questions', '--near', '2025-12-18'], w)).out.map((l) => l.split('\t')[0]), ['2025-12-12'], 'a week either side of the range');
    assert.deepEqual((await run(['questions', '--repo', 'nobody'], w)).out, ['沒有符合的問題']);
});

test('a bad --near, or --answered given a value, is a usage error; the flags are ones skills-check can read', async () => {
    const w = world();
    assert.equal((await run(['questions', '--near', '2026-1-5'], w)).code, 2);
    assert.equal((await run(['questions', '--answered', 'yes'], w)).code, 2);
    const { acceptedFlags } = require('../lib/skills.js');
    const got = acceptedFlags(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'weekly.js'), 'utf8'));
    for (const k of ['--repo', '--near', '--grep', '--answered', '--session']) assert.ok(got.has(k), k);
});

test('INIT points a past report\'s question at weekly.js questions and into start, inside the init cap', () => {
    const line = INIT.find((r) => r.includes('weekly.js questions'));
    assert.ok(line, 'no INIT line names weekly.js questions');
    assert.match(line, /某週週報/);
    assert.match(line, /give it to `start`/);
    const out = renderInit({ sessionId: 'aaaaaaaa-1111-2222-3333-444444444444' });
    assert.ok(out.includes('<plugin>/scripts/weekly.js questions'));
    assert.ok(sizeAtReference(out) < 1400, 'init block is ' + sizeAtReference(out));
});
