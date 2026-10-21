'use strict';
// The station's half of the background shells (design 2026-10-21-station-focus §5):
// a live row and its detail carry `shells` from lib/shells.js, and `shellsHtml`
// draws them as the s-shells block home-running and the focus header call.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');
const { page } = require('./station-module.js');

const SID = 'eeeeeeee-5555-4555-8555-555555555555';
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const line = (o) => JSON.stringify(o) + '\n';
const launch = (use, command, when) => line({ type: 'assistant', timestamp: when,
    message: { content: [{ type: 'tool_use', id: use, name: 'Bash', input: { command, run_in_background: true } }] } });
const started = (use, id, when) => line({ type: 'user', timestamp: when,
    message: { content: [{ type: 'tool_result', tool_use_id: use, content: 'running in background' }] },
    toolUseResult: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: id } });

// tests/station-subagents.test.js machine(), with two background shells in the
// transcript and their output files under <temp>/claude/ws-slug/<session>/tasks.
function machine(active) {
    const base = tmp('fankeel-station-shells-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.mkdirSync(proj, { recursive: true });
    registry.ensureLayout(ws);
    const now = Date.now();
    registry.writeSession(ws, SID, { task: 'shells', stage: 'build', route: ['survey', 'build'], active, claims: [],
        started: new Date(now - 600000).toISOString(), updated: new Date(now - 60000).toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
        JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: now - 900000 }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: new Date(now).toISOString() }) + '\n');
    const first = new Date(now - 120000).toISOString();
    const second = new Date(now - 60000).toISOString();
    fs.writeFileSync(path.join(proj, SID + '.jsonl'), launch('u1', 'sleep 60', first) + started('u1', 'b1', first)
        + launch('u2', 'npm test', second) + started('u2', 'b2', second));
    const temp = path.join(base, 'temp');
    const tasks = path.join(temp, 'claude', 'ws-slug', SID, 'tasks');
    fs.mkdirSync(tasks, { recursive: true });
    fs.writeFileSync(path.join(tasks, 'b1.output'), 'done\n[exited with code 0]\n');
    fs.writeFileSync(path.join(tasks, 'b2.output'), 'running\n');
    return { cfg, temp, first, second };
}

// os.tmpdir() reads these at call time: TEMP and TMP on Windows, TMPDIR elsewhere.
function withTemp(dir, fn) {
    const keep = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
    Object.assign(process.env, { TEMP: dir, TMP: dir, TMPDIR: dir });
    try {
        return fn();
    } finally {
        for (const [k, v] of Object.entries(keep)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    }
}

test('a live row carries its background shells, running first, and serialize and serializeDetail pass them on', () => {
    const m = machine(true);
    const model = withTemp(m.temp, () => station.gather({ configDir: m.cfg, details: false }));
    const row = model.registries.flatMap((r) => r.sessions).find((s) => s.sessionId === SID);
    assert.equal(row.state, 'live');
    const want = [
        { id: 'b2', command: 'npm test', state: 'running', code: null, startedAt: m.second },
        { id: 'b1', command: 'sleep 60', state: 'ended', code: 0, startedAt: m.first },
    ];
    assert.deepEqual(row.shells, want);
    const data = JSON.parse(station.serialize(model).slice('window.STATION = '.length, -2));
    assert.deepEqual(data.sessions.find((x) => x.id === SID).shells, want);
    const win = {};
    new Function('window', station.serializeDetail(Object.assign({}, row, { detail: {} })))(win);
    assert.deepEqual(win.STATION_DETAIL[SID].shells, want);
});

test('a row that is not active reads no shells, and a detail without them says none', () => {
    const m = machine(false);
    const row = withTemp(m.temp, () => station.gather({ configDir: m.cfg, details: false })).registries.flatMap((r) => r.sessions)
        .find((s) => s.sessionId === SID);
    assert.equal(row.state, 'down');
    assert.deepEqual(row.shells, []);
    const win = {};
    new Function('window', station.serializeDetail({ sessionId: SID, detail: {} }))(win);
    assert.deepEqual(win.STATION_DETAIL[SID].shells, []);
});

test('shellsHtml draws nothing for no shells, and one .sa row a shell: running with a live dot, ended with its exit code, non-zero in red', () => {
    const { V } = page();
    const now = Date.parse('2026-10-21T01:00:00.000Z');
    assert.equal(require('../assets/station/station.js').shellsHtml([], now), '');
    assert.equal(V.shellsHtml(undefined, now), '');
    const html = V.shellsHtml([
        { id: 'b2', command: 'node --test 2>&1 | tail -40', state: 'running', code: null, startedAt: '2026-10-21T00:56:00.000Z' },
        { id: 'b1', command: 'node scripts/render.js', state: 'ended', code: 1, startedAt: '2026-10-21T00:51:00.000Z' },
        { id: 'b0', command: 'git log', state: 'ended', code: 0, startedAt: '2026-10-21T00:48:00.000Z' },
    ], now);
    assert.match(html, /^<div class="s-shells" data-block="s-shells"><div class="sa-h"><b>shells<\/b><span>1 個在跑<\/span><\/div>/);
    assert.equal((html.match(/<div class="sa">/g) || []).length, 3);
    assert.match(html, /<span class="sa-desc" title="node --test 2&gt;&amp;1 \| tail -40">node --test 2&gt;&amp;1 \| tail -40<\/span>/);
    assert.match(html, /<span class="delta up"><i class="dot live"><\/i>在跑<\/span>/);
    assert.match(html, /<span class="delta dn">結束 · exit 1<\/span>/);
    assert.match(html, /<span class="delta flat">結束 · exit 0<\/span>/);
    assert.match(html, /<span class="sa-for">4m<\/span>/);
});

test('every class shellsHtml draws but its own wrapper already has a rule in station.css', () => {
    const { V } = page();
    const html = V.shellsHtml([{ id: 'b1', command: 'x', state: 'ended', code: 2, startedAt: '2026-10-21T00:00:00.000Z' },
        { id: 'b2', command: 'y', state: 'running', code: null, startedAt: '2026-10-21T00:00:00.000Z' }], Date.now());
    const drawn = new Set((html.match(/class="([^"]+)"/g) || []).flatMap((c) => c.slice(7, -1).split(' ')));
    drawn.delete('s-shells');
    for (const c of drawn) assert.match(CSS, new RegExp('\\.' + c + '[\\s{.:+,]'), c);
});

test('an ended shell with no exit code reads 結束 alone, never "exit null"', () => {
    const { V } = page();
    const html = V.shellsHtml([{ id: 'b1', command: 'x', state: 'ended', code: null, startedAt: '2026-10-21T00:00:00.000Z' }], Date.now());
    assert.match(html, /<span class="delta flat">結束<\/span>/);
    assert.doesNotMatch(html, /exit null/);
});

test('a shell with an empty startedAt shows a dash, never NaNm', () => {
    const { V } = page();
    const html = V.shellsHtml([{ id: 'b1', command: 'x', state: 'running', code: null, startedAt: '' }], Date.now());
    assert.match(html, /<span class="sa-for">—<\/span>/);
    assert.doesNotMatch(html, /NaN/);
});

test('a running session with no transcript file reads no shells and does not throw', () => {
    const m = machine(true);
    const proj = path.join(m.cfg, 'projects', 'ws-slug');
    for (const f of fs.readdirSync(proj)) fs.unlinkSync(path.join(proj, f));
    const row = withTemp(m.temp, () => station.gather({ configDir: m.cfg, details: false })).registries.flatMap((r) => r.sessions)
        .find((s) => s.sessionId === SID);
    assert.equal(row.state, 'live');
    assert.deepEqual(row.shells, []);
});
