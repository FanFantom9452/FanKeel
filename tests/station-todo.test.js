'use strict';
// 記成 TODO: the served page posts a line to /todo, which writes it under
// `## Needs a decision` only once todo-check's own check() passes it; the file
// on disk prints the line to copy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const SID = 'ffffffff-6666-4666-8666-666666666666';
const TODO = '# TODO\n\n## Ready\n\n- a thing — [station.md](docs/station.md)\n\n'
    + '## Needs a decision\n\n- a question — [station.md](docs/station.md)\n\n## Waiting\n';

function fixture() {
    const base = tmp('fankeel-station-todo-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'build', route: ['survey', 'build'], active: false, claims: [],
        started: '2026-09-11T10:00:00.000Z', updated: '2026-09-11T10:05:00.000Z', configDir: cfg });
    fs.writeFileSync(path.join(r1, 'TODO.md'), TODO);
    fs.mkdirSync(path.join(r1, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(r1, 'docs', 'station.md'), '# station\n');
    fs.writeFileSync(path.join(r1, 'docs', 'plans', 'p.md'), '# p\n');
    fs.writeFileSync(path.join(r1, '.fankeel', 'docs.json'), JSON.stringify({ preset: 'flat', buckets: [
        { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/plans', role: 'plan' }] }));
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-09-11T10:00:00.000Z' }) + '\n');
    return { cfg, r1 };
}

const request = (url, body) => new Promise((resolve, reject) => {
    const req = http.request(url, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/x-www-form-urlencoded' } : {} }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

test('todoEntry is the line todo-check reads; the prefilled texts say where they came from', () => {
    assert.equal(V.todoEntry('  a\n  b ', 'docs/station.md#x'), 'a b — [station.md](docs/station.md#x)');
    assert.equal(V.todoEntry('a', ''), 'a');
    const rise = { n: 4, from: 3, dy: 20632, cause: 'in', self: { tok: 1, label: '' }, top: [{ label: 'Read docs/x.md', chars: 14423 }] };
    assert.equal(V.riseTodo('13ebea34-67f5', rise), '〔station〕13ebea34 回合 3→4 context +21k：Read docs/x.md 14,423 字元');
    const back = { from: 'verify', to: 'build', at: Date.UTC(2026, 8, 9, 2, 59), since: Date.UTC(2026, 8, 9, 2, 15) };
    assert.equal(V.backTodo('05de9a54-0910', back), '〔station〕05de9a54 verify→build 倒退（2026-09-09 02:59，verify 待了 44m）：verify 抓到的，build 為什麼沒抓到');
});

test('the file on disk prints the line to copy; the served page a form carrying the session', () => {
    global.window.STATION.serve = false;
    const onDisk = V.todoSpot('x', 'docs/station.md', { root: 'R', id: 'I' });
    assert.match(onDisk, /<code>- x — \[station\.md\]\(docs\/station\.md\)<\/code>/);
    assert.doesNotMatch(onDisk, /data-todo|<textarea|送出/, 'the file on disk carries no form that could post');
    global.window.STATION.serve = true;
    const form = V.todoSpot('x', 'docs/station.md', { root: 'R', id: 'I' });
    assert.match(form, /data-todo-root="R" data-todo-id="I"/);
    assert.match(form, /data-todo>送出/);
    global.window.STATION.serve = false;
});

test('POST /todo writes a clean line under Needs a decision, and refuses with the rule todo-check names', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js');
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const post = (o) => request(s.url + 'todo', new URLSearchParams(Object.assign({ nonce, root: f.r1, id: SID }, o)).toString());
        const file = path.join(f.r1, 'TODO.md');
        assert.equal((await post({ nonce: 'wrong', text: 'x', link: 'docs/station.md' })).status, 403);
        assert.equal((await post({ id: 'nobody', text: 'x', link: 'docs/station.md' })).status, 404);
        const long = await post({ text: 'x'.repeat(250), link: 'docs/station.md' });
        assert.deepEqual([long.status, long.text.startsWith('too long — ')], [400, true]);
        const dead = await post({ text: 'x', link: 'docs/nope.md' });
        assert.deepEqual([dead.status, dead.text.startsWith('dead link — docs/nope.md')], [400, true]);
        const plan = await post({ text: 'x', link: 'docs/plans/p.md' });
        assert.deepEqual([plan.status, plan.text.startsWith('stale citation — docs/plans/p.md is filed as plan')], [400, true]);
        assert.equal(fs.readFileSync(file, 'utf8'), TODO, 'a refused line leaves the file as it was');
        const text = '〔station〕ffffffff 回合 3→4 context +20k：Read x';
        const ok = await post({ text, link: 'docs/station.md' });
        assert.equal(ok.status, 201);
        const line = '- ' + V.todoEntry(text, 'docs/station.md');
        assert.equal(ok.text.trim(), line);
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        assert.equal(lines.indexOf(line), lines.indexOf('- a question — [station.md](docs/station.md)') + 1);
        assert.ok(lines.indexOf(line) < lines.indexOf('## Waiting'));
        assert.deepEqual(fs.readdirSync(f.r1).filter((n) => n.startsWith('.TODO.station-')), [], 'the copy is removed');
    } finally {
        s.close();
    }
});
