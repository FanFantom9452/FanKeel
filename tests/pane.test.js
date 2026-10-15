'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// The engine gives a hooks module the global `h`; under node it is this.
globalThis.h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() });

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane.ts')).href);
const ID = 'abcdef12-0000-4000-8000-000000000001';
const ROOT = 'F:/proj';
const DIR = ROOT + '/.fankeel/build/task-20261010T203351';
const live = { task: 'demo task', stage: 'design', class: 'bounded', active: true, guard: 'deny',
    route: ['survey', 'design', 'build'], started: '2026-10-10T20:33:51.000Z', claims: ['a.js'] };
const gate = { questions: [{ question: 'Go on?', header: 'design', options: [{ label: 'Yes (Recommended)' }, { label: 'Stay' }, { label: 'Pause' }] }], at: 1000, until: Date.now() + 600000 };

function fake({ files = {}, placed = true, surfaces = ['terminal'], tokens = 312400, env = {}, reason = 'narrow' } = {}) {
    const log = { opened: [], closed: [], toasts: [], invalidated: 0, commands: [], ticks: [], ids: 0, lists: [], reads: [], logs: [],
        tokens, now: Date.parse('2026-10-12T00:00:00.000Z') };
    const store = Object.assign({}, files);
    const mtimes = {};
    const stat = (p) => ({ kind: 'file', size: String(store[p]).length, mtimeMs: p in mtimes ? mtimes[p] : 1, isLink: false });
    const $ = {
        plugin: { root: 'F:/plugin', name: 'fankeel' },
        session: {
            id: async () => { log.ids += 1; await new Promise((r) => setTimeout(r, 10)); return ID; },
            root: async () => ROOT + '/sub',
            usage: async () => ({ startedAt: 0, context: { tokens: log.tokens === null ? undefined : log.tokens, window: 1000000, percent: 31 }, rateLimits: [] }),
            surfaces: async () => surfaces,
            surface: async () => (surfaces.length ? surfaces[0] : null),
        },
        env: { get: async (name) => env[name] },
        fs: {
            exists: async (p) => Object.keys(store).some((k) => k === p || k.startsWith(p + '/')),
            read: async (p) => { log.reads.push(p); return store[p]; },
            write: async (p, text) => { store[p] = text; },
            stat: async (p) => {
                if (!(p in store)) throw new Error('ENOENT ' + p);
                return stat(p);
            },
            list: async (dir) => log.lists.push(dir) && Object.keys(store).filter((p) => p.startsWith(dir + '/') && !p.slice(dir.length + 1).includes('/'))
                .map((p) => Object.assign({ name: p.slice(dir.length + 1) }, stat(p))),
        },
        clock: { now: async () => log.now, every: (ms, fn) => { log.ticks.push({ ms, fn }); return { cancel() {} }; } },
        command: { register: async (c) => { log.commands.push(c); return { command: c.name }; } },
        ui: {
            open: async (p) => { log.opened.push(p); return placed ? { isPlaced: true } : { isPlaced: false, reason }; },
            close: async (p) => { log.closed.push(p); },
            panes: async () => (log.opened.length > log.closed.length ? [{ id: 'fankeel', isPlaced: placed }] : []),
            toast: (t) => { log.toasts.push(t); },
            invalidate: () => { log.invalidated += 1; },
            log: (m) => { log.logs.push(m); },
            resolve: () => ({ Box: 'Box', Text: 'Text', Button: 'Button' }),
        },
    };
    return { $, log, store, mtimes };
}

// Two hooks share the event `ui.render`: the Pane's stays under that name, the band's is `band`.
async function wired() {
    const { register } = await load();
    const hooks = {};
    register((event, a, b) => {
        const key = event === 'ui.render' && a && a.component === 'AbovePrompt' ? 'band' : event;
        hooks[key] = typeof a === 'function' ? a : b;
        hooks[key + ':matcher'] = typeof a === 'function' ? null : a;
    });
    return hooks;
}
const entryFile = (data) => ({ [ROOT + '/.fankeel/sessions/' + ID + '.json']: JSON.stringify(data) });
const texts = (node) => (node.tag === 'Text' || node.tag === 'Button' ? [String(node.children.join(''))] : node.children.flatMap(texts));
const buttons = (node) => (node.tag === 'Button' ? [node] : (node.children || []).filter((c) => c && c.tag).flatMap(buttons));
const leaves = (node) => (node.tag === 'Text' ? [node] : (node.children || []).filter((c) => c && c.tag).flatMap(leaves));
const bandLines = (tree) => tree.children.map((row) => leaves(row).map((n) => n.children.join('')).join(''));
// The Pane row by row, as bandLines reads the band: a row is a Box of Text (and Button) children, or one blank Text.
const paneLines = (tree) => tree.children.map((row) => texts(row).join(''));
const BAND = { props: { bodyColumns: 90 } };
const passed = async () => 'passed';

test('the constants the design names', async () => {
    const m = await load();
    assert.equal(m.PANE, 'fankeel');
    assert.equal(m.COMMAND, 'fankeel-panel');
    assert.equal(m.POLL_MS, 250);
});

test('session.start registers the command and a 250 ms poll, and opens nothing', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    let passed = false;
    await hooks['session.start']($, {}, async () => { passed = true; return {}; });
    assert.ok(passed, 'session.start did not call next');
    assert.deepEqual(log.commands.map((c) => c.name), ['fankeel-panel']);
    assert.deepEqual(log.ticks.map((t) => t.ms), [250]);
    assert.deepEqual(log.opened, []);
});

test('the command opens the pane, and closes it when it is open', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['command.run:matcher'], { command: 'fankeel-panel' });
    assert.notEqual(hooks['command.run:matcher'].command, 'fankeel-pane', 'the old name is still what the matcher names');
    const { $, log } = fake({ files: entryFile(live) });
    const first = await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
    assert.deepEqual(log.opened.map((p) => p.id), ['fankeel']);
    assert.equal(typeof first.text, 'string');
    await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
    assert.deepEqual(log.closed.map((p) => p.id), ['fankeel']);
});

test('the Pane draws the task block on top, then what is looked up, each block under one rail', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['ui.render:matcher'], { component: 'Pane', requestId: 'fankeel' });
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { notes: ['a note'] })), tokens: 400000 });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    assert.deepEqual(paneLines(tree), [
        '▌demo task',
        ' survey › design › build',
        ' ',
        '▌context  快要自動 compact 了',
        ' 留 task · stage · plan · agent · handoff',
        ' ',
        '▌notes',
        ' · a note',
        ' ',
        '▌abcdef12 · /fankeel-panel 關閉',
    ]);
    assert.doesNotMatch(paneLines(tree).join('\n'), /touched|▸|本站|2 of 3|bounded|400k|450k/);
    assert.equal(buttons(tree).length, 0);
});

test('the band above the prompt draws the stage, the dots and the minutes, then the context bar, from the registry file', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['band:matcher'], { component: 'AbovePrompt' });
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { next: 'write the plan' })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks.band($, BAND, passed);
    assert.deepEqual(bandLines(tree), ['▌FANKEEL DESIGN  ●●○  等你 0 分  遠端 ✗', '▌ctx ███░│░░░░░ 312k/1M']);
    assert.deepEqual(leaves(tree).filter((n) => n.props.color === '#5f5fd7').map((n) => n.children.join('')), ['▌', 'FANKEEL DESIGN', '●●', '▌']);
    assert.doesNotMatch(bandLines(tree).join('\n'), /demo task|write the plan|⚿|檔| of /);
    assert.equal(log.opened.length, 1, 'drawing the band opened a pane beyond the one the task opened');
});

test('a session root ending in a backslash still finds the registry file', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    $.session.root = async () => ROOT + '\\';
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /FANKEEL DESIGN/);
    assert.match(texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).join('\n'), /abcdef12 · \/fankeel-panel/);
});

test('with no active entry the Pane draws the empty block and the band is not drawn at all', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { active: false })) });
    assert.equal(await hooks.band($, BAND, passed), 'passed', 'the band drew before any tick had read the registry');
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    assert.match(texts(tree).join('\n'), /\/fankeel/);
    assert.doesNotMatch(texts(tree).join('\n'), /demo task|context|abcdef12/);
    assert.equal(await hooks.band($, BAND, passed), 'passed');
});

test('the band yields to a survey holding it', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(await hooks.band($, { props: { bodyColumns: 90, hasSurvey: true } }, passed), 'passed');
    assert.notEqual(await hooks.band($, BAND, passed), 'passed');
});

test('a tick redraws only when the registry file changed', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const after = log.invalidated;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after);
    store[ROOT + '/.fankeel/sessions/' + ID + '.json'] = JSON.stringify(Object.assign({}, live, { stage: 'build' }));
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
});

test('neighbours are the other active entries in the same sessions directory, drawn as the files they share and who shares them', async () => {
    const hooks = await wired();
    const other = { task: 'someone else', stage: 'build', active: true, updated: new Date().toISOString(), claims: ['a.js'] };
    const files = Object.assign(entryFile(live), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: JSON.stringify(other),
        [ROOT + '/.fankeel/sessions/22222222-0000-4000-8000-000000000003.json']: JSON.stringify(Object.assign({}, other, { task: 'stood down', active: false, claims: ['a.js', 'gone.js'] })),
        [ROOT + '/.fankeel/sessions/broken.json']: '{ not json',
    });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
    await log.ticks[0].fn();
    const seen = paneLines(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    assert.deepEqual(seen.filter((t) => t.startsWith('▌⚑')), ['▌⚑ a.js']);
    assert.match(seen[seen.indexOf('▌⚑ a.js') + 1], /^▌ {2}someone else @ build · \d+m$/);
    assert.doesNotMatch(seen.join('\n'), /stood down|gone\.js|共用/);
});

test('narrow terminal: the unplaced pane opened for the task is not the gate\'s to close', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files, placed: false });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    delete store[DIR + '/design-pending.json'];
    await log.ticks[0].fn();
    assert.deepEqual(log.closed, [], 'the end of the gate closed the pane the task owns');
    store[SESSION] = JSON.stringify(Object.assign({}, live, { active: false }));
    await log.ticks[0].fn();
    assert.deepEqual(log.closed.map((p) => p.id), ['fankeel'], 'the end of the task left its pane');
});

test('a pane the user closed and reopened with the command is not closed when the gate ends', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
    await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
    assert.equal(log.opened.length, 2);
    assert.equal(log.closed.length, 1);
    delete store[DIR + '/design-pending.json'];
    await log.ticks[0].fn();
    assert.equal(log.closed.length, 1, 'the mod closed a pane the user reopened');
});

test('two overlapping ticks read the files once', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await Promise.all([log.ticks[0].fn(), log.ticks[0].fn()]);
    assert.equal(log.ids, 1);
});

test('neighbours are read with the pane closed, for the band, and a file that has not changed is read once', async () => {
    const hooks = await wired();
    const OTHER = ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json';
    const other = { task: 'someone else', stage: 'build', active: true, updated: new Date().toISOString(), claims: ['a.js'] };
    const { $, log, store, mtimes } = fake({ files: Object.assign(entryFile(live), { [OTHER]: JSON.stringify(other) }) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 1, 'only the pane the task opened, and the user closed');
    assert.equal(log.closed.length, 1);
    assert.equal(log.reads.filter((p) => p === OTHER).length, 1, 'an unchanged neighbour was read again');
    assert.match(bandLines(await hooks.band($, BAND, passed)).join('\n'), /⚑1/);
    const before = log.invalidated;
    store[OTHER] = JSON.stringify(Object.assign({}, other, { claims: ['z.js'] }));
    mtimes[OTHER] = 2;
    await log.ticks[0].fn();
    assert.equal(log.reads.filter((p) => p === OTHER).length, 2);
    assert.equal(log.invalidated, before + 1);
    assert.doesNotMatch(bandLines(await hooks.band($, BAND, passed)).join('\n'), /⚑/);
});

// The command is not under `busy`, so it can run while a tick is reading files.
function midTick($, run) {
    const id = $.session.id;
    let first = true;
    $.session.id = async () => { if (first) { first = false; await run(); } return id(); };
}

test('a pane the user opens while a tick reads is not opened again, nor closed with the gate', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    midTick($, () => hooks['command.run']($, { command: 'fankeel-panel', args: '' }));
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 1, 'the tick opened the pane the user had just opened');
    delete store[DIR + '/design-pending.json'];
    await log.ticks[0].fn();
    assert.deepEqual(log.closed, [], 'the end of the gate closed the pane the user opened');
});

test('with a gate waiting the band\'s first row carries the badge and the seconds left, and never the question', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks.band($, BAND, passed);
    assert.match(bandLines(tree)[0], /^▌FANKEEL DESIGN {2}●●○ {3}gate 在等 {3}還 \d+ 秒 {2}等你 0 分 {2}遠端 ✗$/);
    assert.equal(bandLines(tree)[1], '▌ctx ███░│░░░░░ 312k/1M');
    assert.doesNotMatch(bandLines(tree).join('\n'), /Go on\?/);
    const badge = leaves(tree).find((n) => n.props.backgroundColor);
    assert.deepEqual([badge.children.join(''), badge.props.backgroundColor, badge.props.color, badge.props.bold], [' gate 在等 ', '#d7af5f', '#000000', true]);
});

test('a waiting gate is not the Pane\'s: no gate row or button, no open, no toast, and the band keeps its badge', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live), placed: false });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const opened = log.opened.length;
    store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.equal(log.opened.length, opened, 'the gate opened the Pane');
    assert.deepEqual(log.toasts, []);
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    assert.equal(buttons(tree).length, 0);
    assert.doesNotMatch(paneLines(tree).join('\n'), /gate|Go on|Stay/);
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /gate 在等 {3}還 \d+ 秒/);
});

test('the band redraws when a gate arrives and when it goes, with the minute unchanged', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const first = async () => bandLines(await hooks.band($, BAND, passed))[0];
    assert.doesNotMatch(await first(), /gate 在等/);
    const before = log.invalidated;
    store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    await log.ticks[0].fn();
    assert.equal(log.invalidated, before + 1, 'the arrival of a gate did not redraw');
    assert.match(await first(), /gate 在等 {3}還 \d+ 秒/);
    delete store[DIR + '/design-pending.json'];
    await log.ticks[0].fn();
    assert.equal(log.invalidated, before + 2, 'the end of a gate did not redraw');
    assert.doesNotMatch(await first(), /gate 在等/);
});

test('the two drawings agree: the band\'s flag counts the sessions the Pane names, and the context count is on the band alone', async () => {
    const hooks = await wired();
    const mine = Object.assign({}, live, { claims: ['a.js', 'b.js', 'c.js', 'd.js'] });
    const peer = (task, claims) => JSON.stringify({ task, stage: 'build', active: true, updated: new Date().toISOString(), claims });
    const files = Object.assign(entryFile(mine), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: peer('shares b', ['b.js']),
        [ROOT + '/.fankeel/sessions/22222222-0000-4000-8000-000000000003.json']: peer('shares c and a', ['c.js', 'a.js', 'b.js']),
        [ROOT + '/.fankeel/sessions/33333333-0000-4000-8000-000000000004.json']: peer('shares nothing', ['z.js']),
    });
    const { $, log } = fake({ files, tokens: 400000 });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const band = bandLines(await hooks.band($, BAND, passed));
    const pane = paneLines(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } }));
    assert.deepEqual(pane.filter((t) => t.startsWith('▌⚑')), ['▌⚑ a.js', '▌⚑ b.js', '▌⚑ c.js']);
    // The sessions the Pane names under its files, each once.
    const named = new Set(pane.map((t) => /^▌ {2}(.+) @ build · \d+m$/.exec(t)).filter(Boolean).map((m) => m[1]));
    assert.deepEqual([...named].sort(), ['shares b', 'shares c and a']);
    assert.equal(Number(band[1].match(/⚑(\d+)/)[1]), named.size);
    assert.doesNotMatch(band[0], /⚑/);
    assert.doesNotMatch(pane.join('\n'), /shares nothing/);
    // The tokens and the threshold are written once, on the band; the Pane's context block is there and holds no figure.
    // 400k of a 1M window is 40 percent: past the compact line, short of the band's first sign.
    assert.match(band[1], /^▌ctx \S+ 400k\/1M(?! ⚠)/);
    assert.ok(pane.includes('▌context  快要自動 compact 了'), pane.join(' | '));
    assert.doesNotMatch(pane.join('\n'), /\d+k|█|░|%/);
});

test('the context block is measured against FANKEEL_COMPACT_AT, and a new count redraws', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: '300000' } });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    // What the Pane says beside the block's name, or null with no block.
    const said = async () => {
        const all = leaves(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
        const at = all.findIndex((n) => n.children.join('') === 'context');
        return at < 0 ? null : [all[at + 1].children.join(''), all[at + 1].props.color, all[at + 1].props.bold];
    };
    assert.deepEqual(await said(), ['  已到門檻，compact 中', '#d7af5f', true]);
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ███│░░░░░░ 312k/1M');
    const after = log.invalidated;
    log.tokens = 250000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.deepEqual(await said(), ['  快要自動 compact 了', '#8a8a8a', undefined]);
    assert.match(bandLines(await hooks.band($, BAND, passed))[1], / 250k\/1M$/);
    // Four fifths of 300k is 240k.
    log.tokens = 239999;
    await log.ticks[0].fn();
    assert.equal(await said(), null);
    assert.match(bandLines(await hooks.band($, BAND, passed))[1], / 240k\/1M$/);
});

test('the band\'s context count is coloured by TokenBar\'s tier of the 1M window, bold from fifty percent', async () => {
    const hooks = await wired();
    // The threshold is 100k: the colour must not move with it.
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: '100000' } });
    await hooks['session.start']($, {}, async () => ({}));
    const count = async (tokens) => {
        log.tokens = tokens;
        await log.ticks[0].fn();
        const leaf = leaves(await hooks.band($, BAND, passed)).find((n) => n.children.join('') === Math.round(tokens / 1000) + 'k');
        return [leaf.props.color, leaf.props.bold];
    };
    assert.deepEqual(await count(5000), ['#00ff00', undefined]);
    assert.deepEqual(await count(50000), ['#5fff5f', undefined]);
    assert.deepEqual(await count(200000), ['#d7ffd7', undefined]);
    assert.deepEqual(await count(400000), ['#ffff00', undefined]);
    assert.deepEqual(await count(450000), ['#ffaf00', undefined]);
    assert.deepEqual(await count(500000), ['#ff0000', true]);
    assert.deepEqual(await count(700000), ['#ff00d7', true]);
    assert.deepEqual(await count(750000), ['#ff00ff', true]);
});

const profileFile = (data) => ({ [ROOT + '/.fankeel/profile.json']: JSON.stringify(data) });

// compact-5: the same source as hooks/compact.ts threshold, so the band and the
// Pane move with the profile's compact.at.
test('the band and the context block are measured against the profile\'s compact.at', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: Object.assign(entryFile(live), profileFile({ 'compact.at': '350000' })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ███│░░░░░░ 312k/1M');
    const pane = async () => texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    assert.ok((await pane()).includes('context'), 'no context block at 312k of 350k');
    // Four fifths of 350k is 280k.
    log.tokens = 279999;
    await log.ticks[0].fn();
    assert.ok(!(await pane()).includes('context'), 'a context block under four fifths of 350k');
    // The band's sign follows the window, not compact.at: 280k of 1M is 28 percent and carries none.
    assert.ok(!bandLines(await hooks.band($, BAND, passed))[1].endsWith('⚠'), 'the band warned at 28 percent of the window');
});

test('compact.at off draws the count with no threshold, and a context block that says no compact will run', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: Object.assign(entryFile(live), profileFile({ 'compact.at': 'off' })), tokens: 2000000 });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ██████████ 2M/1M 💀');
    const pane = paneLines(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    assert.ok(pane.includes('▌context  已到門檻，自動 compact 已關閉'), pane.join('\n'));
    assert.ok(pane.includes(' 不會自動壓縮；要壓縮請手動 /compact'), pane.join('\n'));
});

test('with no FANKEEL_COMPACT_AT the threshold is HARD, and with no token count there is no context block', async () => {
    const { HARD } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'compact.ts')).href);
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: 'soon' } });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ███░│░░░░░ 312k/1M');
    // The white line is where HARD falls in the window.
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1].indexOf('│') - '▌ctx '.length, Math.floor((HARD * 10) / 1000000));
    // Number('Infinity') is not finite: the same rule as hooks/compact.ts threshold.
    const inf = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: 'Infinity' } });
    const infHooks = await wired();
    await infHooks['session.start'](inf.$, {}, async () => ({}));
    await inf.log.ticks[0].fn();
    assert.equal(bandLines(await infHooks.band(inf.$, BAND, passed))[1], '▌ctx ███░│░░░░░ 312k/1M');
    // Four fifths of HARD is 360k: the Pane's block is there from that count, and goes with the count.
    const pane = async () => texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    assert.ok(!(await pane()).includes('context'), 'a context block under four fifths of HARD');
    log.tokens = HARD * 0.8;
    await log.ticks[0].fn();
    assert.ok((await pane()).includes('context'), 'no context block at four fifths of HARD');
    log.tokens = null;
    await log.ticks[0].fn();
    assert.ok(!(await pane()).includes('context'));
    assert.deepEqual(bandLines(await hooks.band($, BAND, passed)), ['▌FANKEEL DESIGN  ●●○  等你 0 分  遠端 ✗'], 'a band with no count still drew a second row');
    $.session.usage = async () => { throw new Error('not yet'); };
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /FANKEEL DESIGN/, 'a usage() that throws took the band with it');
});

test('a usage() that rejects drops the context block and nothing else of the tick', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live), tokens: 400000 });
    const draw = async () => texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.ok((await draw()).includes('context'));
    $.session.usage = async () => { throw new Error('not yet'); };
    store[ROOT + '/.fankeel/sessions/' + ID + '.json'] = JSON.stringify(Object.assign({}, live, { stage: 'build' }));
    const before = log.invalidated;
    await log.ticks[0].fn();
    assert.ok(!(await draw()).includes('context'));
    assert.equal(log.invalidated, before + 1, 'the tick stopped at the usage() that threw');
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /FANKEEL BUILD/);
});

test('a usage() that rejects on three ticks is logged once', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    $.session.usage = async () => { throw new Error('not yet'); };
    await hooks['session.start']($, {}, async () => ({}));
    for (let i = 0; i < 3; i++) await log.ticks[0].fn();
    assert.equal(log.logs.filter((m) => /not yet/.test(m)).length, 1, JSON.stringify(log.logs));
});

test('a neighbour that first reads as unparsable is read again at the same mtime and size', async () => {
    const hooks = await wired();
    const OTHER = ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json';
    const valid = JSON.stringify({ task: 'someone else', stage: 'build', active: true, updated: new Date().toISOString(), claims: ['a.js'] });
    const { $, log, store } = fake({ files: Object.assign(entryFile(live), { [OTHER]: 'x'.repeat(valid.length) }) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.doesNotMatch(bandLines(await hooks.band($, BAND, passed)).join('\n'), /⚑/);
    store[OTHER] = valid;
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed)).join('\n'), /⚑1/, 'a read that failed was cached');
});

test('a neighbour registry file that does not read is logged once, and the entry is left out', async () => {
    const hooks = await wired();
    const OTHER = ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json';
    const { $, log } = fake({ files: Object.assign(entryFile(live), { [OTHER]: '{' }) });
    await hooks['session.start']($, {}, async () => ({}));
    for (let i = 0; i < 3; i++) await log.ticks[0].fn();
    const said = log.logs.filter((m) => /neighbour registry file unreadable/.test(m));
    assert.deepEqual(said, ['fankeel pane: neighbour registry file unreadable, ' + OTHER], JSON.stringify(log.logs));
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /FANKEEL DESIGN/);
});

test('a pending file that is not JSON is logged once and draws no gate, and one that expired is not logged', async () => {
    const PENDING = DIR + '/design-pending.json';
    const hooks = await wired();
    const torn = fake({ files: Object.assign(entryFile(live), { [PENDING]: '{' }) });
    await hooks['session.start'](torn.$, {}, async () => ({}));
    for (let i = 0; i < 3; i++) await torn.log.ticks[0].fn();
    assert.deepEqual(torn.log.logs.filter((m) => /pending file/.test(m)), ['fankeel pane: pending file does not parse, ' + PENDING], JSON.stringify(torn.log.logs));
    assert.equal(buttons(await hooks['ui.render'](torn.$, { viewport: { columns: 44, rows: 40 } })).length, 0);

    const hooks2 = await wired();
    const old = fake({ files: Object.assign(entryFile(live), { [PENDING]: JSON.stringify(Object.assign({}, gate, { until: Date.now() - 1000 })) }) });
    await hooks2['session.start'](old.$, {}, async () => ({}));
    for (let i = 0; i < 3; i++) await old.log.ticks[0].fn();
    assert.deepEqual(old.log.logs.filter((m) => /pending file/.test(m)), [], JSON.stringify(old.log.logs));
});

test('a claimed plan with a build ledger draws its tasks, on the band as a count, and a line added to the ledger redraws', async () => {
    const hooks = await wired();
    const PLAN = 'docs/plans/2026-10-12-demo.md';
    const LEDGER = ROOT + '/.fankeel/build/2026-10-12-demo/progress.md';
    const HEAD = '# fankeel build ledger — plan: ';
    const files = Object.assign(entryFile(Object.assign({}, live, { claims: ['a.js', PLAN, 'notes.md'] })), {
        [ROOT + '/' + PLAN]: ['# Demo', '', '## Task 1: one', '', '**Dispatch:** implementer, sonnet — code.', '', '## Task 2: two', '', '**Dispatch:** user — look at it.', '', '## Coverage', ''].join('\n'),
        [LEDGER]: HEAD + PLAN + '\nTask 1: complete — one\n',
    });
    const { $, log, store } = fake({ files });
    const draw = async () => paneLines(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    const tasks = (seen) => seen.slice(seen.indexOf(seen.find((t) => t.startsWith('▌tasks '))), seen.findIndex((t) => t.startsWith('▌abcdef12')) - 1);
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.deepEqual(tasks(await draw()), ['▌tasks 1 of 2', ' ● 1 one', ' ◐ 2 two · 你的']);
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], / {2}tasks 1\/2 {2}/);
    const after = log.invalidated;
    store[LEDGER] += 'Task 2: complete — two\n';
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.deepEqual(tasks(await draw()), ['▌tasks 2 of 2', ' ● 1 one', ' ● 2 two']);
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], / {2}tasks 2\/2 {2}/);
    assert.equal(log.reads.filter((p) => p === ROOT + '/' + PLAN).length, 1, 'the plan file was read again though it had not changed');
    store[LEDGER] = HEAD + 'docs/plans/other.md\nTask 1: complete — one\n';
    await log.ticks[0].fn();
    assert.ok(!(await draw()).some((t) => t.startsWith('▌tasks ')), 'another plan\'s ledger was counted');
    assert.doesNotMatch(bandLines(await hooks.band($, BAND, passed))[0], /tasks/);
});

test('a pane that cannot open says what the engine said, or that nothing here draws panes', async () => {
    const none = 'fankeel 面板開不了：這裡畫不了面板，請在終端或 Claude Desktop 開。';
    for (const [surfaces, reason, said] of [
        [['terminal'], 'under 144 columns, now 100', 'fankeel 面板開不了：under 144 columns, now 100'],
        [['desktop'], 'under 144 columns, now 100', 'fankeel 面板開不了：under 144 columns, now 100'],
        [['terminal'], '', 'fankeel 面板開不了：終端太窄。'],
        [[], 'under 144 columns, now 100', none],
        [['mobile'], 'under 144 columns, now 100', none],
    ]) {
        const hooks = await wired();
        const { $ } = fake({ files: entryFile(live), placed: false, surfaces, reason });
        await hooks['session.start']($, {}, async () => ({}));
        const reply = await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
        assert.equal(reply.text, said, JSON.stringify([surfaces, reason]));
    }
});

test('the Pane is laid out in its own body columns and rows, each block under one rail of its own colour', async () => {
    const { width } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-status.ts')).href);
    const hooks = await wired();
    const mine = Object.assign({}, live, { task: '一個很長的任務標題，'.repeat(6), notes: ['一則很長的筆記，'.repeat(8)], claims: ['a.js', 'docs/a/very/long/path/that/goes/on/and/on/and/on/file.md'] });
    const files = Object.assign(entryFile(mine), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: JSON.stringify({ task: '另一個很長的任務標題，'.repeat(6), stage: 'build', active: true, updated: new Date().toISOString(), claims: mine.claims }),
    });
    const { $, log } = fake({ files, tokens: 400000 });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const at = (bodyRows) => hooks['ui.render']($, { viewport: { columns: 200, rows: 50 }, props: { bodyColumns: 41, scroll: { offset: 0, bodyRows } } });
    const tree = await at(32);
    // A row after a blank one, or the first, opens its block; the clash is an alarm and keeps its rail on every row.
    let opens = true;
    for (const row of tree.children) {
        const cells = width(texts(row).join(''));
        assert.ok(cells <= 41, '41 < ' + cells + ': ' + texts(row).join(''));
        if (row.tag === 'Box') assert.equal(row.children[0].children.join(''), opens || row.children[0].props.color === '#ff5f5f' ? '▌' : ' ', texts(row).join(''));
        opens = row.tag !== 'Box';
    }
    const title = leaves(tree).filter((n) => n.props.bold && n.props.color === undefined && n.children.join('') !== 'design').map((n) => n.children.join(''));
    assert.equal(title.join(''), mine.task, 'the title is not drawn whole');
    assert.equal(title.length, 3);
    const heads = (t) => leaves(t).filter((n) => n.props.bold && n.props.color === '#8a8a8a').map((n) => n.children.join(''));
    assert.deepEqual(heads(tree), ['context', 'notes']);
    const rails = (t) => [...new Set(t.children.filter((row) => row.tag === 'Box').map((row) => row.children[0].props.color))];
    assert.deepEqual(rails(tree), [undefined, '#ff5f5f', '#8a8a8a', '#585858']);
    const clash = leaves(tree).filter((n) => n.children.join('').startsWith('⚑ '));
    assert.equal(clash.length, 2);
    assert.deepEqual(clash.map((n) => [n.props.color, n.props.bold]), [['#ff5f5f', true], ['#ff5f5f', true]]);
    assert.ok(clash[1].children.join('').startsWith('⚑ …') && clash[1].children.join('').endsWith('file.md'));
    assert.equal(paneLines(tree).filter((t) => /… @ build · \d+m$/.test(t)).length, 2);
    const foot = leaves(tree).find((n) => n.children.join('').startsWith('abcdef12'));
    assert.equal(foot.props.color, '#8a8a8a');
    // 17 rows in all: the task 4, the clash 4, context 2, notes 2, the foot 1, and four blank rows between.
    assert.equal(tree.children.length, 17);
    assert.deepEqual(heads(await at(15)), ['context'], 'the room is the body rows the surface gave, not the viewport');
});

test('the engine\'s rate limits are bars on the band and no reset time in the Pane, and a new figure redraws', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    // Half a minute over, so the minute a countdown shows does not turn while the test runs: hooks/pane.ts draws against Date.now().
    const soon = (ms) => new Date(Date.now() + ms + 30000).toISOString();
    const limits = [{ kind: 'five_hour', percentUsed: 66, resetsAt: soon(106 * 60000) }, { kind: 'seven_day', percentUsed: 58, resetsAt: soon(60.5 * 3600000) }];
    $.session.usage = async () => ({ startedAt: 0, context: { tokens: log.tokens, window: 1000000, percent: 31 }, rateLimits: limits });
    const pane = async () => paneLines(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } }));
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ███░│░░░░░ 312k/1M  │  5h ██████▌░░░  66%  │  7d █████▊░░░░  58%  -6%');
    assert.doesNotMatch((await pane()).join('\n'), /█|░|%|剩|↻|重置|用量額度/);
    const after = log.invalidated;
    limits[0] = Object.assign({}, limits[0], { percentUsed: 67 });
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    // A window with no reset is still a bar on the band.
    limits[1] = { kind: 'seven_day', percentUsed: 58 };
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ███░│░░░░░ 312k/1M  │  5h ██████▋░░░  67%  │  7d █████▊░░░░  58%');
    // An engine that reports no limits at all: the band is ctx alone.
    $.session.usage = async () => ({ startedAt: 0, context: { tokens: log.tokens } });
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ██████▉░░░ 312k/450k');
});

test('an engine that reports no window, or a window of 0, leaves the band measured against the threshold', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    for (const context of [{ tokens: 312000 }, { tokens: 312000, window: 0 }]) {
        $.session.usage = async () => ({ startedAt: 0, context, rateLimits: [] });
        await log.ticks[0].fn();
        assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ██████▉░░░ 312k/450k', JSON.stringify(context));
    }
});

test('while a gate waits a new second redraws, so the band countdown moves; with none it does not', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    let after = log.invalidated;
    log.now += 1000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after, 'a second with no gate redrew');
    store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    await log.ticks[0].fn();
    after = log.invalidated;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after, 'the same second redrew');
    log.now += 1000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
});

test('a new minute redraws, so the band\'s minutes and the neighbours\' ages move', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const after = log.invalidated;
    log.now += 1000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after);
    log.now += 60000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
});

const command = (hooks, $) => hooks['command.run']($, { command: 'fankeel-panel', args: '' });
const SESSION = ROOT + '/.fankeel/sessions/' + ID + '.json';

test('a session that comes to own a task has its pane opened, once', async () => {
    for (const placed of [true, false]) {
        const hooks = await wired();
        const { $, log } = fake({ files: entryFile(live), placed });
        await hooks['session.start']($, {}, async () => ({}));
        assert.equal(log.opened.length, 0, 'the pane opened before any tick');
        await log.ticks[0].fn();
        assert.deepEqual(log.opened, [{ id: 'fankeel', title: 'fankeel' }]);
        await log.ticks[0].fn();
        await log.ticks[0].fn();
        assert.equal(log.opened.length, 1, 'placed ' + placed + ': a later tick opened it again');
        assert.deepEqual(log.toasts, []);
    }
});

test('a pane the user closed with /fankeel-panel is not opened again for the same task', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await command(hooks, $);
    assert.equal(log.closed.length, 1);
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 1, 'the task opened the pane the user had closed');
});

test('a pane opened for the task stays up when a gate comes and goes', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 1, 'the gate opened a pane beside the task\'s');
    delete store[DIR + '/design-pending.json'];
    await log.ticks[0].fn();
    assert.deepEqual(log.closed, [], 'the end of the gate closed the task\'s pane');
});

test('the task ending closes the pane the mod opened, and leaves one the user opened', async () => {
    const ended = JSON.stringify(Object.assign({}, live, { active: false }));
    const hooks = await wired();
    const mine = fake({ files: entryFile(live) });
    await hooks['session.start'](mine.$, {}, async () => ({}));
    await mine.log.ticks[0].fn();
    mine.store[SESSION] = ended;
    await mine.log.ticks[0].fn();
    assert.deepEqual(mine.log.closed.map((p) => p.id), ['fankeel']);
    await mine.log.ticks[0].fn();
    assert.equal(mine.log.closed.length, 1, 'closed again on a later tick');

    const hooks2 = await wired();
    const theirs = fake({ files: entryFile(live) });
    await hooks2['session.start'](theirs.$, {}, async () => ({}));
    await theirs.log.ticks[0].fn();
    await command(hooks2, theirs.$);
    await command(hooks2, theirs.$);
    assert.equal(theirs.log.closed.length, 1);
    theirs.store[SESSION] = ended;
    await theirs.log.ticks[0].fn();
    assert.equal(theirs.log.closed.length, 1, 'the end of the task closed a pane the user opened');
});

test('a registry file that cannot be read for a tick neither closes nor reopens the pane', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await command(hooks, $);
    assert.equal(log.closed.length, 1);
    const band = async () => bandLines(await hooks.band($, BAND, passed))[0];
    assert.match(await band(), /FANKEEL DESIGN/);
    store[SESSION] = '{"task": "demo task", "stag';
    await log.ticks[0].fn();
    assert.match(await band(), /FANKEEL DESIGN/, 'the band lost the task');
    store[SESSION] = JSON.stringify(live);
    await log.ticks[0].fn();
    assert.match(await band(), /FANKEEL DESIGN/);
    assert.equal(log.opened.length, 1, 'the task appeared again after an unreadable tick');
    assert.equal(log.closed.length, 1, 'the unreadable tick ended the task');
});

test('the task ending closes a pane that was registered but never placed', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live), placed: false });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 1);
    store[SESSION] = JSON.stringify(Object.assign({}, live, { active: false }));
    await log.ticks[0].fn();
    assert.deepEqual(log.closed.map((p) => p.id), ['fankeel']);
    await log.ticks[0].fn();
    assert.equal(log.closed.length, 1, 'closed again on a later tick');
});

test('an open that rejects on the task edge is tried again on the next tick', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    const open = $.ui.open;
    let calls = 0;
    $.ui.open = async (p) => { calls += 1; if (calls === 1) throw new Error('busy'); return open(p); };
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 0);
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 1);
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 1);
});

test('an open that keeps rejecting does not keep the band off the screen', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    $.ui.open = async () => { throw new Error('busy'); };
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /FANKEEL DESIGN/, 'the band waited on an open that never went through');
    assert.ok(log.invalidated >= 1, 'nothing was invalidated');
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.equal(log.logs.filter((m) => /pane not opened or closed, .*busy/.test(m)).length, 1, JSON.stringify(log.logs));
});

test('a registry file that stays unreadable is logged once and, after twenty ticks, is no task', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const band = async () => { const drawn = await hooks.band($, BAND, passed); return typeof drawn === 'string' ? drawn : bandLines(drawn)[0]; };
    store[SESSION] = '{"task": "demo task", "stag';
    for (let i = 0; i < 19; i++) await log.ticks[0].fn();
    assert.match(await band(), /FANKEEL DESIGN/, 'the task went before the twentieth tick');
    assert.deepEqual(log.closed, []);
    await log.ticks[0].fn();
    assert.equal(await band(), 'passed', 'the band still draws a task whose file stayed unreadable');
    assert.deepEqual(log.closed.map((p) => p.id), ['fankeel']);
    for (let i = 0; i < 3; i++) await log.ticks[0].fn();
    assert.equal(log.closed.length, 1, 'closed again on a later tick');
    assert.equal(log.logs.filter((m) => /registry file unreadable/.test(m)).length, 1, JSON.stringify(log.logs));
    assert.equal(log.logs.filter((m) => /tick skipped/.test(m)).length, 0);
    store[SESSION] = JSON.stringify(live);
    await log.ticks[0].fn();
    assert.match(await band(), /FANKEEL DESIGN/, 'a file that parses again is not a task');
});

test('a readable tick starts the count of unreadable ticks again', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const torn = '{"task": "demo task", "stag';
    store[SESSION] = torn;
    for (let i = 0; i < 19; i++) await log.ticks[0].fn();
    store[SESSION] = JSON.stringify(live);
    await log.ticks[0].fn();
    store[SESSION] = torn;
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /FANKEEL DESIGN/, 'the twentieth unreadable tick overall read as no task');
    assert.deepEqual(log.closed, []);
});

test('a registry file that fails, parses, and fails again is logged each time it starts failing', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const torn = '{"task": "demo task", "stag';
    store[SESSION] = torn;
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    store[SESSION] = JSON.stringify(live);
    await log.ticks[0].fn();
    store[SESSION] = torn;
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.equal(log.logs.filter((m) => /registry file unreadable/.test(m)).length, 2, JSON.stringify(log.logs));
});

test('FANKEEL_PANE_PROBE draws what the engine says the session draws on above the foot, and redraws when it changes', async () => {
    const hooks = await wired();
    const surfaces = ['terminal', 'desktop'];
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_PANE_PROBE: '1' }, surfaces });
    const draw = async () => paneLines(await hooks['ui.render']($, { viewport: { columns: 60, rows: 40 } }));
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.deepEqual((await draw()).slice(-3), [' ', '▌surfaces [terminal, desktop] · surface terminal', ' abcdef12 · /fankeel-panel 關閉']);
    const after = log.invalidated;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after, 'the same surfaces redrew');
    surfaces.length = 0;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.deepEqual((await draw()).slice(-2), ['▌surfaces [] · surface null', ' abcdef12 · /fankeel-panel 關閉']);
    $.session.surface = async () => { throw new Error('gone'); };
    await log.ticks[0].fn();
    assert.deepEqual((await draw()).slice(-2), ['▌surfaces ? · Error: gone', ' abcdef12 · /fankeel-panel 關閉']);
});

test('with no FANKEEL_PANE_PROBE the Pane draws no probe row and the engine is not asked', async () => {
    for (const env of [{}, { FANKEEL_PANE_PROBE: '' }]) {
        const hooks = await wired();
        const { $, log } = fake({ files: entryFile(live), env, surfaces: ['terminal', 'desktop'] });
        let asked = 0;
        $.session.surfaces = async () => { asked += 1; return ['terminal']; };
        $.session.surface = async () => { asked += 1; return 'terminal'; };
        await hooks['session.start']($, {}, async () => ({}));
        await log.ticks[0].fn();
        const seen = texts(await hooks['ui.render']($, { viewport: { columns: 60, rows: 40 } }));
        assert.ok(!seen.some((t) => t.startsWith('surfaces')), seen.join(' | '));
        assert.equal(asked, 0);
    }
});

test('an active neighbour that is not in live.json is no clash, unless its file moved since; with no list every active neighbour counts', async () => {
    const hooks = await wired();
    const LIVE = ROOT + '/.fankeel/build/live.json';
    const A = ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json';
    const B = ROOT + '/.fankeel/sessions/22222222-0000-4000-8000-000000000003.json';
    const peer = (task) => JSON.stringify({ task, stage: 'build', active: true, updated: new Date().toISOString(), claims: ['a.js'] });
    const { $, log, store, mtimes } = fake({ files: Object.assign(entryFile(live), { [A]: peer('still here'), [B]: peer('long gone') }) });
    const band = async () => { await log.ticks[0].fn(); return bandLines(await hooks.band($, BAND, passed)).join('\n'); };
    const pane = async () => paneLines(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } })).join('\n');
    const list = (ids, at) => JSON.stringify({ at: at === undefined ? 5 : at, ids });
    await hooks['session.start']($, {}, async () => ({}));
    // No list: as it always was.
    assert.match(await band(), /⚑2/);
    // Every registry file here has mtimeMs 1, older than the list's `at` of 5.
    store[LIVE] = list(['11111111-0000-4000-8000-000000000002']);
    assert.match(await band(), /⚑1/);
    assert.match(await pane(), /still here @ build/);
    assert.doesNotMatch(await pane(), /long gone/);
    // A registry file newer than the list is a session that moved after it was written.
    mtimes[B] = 6;
    assert.match(await band(), /⚑2/);
    assert.match(await pane(), /long gone @ build/);
    mtimes[B] = 5;
    assert.match(await band(), /⚑1/, 'a file as old as the list counted as newer');
    store[LIVE] = list([]);
    assert.doesNotMatch(await band(), /⚑/);
    assert.doesNotMatch(await pane(), /⚑|still here/);
    assert.equal(leaves(await hooks.band($, BAND, passed))[0].props.color, '#5f5fd7', 'the rail stayed red with nobody live in these files');
    // Cannot tell is not nobody: null ids, a file that does not parse, one with no `at`, and no file.
    for (const text of [list(null), '{ not json', JSON.stringify({ ids: [] }), JSON.stringify({ at: 'soon', ids: [] })]) {
        store[LIVE] = text;
        assert.match(await band(), /⚑2/, text);
    }
    delete store[LIVE];
    assert.match(await band(), /⚑2/);
});

test('a live.json that exists and does not parse is logged once across ticks, and a missing one is not logged', async () => {
    const hooks = await wired();
    const LIVE = ROOT + '/.fankeel/build/live.json';
    const { $, log, store } = fake({ files: entryFile(live) });
    const said = () => log.logs.filter((m) => /live list/.test(m));
    await hooks['session.start']($, {}, async () => ({}));
    for (let i = 0; i < 3; i++) await log.ticks[0].fn();
    assert.deepEqual(said(), [], 'a missing live.json was logged');
    store[LIVE] = '{ not json';
    for (let i = 0; i < 3; i++) await log.ticks[0].fn();
    assert.equal(said().length, 1, JSON.stringify(log.logs));
    assert.match(said()[0], /^fankeel pane: live list does not parse, /);
});


// Claude Code's own session files: <configDir>/sessions/<pid>.json.
const CLAUDE = 'F:/cfg/sessions/';
async function bandWith(files, over = {}) {
    const hooks = await wired();
    const { $, log } = fake({ files: Object.assign(entryFile(Object.assign({}, live, { configDir: 'F:/cfg' }, over)), files) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['band']($, { surface: 'terminal', ...BAND }, passed);
    return { lines: bandLines(tree), log };
}

test('Remote Control: the session file whose sessionId is this session, bridgeSessionId a string, puts 遠端 ✓ on the band', async () => {
    const on = await bandWith({ [CLAUDE + '100.json']: JSON.stringify({ sessionId: 'someone-else', bridgeSessionId: 'br_x' }), [CLAUDE + '200.json']: JSON.stringify({ sessionId: ID, bridgeSessionId: 'br_1' }) });
    assert.match(on.lines[0], /等你 \d+ 分  遠端 ✓$|遠端 ✓$/);
    const first = await bandWith({ [CLAUDE + '100.json']: JSON.stringify({ sessionId: ID, bridgeSessionId: 'br_x' }), [CLAUDE + '200.json']: JSON.stringify({ sessionId: 'someone-else', bridgeSessionId: null }) });
    assert.match(first.lines[0], /遠端 ✓$/);
    const other = await bandWith({ [CLAUDE + '100.json']: JSON.stringify({ sessionId: 'someone-else', bridgeSessionId: 'br_x' }), [CLAUDE + '200.json']: JSON.stringify({ sessionId: ID, bridgeSessionId: null }) });
    assert.match(other.lines[0], /遠端 ✗$/);
});

test('Remote Control: null, absent, empty, a file that does not parse and no sessions directory read as not connected, 遠端 ✗, and do not throw', async () => {
    for (const files of [
        { [CLAUDE + '1.json']: JSON.stringify({ sessionId: ID, bridgeSessionId: null }) },
        { [CLAUDE + '1.json']: JSON.stringify({ sessionId: ID }) },
        { [CLAUDE + '1.json']: JSON.stringify({ sessionId: ID, bridgeSessionId: '' }) },
        { [CLAUDE + '1.json']: '{"sessionId": ' },
        {},
    ]) {
        const got = await bandWith(files);
        assert.ok(got.lines.length >= 1);
        assert.match(got.lines[0], /遠端 ✗$/);
    }
});

test('Remote Control: the configDir is the registry entry\'s, else HOME/.claude', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: Object.assign(entryFile(live), { 'F:/home/.claude/sessions/9.json': JSON.stringify({ sessionId: ID, bridgeSessionId: 'br' }) }), env: { HOME: 'F:/home' } });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks['band']($, { surface: 'terminal', ...BAND }, passed))[0], /遠端 ✓$/);
});

test('Remote Control: switching it off is seen on the next tick, and the Desktop Svg alt carries the same words as the row', async () => {
    const hooks = await wired();
    const { $, log, store, mtimes } = fake({ files: Object.assign(entryFile(Object.assign({}, live, { configDir: 'F:/cfg' })), { [CLAUDE + '1.json']: JSON.stringify({ sessionId: ID, bridgeSessionId: 'br' }) }), surfaces: ['desktop'] });
    $.ui.resolve = () => ({ Box: 'Box', Svg: 'Svg', Text: 'Text' });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const on = await hooks['band']($, { surface: 'desktop', ...BAND }, passed);
    assert.match(on.children[0].props.alt, /遠端 ✓$/);
    assert.match(on.children[0].props.source, />遠端<.*>✓</);
    store[CLAUDE + '1.json'] = JSON.stringify({ sessionId: ID, bridgeSessionId: null });
    mtimes[CLAUDE + '1.json'] = 99;
    await log.ticks[0].fn();
    const off = await hooks['band']($, { surface: 'desktop', ...BAND }, passed);
    assert.match(off.children[0].props.alt, /遠端 ✗$/);
    assert.match(off.children[0].props.source, />遠端<.*>✗</);
    assert.doesNotMatch(off.children[0].props.source, />✓</);
});

// Claude Code's session files, driven tick by tick so the cache and the mtimes can be moved.
async function remoteRig(files) {
    const hooks = await wired();
    const rig = fake({ files: Object.assign(entryFile(Object.assign({}, live, { configDir: 'F:/cfg' })), files) });
    await hooks['session.start'](rig.$, {}, async () => ({}));
    const tick = async () => { await rig.log.ticks[0].fn(); return bandLines(await hooks['band'](rig.$, { surface: 'terminal', ...BAND }, passed))[0]; };
    return { ...rig, tick };
}

test('Remote Control: a configDir that ends in a backslash finds the file', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: Object.assign(entryFile(Object.assign({}, live, { configDir: 'F:/cfg\\' })), { [CLAUDE + '1.json']: JSON.stringify({ sessionId: ID, bridgeSessionId: 'br' }) }) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks['band']($, { surface: 'terminal', ...BAND }, passed))[0], /遠端 ✓$/);
});

test('Remote Control: a connected file whose next read does not parse still shows 遠端 ✓, and is read again after', async () => {
    const f = CLAUDE + '1.json';
    const { tick, store, mtimes } = await remoteRig({ [f]: JSON.stringify({ sessionId: ID, bridgeSessionId: 'br' }) });
    assert.match(await tick(), /遠端 ✓$/);
    store[f] = '{"sessionId": "' + ID + '", "bridge';
    mtimes[f] = 5;
    assert.match(await tick(), /遠端 ✓$/);
    store[f] = JSON.stringify({ sessionId: ID, bridgeSessionId: null });
    mtimes[f] = 6;
    assert.match(await tick(), /遠端 ✗$/);
});

test('Remote Control: a file gone from the listing is gone from the cache', async () => {
    const gone = CLAUDE + '1.json';
    const keep = CLAUDE + '2.json';
    const { tick, store, $ } = await remoteRig({ [gone]: JSON.stringify({ sessionId: 'x' }), [keep]: JSON.stringify({ sessionId: 'y' }) });
    await tick();
    let n = 0;
    const read = $.fs.read;
    $.fs.read = async (p) => { if (p === gone || p === keep) n += 1; return read(p); };
    await tick();
    assert.equal(n, 0, 'unchanged files were read again');
    delete store[gone];
    await tick();
    store[gone] = JSON.stringify({ sessionId: 'x' });
    await tick();
    assert.equal(n, 1, 'the removed file stayed cached, the kept one was read again');
});

test('Remote Control: of several files with this sessionId the newest decides', async () => {
    const a = CLAUDE + '1.json';
    const b = CLAUDE + '2.json';
    const old = await remoteRig({ [a]: JSON.stringify({ sessionId: ID, bridgeSessionId: 'br' }), [b]: JSON.stringify({ sessionId: ID, bridgeSessionId: null }) });
    old.mtimes[a] = 10;
    old.mtimes[b] = 20;
    assert.match(await old.tick(), /遠端 ✗$/);
    const fresh = await remoteRig({ [a]: JSON.stringify({ sessionId: ID, bridgeSessionId: null }), [b]: JSON.stringify({ sessionId: ID, bridgeSessionId: 'br' }) });
    fresh.mtimes[a] = 10;
    fresh.mtimes[b] = 20;
    assert.match(await fresh.tick(), /遠端 ✓$/);
});

test('Remote Control: the newest file decides whatever order the listing gives', async () => {
    const a = CLAUDE + '1.json';
    const b = CLAUDE + '2.json';
    const rig = await remoteRig({ [a]: JSON.stringify({ sessionId: ID, bridgeSessionId: null }), [b]: JSON.stringify({ sessionId: ID, bridgeSessionId: 'br' }) });
    rig.mtimes[a] = 20;
    rig.mtimes[b] = 10;
    assert.match(await rig.tick(), /遠端 ✗$/);
});

test('Remote Control: two files of this session with the same mtime are connected whichever the listing lists first', async () => {
    const a = CLAUDE + '1.json';
    const b = CLAUDE + '2.json';
    const on = JSON.stringify({ sessionId: ID, bridgeSessionId: 'br' });
    const off = JSON.stringify({ sessionId: ID, bridgeSessionId: null });
    for (const files of [{ [a]: on, [b]: off }, { [a]: off, [b]: on }]) {
        const rig = await remoteRig(files);
        rig.mtimes[a] = 10;
        rig.mtimes[b] = 10;
        assert.match(await rig.tick(), /遠端 ✓$/);
    }
});

test('turn.start and turn.complete are hooked and pass the event on', async () => {
    const hooks = await wired();
    const { $ } = fake({ files: entryFile(live) });
    for (const name of ['turn.start', 'turn.complete']) {
        assert.equal(typeof hooks[name], 'function', name + ' is not hooked');
        assert.deepEqual(await hooks[name]($, { n: 1 }, async (e) => ({ got: e })), { got: { n: 1 } });
    }
});

test('the band\'s first row is drawn interactive from turn.start to turn.complete', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), surfaces: ['desktop'] });
    $.ui.resolve = () => ({ Box: 'Box', Svg: 'Svg', Text: 'Text' });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const draw = async () => (await hooks['band']($, { surface: 'desktop', ...BAND }, passed)).children;
    assert.equal((await draw())[0].props.isInteractive, undefined);
    await hooks['turn.start']($, {}, passed);
    const during = await draw();
    assert.equal(during[0].props.isInteractive, true);
    assert.equal(during[1].props.isInteractive, undefined);
    await hooks['turn.complete']($, {}, passed);
    assert.equal((await draw())[0].props.isInteractive, undefined);
});

test('a subagent\'s turn.complete leaves the main turn running; the main one ends it', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), surfaces: ['desktop'] });
    $.ui.resolve = () => ({ Box: 'Box', Svg: 'Svg', Text: 'Text' });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const draw = async () => (await hooks['band']($, { surface: 'desktop', ...BAND }, passed)).children;
    await hooks['turn.start']($, {}, passed);
    await hooks['turn.complete']($, { agentId: 'a1' }, passed);
    assert.equal((await draw())[0].props.isInteractive, true);
    await hooks['turn.complete']($, {}, passed);
    assert.equal((await draw())[0].props.isInteractive, undefined);
});

test('a pending question with no at still stops the breathing', async () => {
    const hooks = await wired();
    const noAt = { questions: gate.questions, until: Date.now() + 600000 };
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(noAt) });
    const { $, log } = fake({ files, surfaces: ['desktop'] });
    $.ui.resolve = () => ({ Box: 'Box', Svg: 'Svg', Text: 'Text' });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await hooks['turn.start']($, {}, passed);
    const rows = (await hooks['band']($, { surface: 'desktop', ...BAND }, passed)).children;
    assert.equal(rows[0].props.isInteractive, undefined);
});

test('a turn flag that changes redraws once on the next tick, and not again', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await hooks['turn.start']($, {}, passed);
    log.invalidated = 0;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, 1);
    await log.ticks[0].fn();
    assert.equal(log.invalidated, 1);
});
