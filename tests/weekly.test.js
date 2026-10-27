'use strict';
// scripts/weekly.js: the design's acceptance (docs/90-agent/plans/
// 2026-10-27-weekly-skill-design.md, 驗收) — collect's range, months, merging
// and scope groups; render's guard (a card saying "session" exits 1 and writes
// nothing) and a self-contained page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { main } = require('../scripts/weekly.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

const DEC = '# 2025-12\n\n## 2025-12-30 查詢頁上線\n\n- 要求：做查詢頁\n- 做了什麼：新增查詢頁\n- 花費：$1.00\n';
const JAN = '# 2026-01\n\n## 2026-01-02 匯出功能\n\n- 要求：做匯出\n';

function world() {
    const root = tmp('fankeel-weekly-cli-');
    makeRepo(path.join(root, 'alpha'), [
        { date: '2025-12-30', subj: 'feat: 查詢頁', files: { 'src/a/x.js': lines(3), 'src/b/y.js': lines(1), 'docs/90-agent/records/2025-12.md': DEC } },
        { date: '2026-01-02', subj: 'feat: 匯出', files: { 'src/b/y.js': lines(4), 'docs/90-agent/records/2026-01.md': JAN } },
    ]);
    makeRepo(path.join(root, 'group', 'beta'), [
        { date: '2025-12-31', subj: 'feat(api): search', files: { 'api/v1/a.js': lines(2), 'api/v2/b.js': lines(1) } },
        { date: '2026-01-01', subj: 'feat(api): paging', files: { 'api/v1/a.js': lines(6) } },
    ]);
    makeRepo(path.join(root, 'idle'), [{ date: '2025-11-01', subj: 'old', files: { 'a.js': lines(1) } }]);
    return { root, cfg: tmp('fankeel-weekly-cli-cfg-') };
}

async function run(argv, w) {
    const out = [];
    const err = [];
    const code = await main(argv, { configDir: w.cfg, cwd: w.root, log: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
    return { code, out, err };
}

const RANGE = ['--since', '2025-12-30', '--until', '2026-01-02'];

function events(did) {
    return {
        projects: { alpha: '查詢系統', beta: '介面服務' },
        summary: [{ repo: 'alpha', title: '查詢頁上線', text: '可以依日期查詢。' }],
        events: [{ title: '查詢頁', repo: 'alpha', status: 'done', point: '可以查了。', did, why: '使用者要求。', next: '補測試。', evidence: '完成紀錄 12/30', modules: ['n-src-a'] }],
        architecture: {}, carry: [], next: [{ repo: 'alpha', text: '做完匯出。' }],
    };
}

test('scan lists the repositories with commits in the range, one and two levels under the roots', async () => {
    const w = world();
    const r = await run(['scan', ...RANGE, '--roots', w.root], w);
    assert.equal(r.code, 0, r.err.join('\n'));
    const got = JSON.parse(r.out.join('\n'));
    assert.deepEqual([got.since, got.until], ['2025-12-30', '2026-01-02']);
    assert.deepEqual(got.repos.map((x) => [x.name, x.commits]), [['alpha', 2], ['beta', 2]]);
    assert.equal((await run(['scan', ...RANGE, '--roots', 'relative'], w)).code, 2);
});

test('collect writes data.json: records across two months, scope groups for the git-only repo', async () => {
    const w = world();
    const out = path.join(w.root, 'work', 'data.json');
    const r = await run(['collect', ...RANGE, '--repos', [path.join(w.root, 'alpha'), path.join(w.root, 'group', 'beta')].join(','), '--out', out], w);
    assert.equal(r.code, 0, r.err.join('\n'));
    assert.deepEqual(r.out, ['wrote: ' + out]);
    const data = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(data.repos[0].records.map((x) => x.title), ['查詢頁上線', '匯出功能']);
    assert.equal(data.repos[0].records[0].fields['花費'], undefined);
    assert.deepEqual(data.repos[1].scopes.map((s) => [s.scope, s.commits.length]), [['api', 2]]);
    assert.equal((await run(['collect', ...RANGE, '--repos', path.join(w.root, 'nope'), '--out', out], w)).code, 2);
    assert.equal((await run(['collect', '--since', '2026-01-02', '--until', '2025-12-30', '--repos', path.join(w.root, 'alpha'), '--out', out], w)).code, 2);
});

async function collected(w) {
    const data = path.join(w.root, 'data.json');
    await run(['collect', ...RANGE, '--repos', path.join(w.root, 'alpha'), '--out', data], w);
    return data;
}

test('render archives the page under fankeel/weekly, writes --out too, and opens the file when no station runs', async () => {
    const w = world();
    const data = await collected(w);
    const ev = path.join(w.root, 'events.json');
    fs.writeFileSync(ev, JSON.stringify(events('新增查詢頁。')));
    const out = path.join(w.root, 'weekly.html');
    const r = await run(['render', '--events', ev, '--data', data, '--out', out], w);
    assert.equal(r.code, 0, r.err.join('\n'));
    const archived = path.join(w.cfg, 'fankeel', 'weekly', '2026-01-02.html');
    assert.deepEqual(r.out, ['wrote: ' + out, 'wrote: ' + archived, 'open: ' + archived]);
    const html = fs.readFileSync(archived, 'utf8');
    assert.equal(fs.readFileSync(out, 'utf8'), html);
    assert.doesNotMatch(html, /\s(?:src|href)\s*=/i, 'no external reference');
    for (const b of ['header', 'summary', 'kpis', 'timeline', 'architecture', 'events', 'next', 'footer']) assert.ok(html.includes(`data-block="${b}"`), b);
    const archive = JSON.parse(fs.readFileSync(path.join(w.cfg, 'fankeel', 'weekly', '2026-01-02.json'), 'utf8'));
    assert.deepEqual(archive.counts, { done: 1, ongoing: 0 });
});

test('render refuses a card that says "session": exit 1, the card and the word named, nothing written', async () => {
    const w = world();
    const data = await collected(w);
    const ev = path.join(w.root, 'events.json');
    fs.writeFileSync(ev, JSON.stringify(events('開了一個 session 做查詢頁。')));
    const out = path.join(w.root, 'weekly.html');
    const r = await run(['render', '--events', ev, '--data', data, '--out', out], w);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('events[0].did: session'), r.err.join('\n'));
    assert.equal(fs.existsSync(out), false);
    assert.equal(fs.existsSync(path.join(w.cfg, 'fankeel', 'weekly')), false);
});

test('render refuses a word from a repository\'s .fankeel/sensitive.txt', async () => {
    const w = world();
    fs.mkdirSync(path.join(w.root, 'alpha', '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(w.root, 'alpha', '.fankeel', 'sensitive.txt'), '# names\nAcme\n');
    const data = await collected(w);
    const ev = path.join(w.root, 'events.json');
    fs.writeFileSync(ev, JSON.stringify(events('替 acme 做查詢頁。')));
    const r = await run(['render', '--events', ev, '--data', data], w);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('events[0].did: Acme'), r.err.join('\n'));
});

test('an unknown verb, a flag with no value or a missing input is a usage error', async () => {
    const w = world();
    assert.equal((await run(['nope'], w)).code, 2);
    assert.equal((await run(['scan', '--since'], w)).code, 2);
    assert.equal((await run(['render', '--events', path.join(w.root, 'none.json'), '--data', path.join(w.root, 'none.json')], w)).code, 2);
});

test('a flag not in the table is refused with exit 1, and the table is one skills-check can read', async () => {
    const w = world();
    const r = await run(['scan', ...RANGE, '--bogus', 'x'], w);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('unknown flag: --bogus'), r.err.join('\n'));
    const { acceptedFlags } = require('../lib/skills.js');
    const got = acceptedFlags(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'weekly.js'), 'utf8'));
    for (const k of ['--since', '--until', '--roots', '--repos', '--out', '--events', '--data']) assert.ok(got.has(k), k);
    assert.equal(got.has('--bogus'), false);
});
