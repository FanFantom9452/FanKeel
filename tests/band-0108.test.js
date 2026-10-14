'use strict';
// 0.108.x band behaviour no other test asserts: the window tiers' edges, the narrow gate row, 遠端 without `here`, remoteOf's edges.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

globalThis.h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() });
const load = (name) => import(pathToFileURL(path.join(__dirname, '..', 'hooks', name + '.ts')).href);
const START = Date.parse('2026-10-11T00:00:00.000Z');
const NOW = START + 38 * 60000 + 5000;
const entry = {
    task: 't', route: ['survey', 'design', 'plan', 'build', 'verify'], stage: 'build', active: true,
    clock: { build: [START - 3600000, START] }, moves: [['build', START, 1]], waited: { build: 125000 },
};
const bare = Object.assign({}, entry, { clock: undefined, moves: undefined });
const limits = [];
const band = (m, over) => m.bandRows(Object.assign({ entry, others: [], gateUntil: null, context: null, limits, tasks: { done: 4, total: 5 }, cols: 120, now: NOW }, over));
const svgIn = (over) => Object.assign({ entry, others: [], gateUntil: null, gateAt: null, context: null, limits, tasks: { done: 4, total: 5 }, cols: 120, now: NOW }, over);
const line = (segs) => segs.map((seg) => ' '.repeat(seg.gap || 0) + seg.text).join('');
const words = (source) => [...source.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
const X = { 190: '#d7ff00', 193: '#d7ffaf', 200: '#ff00d7', 201: '#ff00ff', 208: '#ff8700', 214: '#ffaf00', 226: '#ffff00' };
const ctx = (tokens, window) => ({ tokens, at: 450000, window });

test('ctxWindowPaint switches tier one token past 500000 and past 800000', async () => {
    const { ctxWindowPaint } = await load('pane-bar');
    assert.equal(ctxWindowPaint(250000, 500000).color, X[214]);
    assert.equal(ctxWindowPaint(250000, 500001).color, X[208]);
    assert.equal(ctxWindowPaint(400000, 800000).color, X[208]);
    assert.equal(ctxWindowPaint(400000, 800001).color, X[214]);
    // The ladder starts above 800k only.
    assert.equal(ctxWindowPaint(640000, 800000).mark, '⚠');
    assert.equal(ctxWindowPaint(520001, 800001).mark, '💥');
});

test('ctxWindowPaint on a 1M window: purple at 800000, 799999 the same ramp step, each ladder rung one token under', async () => {
    const { ctxWindowPaint } = await load('pane-bar');
    assert.deepEqual(ctxWindowPaint(800000, 1000000), { color: X[201], bold: true, mark: '💥💥' });
    assert.deepEqual(ctxWindowPaint(799999, 1000000), { color: X[201], bold: true, mark: '💥💥' });
    assert.equal(ctxWindowPaint(699999, 1000000).color, '#ff00af');
    for (const [tokens, mark] of [[649999, '⚠'], [749999, '💥'], [849999, '💥💥'], [899999, '💥💥💥']]) assert.equal(ctxWindowPaint(tokens, 1000000).mark, mark, String(tokens));
});

test('bandRows draws the tier colour and mark of a 500k and an 800k window, and the 💥💥 and 💥💥💥 rungs on 1M', async () => {
    const m = await load('pane-band');
    const second = (tokens, window) => band(m, { context: ctx(tokens, window) })[1];
    const kilo = (row, text) => row.find((seg) => seg.text === text);
    let row = second(250000, 500000);
    assert.equal(kilo(row, '250k').color, X[214]);
    assert.ok(!line(row).includes('⚠'));
    row = second(400000, 500000);
    assert.equal(kilo(row, '400k').color, X[201]);
    assert.ok(line(row).endsWith('/500k ⚠'));
    row = second(400000, 800000);
    assert.equal(kilo(row, '400k').color, X[208]);
    row = second(640000, 800000);
    assert.equal(kilo(row, '640k').color, X[201]);
    assert.ok(line(row).endsWith('/800k ⚠'));
    assert.ok(line(second(750000, 1000000)).endsWith('750k/1M 💥💥'));
    assert.ok(line(second(850000, 1000000)).endsWith('850k/1M 💥💥💥'));
});

test('bandRow2Svg draws the same tier colour and mark of a 500k and an 800k window, and the 💥💥 and 💥💥💥 rungs', async () => {
    const { bandRow2Svg } = await load('pane-svg');
    const row = (tokens, window) => bandRow2Svg(svgIn({ context: ctx(tokens, window) }));
    assert.ok(row(250000, 500000).includes(X[214]));
    assert.ok(row(400000, 800000).includes(X[208]));
    assert.deepEqual(words(row(400000, 500000)), ['ctx', '400k', '/500k', '⚠']);
    assert.ok(row(400000, 500000).includes(X[201]));
    assert.deepEqual(words(row(640000, 800000)), ['ctx', '640k', '/800k', '⚠']);
    assert.deepEqual(words(row(750000, 1000000)), ['ctx', '750k', '/1M', '💥💥']);
    assert.deepEqual(words(row(850000, 1000000)), ['ctx', '850k', '/1M', '💥💥💥']);
});

test('a NaN, Infinity or negative window reads like an unsized one, in the band and in its Svg', async () => {
    const m = await load('pane-band');
    const { bandRow2Svg } = await load('pane-svg');
    const unsized = { tokens: 372000, at: 450000 };
    for (const window of [NaN, Infinity, -1]) {
        const sized = Object.assign({}, unsized, { window });
        assert.deepEqual(band(m, { context: sized }), band(m, { context: unsized }), String(window));
        assert.equal(bandRow2Svg(svgIn({ context: sized })), bandRow2Svg(svgIn({ context: unsized })), String(window));
    }
    assert.ok(line(band(m, { context: unsized })[1]).endsWith('372k/450k ⚠'));
});

test('a gate row too narrow for everything drops 遠端 first, keeping 本站', async () => {
    const m = await load('pane-band');
    const { width } = await load('pane-bar');
    const over = { gateUntil: NOW + 44500, remote: true };
    const full = line(band(m, over)[0]);
    assert.ok(full.endsWith('  遠端 ✓'));
    const cut = line(band(m, Object.assign({ cols: width(full) - 1 }, over))[0]);
    assert.ok(!cut.includes('遠端'));
    assert.ok(cut.includes('本站'));
});

test('遠端 ✓ shows with no moves and no clock, in the band and in its first Svg row', async () => {
    const m = await load('pane-band');
    const { bandRow1Svg } = await load('pane-svg');
    for (const [remote, mark] of [[true, '✓'], [false, '✗']]) {
        const row = line(band(m, { entry: bare, remote })[0]);
        assert.ok(!row.includes('本站'));
        assert.ok(row.endsWith('  遠端 ' + mark), row);
        const svg = bandRow1Svg(svgIn({ entry: bare, remote }));
        assert.ok(!words(svg).includes('本站'));
        assert.deepEqual(words(svg).slice(-2), ['遠端', mark]);
    }
});

// remoteOf through the pane's band, on a fake engine with just what the hook touches.
const ID = 'abcdef12-0000-4000-8000-000000000001';
const ROOT = 'F:/proj';
const ENTRY = ROOT + '/.fankeel/sessions/' + ID + '.json';
const live = { task: 'demo task', stage: 'design', class: 'bounded', active: true, guard: 'deny', route: ['survey', 'design', 'build'], started: '2026-10-10T20:33:51.000Z', claims: ['a.js'] };
const session = (bridge) => JSON.stringify({ sessionId: ID, bridgeSessionId: bridge });
const leaves = (n) => (n.tag === 'Text' ? [n] : (n.children || []).filter((c) => c && c.tag).flatMap(leaves));
async function rig({ entryData, files = {}, env = {} }) {
    const { register } = await load('pane');
    const hooks = {};
    register((event, a, b) => { hooks[event === 'ui.render' && a && a.component === 'AbovePrompt' ? 'band' : event] = typeof a === 'function' ? a : b; });
    const store = Object.assign({ [ENTRY]: JSON.stringify(entryData) }, files);
    const reads = [];
    const stat = (p) => ({ kind: 'file', size: String(store[p]).length, mtimeMs: 1, isLink: false });
    const ticks = [];
    const $ = {
        plugin: { root: 'F:/plugin', name: 'fankeel' },
        session: {
            id: async () => ID, root: async () => ROOT + '/sub', surfaces: async () => ['terminal'], surface: async () => 'terminal',
            usage: async () => ({ startedAt: 0, context: { tokens: 312400, window: 1000000, percent: 31 }, rateLimits: [] }),
        },
        env: { get: async (name) => env[name] },
        fs: {
            exists: async (p) => Object.keys(store).some((k) => k === p || k.startsWith(p + '/')),
            read: async (p) => { reads.push(p); return store[p]; },
            write: async (p, text) => { store[p] = text; },
            stat: async (p) => { if (!(p in store)) throw new Error('ENOENT ' + p); return stat(p); },
            list: async (dir) => Object.keys(store).filter((p) => p.startsWith(dir + '/') && !p.slice(dir.length + 1).includes('/')).map((p) => Object.assign({ name: p.slice(dir.length + 1) }, stat(p))),
        },
        clock: { now: async () => Date.parse('2026-10-12T00:00:00.000Z'), every: (ms, fn) => { ticks.push(fn); return { cancel() {} }; } },
        command: { register: async () => ({}) },
        ui: { open: async () => ({ isPlaced: true }), close: async () => {}, panes: async () => [], toast() {}, invalidate() {}, log() {}, resolve: () => ({ Box: 'Box', Text: 'Text', Button: 'Button' }) },
    };
    await hooks['session.start']($, {}, async () => ({}));
    const tick = async () => {
        await ticks[0]();
        const tree = await hooks.band($, { surface: 'terminal', props: { bodyColumns: 90 } }, async () => 'passed');
        return tree.children.map((row) => leaves(row).map((n) => n.children.join('')).join(''))[0];
    };
    return { tick, store, reads };
}

test('remoteOf finds the file under a configDir ending in / or //', async () => {
    for (const configDir of ['F:/cfg/', 'F:/cfg//']) {
        const r = await rig({ entryData: Object.assign({}, live, { configDir }), files: { 'F:/cfg/sessions/1.json': session('br') } });
        assert.match(await r.tick(), /遠端 ✓$/, configDir);
    }
});

test('remoteOf falls back to USERPROFILE/.claude when HOME is unset, and reads ✗ with no configDir, HOME or USERPROFILE', async () => {
    const files = { 'F:/home/.claude/sessions/1.json': session('br') };
    assert.match(await (await rig({ entryData: live, files, env: { USERPROFILE: 'F:/home' } })).tick(), /遠端 ✓$/);
    assert.match(await (await rig({ entryData: live, files, env: {} })).tick(), /遠端 ✗$/);
});

test('remoteOf: two files of this session with the same mtime, both bridgeSessionId null, read ✗', async () => {
    const r = await rig({ entryData: Object.assign({}, live, { configDir: 'F:/cfg' }), files: { 'F:/cfg/sessions/1.json': session(null), 'F:/cfg/sessions/2.json': session(null) } });
    assert.match(await r.tick(), /遠端 ✗$/);
});

test('remoteOf: a tick on another directory keeps the first directory cache', async () => {
    const a = 'F:/cfg/sessions/1.json';
    const r = await rig({ entryData: Object.assign({}, live, { configDir: 'F:/cfg' }), files: { [a]: session('br'), 'F:/other/sessions/1.json': session(null) } });
    assert.match(await r.tick(), /遠端 ✓$/);
    r.store[ENTRY] = JSON.stringify(Object.assign({}, live, { configDir: 'F:/other' }));
    assert.match(await r.tick(), /遠端 ✗$/);
    r.store[ENTRY] = JSON.stringify(Object.assign({}, live, { configDir: 'F:/cfg' }));
    const before = r.reads.filter((p) => p === a).length;
    assert.match(await r.tick(), /遠端 ✓$/);
    assert.equal(r.reads.filter((p) => p === a).length, before, 'the first directory was read again');
});
