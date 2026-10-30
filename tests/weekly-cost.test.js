'use strict';
// The 製作成本 block and weekly.js render's session, vocabulary and kept
// replies (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §1-§4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wr = require('../lib/weekly-render.js');
const ws = require('../lib/weekly-store.js');
const profile = require('../lib/profile.js');
const { main } = require('../scripts/weekly.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const OPUS = { id: 'claude-opus-5-5', usd: 1.836116, input: 62, output: 22139, cacheRead: 3140083, cacheWrite5m: 0, cacheWrite1h: 95634 };

test('modelLabel says a model the way a reader would', () => {
    assert.equal(wr.modelLabel('claude-opus-5-5'), 'Opus 5.5');
    assert.equal(wr.modelLabel('claude-haiku-4-5-20251001'), 'Haiku 4.5');
    assert.equal(wr.modelLabel('claude-fable-5'), 'Fable 5');
    assert.equal(wr.modelLabel('claude-haiku-5-5>100k'), 'Haiku 5.5（長提示）');
    assert.equal(wr.modelLabel('gpt-x'), 'gpt-x');
});

test('costSection: a row per model, both cache writes in one column, US$ here, the quota line left blank', () => {
    const html = wr.costSection({ usd: 1.836116, requests: 30, verified: '2026-10-08', models: [OPUS, { id: 'gpt-x', usd: null, input: 1, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }] });
    assert.match(html, /^<aside class="cost" data-block="cost-footer" aria-labelledby="h-cost">/);
    assert.ok(html.includes('產生這份週報共用 <span class="mono">3,257,919</span> tokens（<span class="mono">30</span> 次請求），依 API 公開價格換算約 <span class="mono">US$1.84</span>。'));
    assert.ok(html.includes('<span class="m" role="rowheader">Opus 5.5</span>'));
    assert.ok(html.includes('<span role="cell"><i>cache 寫入</i>95,634</span>'));
    assert.ok(html.includes('<span role="cell"><i>API 等價</i>未定價</span>'));
    assert.ok(html.includes('<p class="cost-quota">約佔週用量 —%／5H —%（待額度換算接上）</p>'));
    assert.ok(html.includes('價格取 2026-10-08 讀到的 API 公開價目'));
});

function world() {
    const root = tmp('fankeel-weekly-cost-');
    makeRepo(path.join(root, 'alpha'), [{ date: '2026-01-01', subj: 'feat: 查詢頁', files: { 'src/a/x.js': lines(3) } }]);
    const cfg = tmp('fankeel-weekly-cost-cfg-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: new Date().toISOString(),
        message: { role: 'assistant', model: 'claude-sonnet-5-5', usage: { input_tokens: 1000000, output_tokens: 0 }, content: [] } }) + '\n');
    return { root, cfg };
}

async function run(argv, w, env) {
    const out = [];
    const err = [];
    const code = await main(argv, { configDir: w.cfg, cwd: w.root, env: env || {}, log: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
    return { code, out, err };
}

const ENV = { CLAUDE_CODE_SESSION_ID: A, CLAUDE_PID: String(process.pid) };

function events(extra) {
    return Object.assign({
        projects: { alpha: '查詢系統' },
        summary: [{ repo: 'alpha', title: '查詢頁上線', text: '可以依日期查詢。' }],
        events: [{ title: '查詢頁', repo: 'alpha', status: 'done', point: '可以查了。', did: '新增查詢頁。', why: '使用者要求。', next: '補測試。', evidence: '提交 1/1', modules: [], facets: ['使用者介面'] }],
        architecture: {}, carry: [], next: [],
    }, extra);
}

async function prepared(w, ev) {
    const data = path.join(w.root, 'data.json');
    const c = await run(['collect', '--since', '2025-12-31', '--until', '2026-01-02', '--repos', path.join(w.root, 'alpha'), '--out', data], w);
    assert.equal(c.code, 0, c.err.join('\n'));
    const file = path.join(w.root, 'events.json');
    fs.writeFileSync(file, JSON.stringify(ev));
    return { data, file, archived: path.join(w.cfg, 'fankeel', 'weekly', '2026-01-02.html') };
}

test('show.cost prices the session this shell names, and draws the block last, after the sources', async () => {
    const w = world();
    const p = await prepared(w, events({ show: { cost: true } }));
    const r = await run(['render', '--events', p.file, '--data', p.data], w, ENV);
    assert.equal(r.code, 0, r.err.join('\n'));
    const html = fs.readFileSync(p.archived, 'utf8');
    assert.ok(html.includes('<span class="m" role="rowheader">Sonnet 5.5</span>'));
    assert.ok(html.includes('US$2.00'));
    assert.ok(html.indexOf('data-block="footer"') < html.indexOf('data-block="cost-footer"'));
    assert.ok(html.indexOf('data-block="cost-footer"') < html.indexOf('</main>'));
});

test('--session names the session instead, and one with no transcript writes nothing', async () => {
    const w = world();
    const p = await prepared(w, events({ show: { cost: true } }));
    assert.equal((await run(['render', '--events', p.file, '--data', p.data, '--session', A], w)).code, 0);
    const w2 = world();
    const p2 = await prepared(w2, events({ show: { cost: true } }));
    const r = await run(['render', '--events', p2.file, '--data', p2.data, '--session', 'bbbbbbbb-1111-2222-3333-444444444444'], w2);
    assert.equal(r.code, 2);
    assert.ok(r.err.some((l) => l.startsWith('no transcript for session bbbbbbbb-1111-2222-3333-444444444444')), r.err.join('\n'));
    assert.equal(fs.existsSync(p2.archived), false);
});

test('show.cost with no --session and no session in the shell is a usage error, nothing written', async () => {
    const w = world();
    const p = await prepared(w, events({ show: { cost: true } }));
    const r = await run(['render', '--events', p.file, '--data', p.data], w, {});
    assert.equal(r.code, 2);
    assert.ok(r.err.some((l) => l.includes('pass --session <id>')), r.err.join('\n'));
    assert.equal(fs.existsSync(p.archived), false);
});

test('cost off: no block and no session needed; the guard still refuses a dollar amount anywhere else with cost on', async () => {
    const w = world();
    const p = await prepared(w, events());
    assert.equal((await run(['render', '--events', p.file, '--data', p.data], w, {})).code, 0);
    assert.doesNotMatch(fs.readFileSync(p.archived, 'utf8'), /cost-footer|US\$/);
    const w2 = world();
    const ev = events({ show: { cost: true } });
    ev.events[0].did = '花了 $12 做查詢頁。';
    const p2 = await prepared(w2, ev);
    const r = await run(['render', '--events', p2.file, '--data', p2.data], w2, ENV);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('events[0].did: $ 金額'), r.err.join('\n'));
});

test('the vocabulary is the profile\'s weekly.facets when set: collect prints it, render refuses a name outside it', async () => {
    const w = world();
    assert.equal(profile.write(profile.projectFile(w.root), 'weekly.facets', '甲:general,乙:tech').ok, true);
    const p = await prepared(w, events());
    assert.deepEqual(JSON.parse(fs.readFileSync(p.data, 'utf8')).facets, [{ name: '甲', audience: 'general' }, { name: '乙', audience: 'tech' }]);
    const r = await run(['render', '--events', p.file, '--data', p.data], w);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('events[0].facets[0]: 詞表外：使用者介面'), r.err.join('\n'));
    const ok = events();
    ok.events[0].facets = ['乙'];
    fs.writeFileSync(p.file, JSON.stringify(ok));
    assert.equal((await run(['render', '--events', p.file, '--data', p.data], w)).code, 0);
    const w2 = world();
    const p2 = await prepared(w2, events());
    assert.deepEqual(JSON.parse(fs.readFileSync(p2.data, 'utf8')).facets, wr.DEFAULT_FACETS, 'unset: the six defaults');
});

test('render inlines the filter script, and a second render for the same end date keeps the saved replies', async () => {
    const w = world();
    const qs = [{ id: 'q1', repo: 'alpha', text: '帳號開好了嗎？' }, { id: 'q2', repo: 'alpha', text: '要 PDF 嗎？' }];
    const p = await prepared(w, events({ questions: qs }));
    assert.equal((await run(['render', '--events', p.file, '--data', p.data], w)).code, 0);
    assert.ok(fs.readFileSync(p.archived, 'utf8').includes(fs.readFileSync(path.join(__dirname, '..', 'assets', 'weekly', 'report.js'), 'utf8').trim()));
    const json = ws.readArchive(w.cfg, '2026-01-02');
    json.questions[0].reply = '開好了。';
    json.questions[0].repliedAt = '2026-01-03T06:05:00.000Z';
    fs.writeFileSync(path.join(w.cfg, 'fankeel', 'weekly', '2026-01-02.json'), JSON.stringify(json));
    assert.equal((await run(['render', '--events', p.file, '--data', p.data], w)).code, 0);
    const again = ws.readArchive(w.cfg, '2026-01-02');
    assert.deepEqual(again.questions[0], { id: 'q1', repo: 'alpha', text: '帳號開好了嗎？', reply: '開好了。', repliedAt: '2026-01-03T06:05:00.000Z' });
    assert.deepEqual(again.questions[1], qs[1]);
    assert.ok(fs.readFileSync(p.archived, 'utf8').includes('<p class="ans">開好了。</p>'));
});
