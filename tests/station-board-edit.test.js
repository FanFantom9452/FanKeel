'use strict';
// The gate page's board routes (design §3): GET <name>.json for the page,
// POST <name> to edit, mark or drop — only while the session waits at a gate.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
const B = '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v","label":"A"}\n';
const T0 = '2026-09-11T10:00:00.000Z';

function fixture(atGate) {
    const base = tmp('fankeel-station-board-edit-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(root);
    registry.writeSession(root, SID, Object.assign({ task: 't', started: T0, stage: 'design', route: ['design'], active: true, claims: [], updated: new Date().toISOString(), configDir: cfg },
        atGate ? { gateAt: Date.now() } : {}));
    const dir = path.join(root, '.fankeel', 'build', 'task-20260911T100000');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'arch.board'), B);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(root)]: T0 }) + '\n');
    return { cfg, root, file: path.join(dir, 'arch.board') };
}

async function served(f, fn) {
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.root], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await (await fetch(s.url + 'station/station-data.js')).text();
        const nonce = JSON.parse(data.replace(/^window\.STATION = /, '').replace(/;\n$/, '')).nonce;
        await fn(s.url, nonce);
    } finally {
        s.close();
    }
}

const post = (url, fields) => fetch(url, { method: 'POST', body: new URLSearchParams(fields) });

test('GET .json carries the svg, the check, the changes and editable', async () => {
    const f = fixture(true);
    await served(f, async (url) => {
        const r = await fetch(url + 'station/board/' + SID + '/arch.json');
        assert.equal(r.status, 200);
        const j = await r.json();
        assert.match(j.svg, /^<svg /);
        assert.equal(j.check.ok, true);
        assert.deepEqual(j.changes, []);
        assert.equal(j.editable, true);
        assert.deepEqual(j.categories, Object.entries(require('../lib/board-look.js').CATEGORIES).map(([id, c]) => ({ id, name: c.name })));
    });
});

test('at a gate a rename is written and logged; a bad batch is 422 and changes nothing', async () => {
    const f = fixture(true);
    await served(f, async (url, nonce) => {
        const ok = await post(url + 'station/board/' + SID + '/arch', { nonce, op: 'edit', text: '改名 a', batch: JSON.stringify({ ops: [{ op: 'set', id: 'a', f: { label: 'Z' } }] }) });
        assert.equal(ok.status, 200);
        assert.equal((await ok.json()).changes.length, 1);
        assert.match(fs.readFileSync(f.file, 'utf8'), /"label":"Z"/);
        const before = fs.readFileSync(f.file, 'utf8');
        const bad = await post(url + 'station/board/' + SID + '/arch', { nonce, op: 'edit', batch: JSON.stringify({ ops: [{ op: 'add', rec: { edge: 'e', in: 'v', from: 'a', to: 'ghost' } }] }) });
        assert.equal(bad.status, 422);
        assert.ok((await bad.json()).errors.some((e) => e.code === 'bad-ref'));
        assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    });
});

test('not at a gate: 409; a wrong nonce: 403', async () => {
    const f = fixture(false);
    await served(f, async (url, nonce) => {
        const r = await post(url + 'station/board/' + SID + '/arch', { nonce, op: 'mark', target: 'a', note: 'x' });
        assert.equal(r.status, 409);
        const g = await post(url + 'station/board/' + SID + '/arch', { nonce: 'nope', op: 'mark', target: 'a', note: 'x' });
        assert.equal(g.status, 403);
    });
});

test('a board that fails its check is 422 with checkText', async () => {
    const f = fixture(true);
    fs.writeFileSync(f.file, '{"chartroom":1}\nnot json\n');
    await served(f, async (url) => {
        const r = await fetch(url + 'station/board/' + SID + '/arch.svg');
        assert.equal(r.status, 422);
        assert.match(await r.text(), /^error parse \(line 2\)/);
    });
});

test('an edit on a board that does not parse is 422 with checkText and writes nothing', async () => {
    const f = fixture(true);
    const bad = '{"chartroom":1}\nnot json\n';
    fs.writeFileSync(f.file, bad);
    await served(f, async (url, nonce) => {
        const r = await post(url + 'station/board/' + SID + '/arch', { nonce, op: 'edit', batch: JSON.stringify({ ops: [] }) });
        assert.equal(r.status, 422);
        assert.match(await r.text(), /^error parse \(line 2\)/);
        assert.equal(fs.readFileSync(f.file, 'utf8'), bad);
    });
});

test('undoing an edit on a board that fails its check answers with the reverted drawing', async () => {
    const f = fixture(true);
    fs.writeFileSync(f.file, B + '{"edge":"e","in":"v","from":"a","to":"ghost"}\n');
    await served(f, async (url, nonce) => {
        const ed = await post(url + 'station/board/' + SID + '/arch', { nonce, op: 'edit', text: '改名 a', batch: JSON.stringify({ ops: [{ op: 'set', id: 'a', f: { label: 'Z' } }] }) });
        assert.equal(ed.status, 200);
        const dr = await post(url + 'station/board/' + SID + '/arch', { nonce, op: 'drop', at: '0' });
        assert.equal(dr.status, 200);
        const j = await dr.json();
        assert.equal(j.check.ok, false);
        assert.doesNotMatch(fs.readFileSync(f.file, 'utf8'), /"label":"Z"/);
        assert.equal(j.svg, await require('../lib/board.js').renderBoard(fs.readFileSync(f.file, 'utf8')));
    });
});
