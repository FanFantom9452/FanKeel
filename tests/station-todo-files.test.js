'use strict';
// The station in folder mode: each project's open and done entries on the
// data file, and 記成 TODO writing an entry file rather than a TODO.md line.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const lib = require('../lib/todo.js');
const tmp = require('./tmp.js');

global.window = { STATION: { serve: false } };

const SID = 'eeeeeeee-7777-4777-8777-777777777777';

function fixture() {
    const base = tmp('fankeel-station-todofiles-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'land', route: ['build', 'land'], active: false, claims: [],
        started: '2026-09-11T10:00:00.000Z', updated: '2026-09-11T10:05:00.000Z', configDir: cfg });
    fs.mkdirSync(path.join(r1, 'docs', 'todo'), { recursive: true });
    fs.writeFileSync(path.join(r1, 'docs', 'station.md'), '# station\n');
    fs.writeFileSync(path.join(r1, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
        { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
    lib.add(r1, { label: 'a', title: 'one', description: 'first — [station.md](docs/station.md).', state: 'ready' });
    lib.add(r1, { label: 'a', title: 'two', description: 'second', state: 'decision' });
    lib.add(r1, { label: 'b', title: 'three', description: 'third', state: 'ready' });
    lib.close(r1, 'b-1', { sha: 'abcdef1', session: SID, at: '2026-09-29' });
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

test('serialize carries each project\'s open and done entries, done with its sha and session', () => {
    const f = fixture();
    const model = station.gather({ configDir: f.cfg, roots: [f.r1], scan: [], cwd: f.r1 });
    const text = station.serialize(model);
    const data = JSON.parse(text.slice('window.STATION = '.length, text.lastIndexOf(';')));
    const row = data.projects.find((p) => path.resolve(p.root) === path.resolve(f.r1));
    const t = row.todos[0];
    const files = fs.readdirSync(path.join(f.r1, 'docs', 'todo'));
    const done = files.filter((n) => lib.parse(fs.readFileSync(path.join(f.r1, 'docs', 'todo', n), 'utf8')).state === 'done');
    assert.equal(t.mode, 'folder');
    assert.equal(t.open.length, files.length - done.length);
    assert.equal(t.done.length, done.length);
    assert.deepEqual(t.done.map((e) => [e.id, e.sha, e.session]), [['b-1', 'abcdef1', SID]]);
    assert.deepEqual(t.open.map((e) => [e.id, e.state]), [['a-1', 'ready'], ['a-2', 'decision']]);
});

test('POST /todo in folder mode writes an entry file and regenerates TODO.md; a refused one leaves no file', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js');
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const post = (o) => request(s.url + 'todo', new URLSearchParams(Object.assign({ nonce, root: f.r1, id: SID }, o)).toString());
        const dir = path.join(f.r1, 'docs', 'todo');
        const before = fs.readdirSync(dir).sort();
        const long = await post({ text: 'x'.repeat(250), link: 'docs/station.md' });
        assert.deepEqual([long.status, long.text.startsWith('too long — ')], [400, true]);
        const dead = await post({ text: 'x', link: 'docs/nope.md' });
        assert.deepEqual([dead.status, dead.text.startsWith('dead link — docs/nope.md')], [400, true]);
        assert.deepEqual(fs.readdirSync(dir).sort(), before, 'a refused entry leaves no file');
        const ok = await post({ text: '〔station〕a new question', link: 'docs/station.md' });
        assert.equal(ok.status, 201);
        assert.equal(ok.text.trim(), 'station-1');
        const made = lib.parse(fs.readFileSync(path.join(dir, 'station-1.md'), 'utf8'));
        assert.deepEqual([made.label, made.state, made.link], ['station', 'decision', 'docs/station.md']);
        assert.match(fs.readFileSync(path.join(f.r1, 'TODO.md'), 'utf8'),
            /^- 〔station〕a new question — \[station\.md\]\(docs\/station\.md\)\.$/m);
    } finally {
        s.close();
    }
});

test('an unreadable entry file gives an error row and a visible panel line, not a project with no TODO', () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.r1, 'docs', 'todo', 'bad-1.md')); // a directory named like an entry: readFileSync throws EISDIR
    const model = station.gather({ configDir: f.cfg, roots: [f.r1], scan: [], cwd: f.r1 });
    const text = station.serialize(model);
    const data = JSON.parse(text.slice('window.STATION = '.length, text.lastIndexOf(';')));
    const row = data.projects.find((p) => path.resolve(p.root) === path.resolve(f.r1));
    assert.ok(row.todos.length === 1, 'the project still has a TODO row');
    const t = row.todos[0];
    assert.equal(t.mode, 'error');
    assert.match(t.error, /EISDIR/);
    const V = require('../assets/station/station.js');
    const html = V.todoPanelHtml(t, []);
    assert.match(html, /data-block="todo-head"/);
    assert.match(html, /無法讀取 TODO：.*EISDIR/);
});
