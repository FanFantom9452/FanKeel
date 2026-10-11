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
const BAND = { props: { bodyColumns: 90 } };
const passed = async () => 'passed';

test('the constants the design names', async () => {
    const m = await load();
    assert.equal(m.PANE, 'fankeel');
    assert.equal(m.COMMAND, 'fankeel-pane');
    assert.equal(m.POLL_MS, 250);
});

test('session.start registers the command and a 250 ms poll, and opens nothing', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    let passed = false;
    await hooks['session.start']($, {}, async () => { passed = true; return {}; });
    assert.ok(passed, 'session.start did not call next');
    assert.deepEqual(log.commands.map((c) => c.name), ['fankeel-pane']);
    assert.deepEqual(log.ticks.map((t) => t.ms), [250]);
    assert.deepEqual(log.opened, []);
});

test('the command opens the pane, and closes it when it is open', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['command.run:matcher'], { command: 'fankeel-pane' });
    const { $, log } = fake({ files: entryFile(live) });
    const first = await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
    assert.deepEqual(log.opened.map((p) => p.id), ['fankeel']);
    assert.equal(typeof first.text, 'string');
    await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
    assert.deepEqual(log.closed.map((p) => p.id), ['fankeel']);
});

test('the Pane draws what is looked up, and leaves the stage, the route and the task to the band', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['ui.render:matcher'], { component: 'Pane', requestId: 'fankeel' });
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { notes: ['a note'] })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const seen = texts(tree);
    assert.deepEqual(seen.filter((t) => t.trim()), ['context', '312k', '· 到 450k 自動 compact', '留 task · stage · plan · agent · handoff',
        'notes', '· a note', 'touched 1', 'a.js', 'abcdef12 · /fankeel-pane 關閉']);
    assert.equal(seen.filter((t) => !t.trim()).length, 3);
    assert.doesNotMatch(seen.join('\n'), /demo task|2 of 3|guard|bounded/);
    assert.equal(buttons(tree).length, 0);
});

test('the band above the prompt draws the stage, the dots, the guard and the task from the registry file', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['band:matcher'], { component: 'AbovePrompt' });
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { next: 'write the plan' })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks.band($, BAND, passed);
    assert.deepEqual(bandLines(tree), ['▌FANKEEL DESIGN  ●●○  ⚿ deny  demo task', '▌next  write the plan  1 檔  2 of 3']);
    assert.deepEqual(leaves(tree).filter((n) => n.props.color === '#5f5fd7').map((n) => n.children.join('')), ['▌', 'FANKEEL DESIGN', '●●', '▌']);
    assert.equal(log.opened.length, 0);
});

test('a session root ending in a backslash still finds the registry file', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    $.session.root = async () => ROOT + '\\';
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /demo task/);
    assert.match(texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).join('\n'), /abcdef12 · \/fankeel-pane/);
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

test('a pending gate opens the pane, draws buttons, and a press writes the answer file', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.deepEqual(log.opened.map((p) => p.id), ['fankeel']);
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const bs = buttons(tree);
    assert.deepEqual(bs.map((b) => b.props.hotkey), ['1', '2', '3', 't']);
    assert.ok(bs.every((b) => b.props.plain === true));
    await bs[1].props.onPress({});
    assert.deepEqual(JSON.parse(store[DIR + '/design-answer.md']), { answers: { 'Go on?': 'Stay' } });
});

test('a press writes nothing once the station answered, or the gate is gone', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store, mtimes } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const bs = buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    store[DIR + '/design-answer.md'] = 'station got there first';
    mtimes[DIR + '/design-answer.md'] = 2000;
    await bs[0].props.onPress({});
    assert.equal(store[DIR + '/design-answer.md'], 'station got there first');
    delete store[DIR + '/design-answer.md'];
    delete store[DIR + '/design-pending.json'];
    await bs[0].props.onPress({});
    assert.equal(store[DIR + '/design-answer.md'], undefined);
});

test('an answer file older than the gate is an earlier gate\'s: a press overwrites it, the terminal button too', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store, mtimes } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const bs = buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    store[DIR + '/design-answer.md'] = 'an earlier gate';
    mtimes[DIR + '/design-answer.md'] = 500;
    await bs[1].props.onPress({});
    assert.deepEqual(JSON.parse(store[DIR + '/design-answer.md']), { answers: { 'Go on?': 'Stay' } });
    store[DIR + '/design-answer.md'] = 'an earlier gate';
    await bs[3].props.onPress({});
    assert.deepEqual(JSON.parse(store[DIR + '/design-answer.md']), { handoff: 'terminal' });
});

test('a gate with no `at` leaves any answer file alone', async () => {
    const hooks = await wired();
    const noAt = Object.assign({}, gate);
    delete noAt.at;
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(noAt) });
    const { $, log, store, mtimes } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const bs = buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    assert.equal(bs.length, 4);
    store[DIR + '/design-answer.md'] = 'unknown age';
    mtimes[DIR + '/design-answer.md'] = 0;
    await bs[0].props.onPress({});
    assert.equal(store[DIR + '/design-answer.md'], 'unknown age');
});

test('the terminal button writes the handoff', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const bs = buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    await bs[3].props.onPress({});
    assert.deepEqual(JSON.parse(store[DIR + '/design-answer.md']), { handoff: 'terminal' });
});

test('a pane the mod opened for a gate closes with it; one the user opened stays', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const mine = fake({ files });
    await hooks['session.start'](mine.$, {}, async () => ({}));
    await mine.log.ticks[0].fn();
    delete mine.store[DIR + '/design-pending.json'];
    await mine.log.ticks[0].fn();
    assert.deepEqual(mine.log.closed.map((p) => p.id), ['fankeel']);

    const hooks2 = await wired();
    const theirs = fake({ files });
    await hooks2['session.start'](theirs.$, {}, async () => ({}));
    await hooks2['command.run'](theirs.$, { command: 'fankeel-pane', args: '' });
    await theirs.log.ticks[0].fn();
    delete theirs.store[DIR + '/design-pending.json'];
    await theirs.log.ticks[0].fn();
    assert.deepEqual(theirs.log.closed, []);
});

test('a gate with no room for the pane is one toast, not one a tick', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log } = fake({ files, placed: false });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.equal(log.toasts.length, 1);
    assert.match(log.toasts[0], /\/fankeel-pane/);
});

test('neighbours are the other active entries in the same sessions directory', async () => {
    const hooks = await wired();
    const other = { task: 'someone else', stage: 'build', active: true, updated: new Date().toISOString(), claims: ['a.js'] };
    const files = Object.assign(entryFile(live), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: JSON.stringify(other),
        [ROOT + '/.fankeel/sessions/22222222-0000-4000-8000-000000000003.json']: JSON.stringify(Object.assign({}, other, { task: 'stood down', active: false })),
        [ROOT + '/.fankeel/sessions/broken.json']: '{ not json',
    });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
    await log.ticks[0].fn();
    const seen = texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).join('\n');
    assert.match(seen, /someone else/);
    assert.match(seen, /共用 a\.js/);
    assert.doesNotMatch(seen, /stood down/);
    assert.doesNotMatch(seen, /@ design/, 'this session\'s own task is listed among its neighbours');
});

test('narrow terminal: a gate gives one toast, and /fankeel-pane opens again instead of closing', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log } = fake({ files, placed: false });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(log.toasts.length, 1);
    const reply = await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
    assert.deepEqual(log.closed, []);
    assert.equal(log.opened.length, 2);
    assert.doesNotMatch(reply.text, /已關閉/);
});

test('narrow terminal: the unplaced pane the mod opened for a gate is closed when the gate ends', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files, placed: false });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    delete store[DIR + '/design-pending.json'];
    await log.ticks[0].fn();
    assert.deepEqual(log.closed.map((p) => p.id), ['fankeel']);
});

test('a tick whose ui.open rejected is tried again, the gate still new', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log } = fake({ files });
    const open = $.ui.open;
    let calls = 0;
    $.ui.open = async (p) => { calls += 1; if (calls === 1) throw new Error('busy'); return open(p); };
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.deepEqual(log.opened, []);
    await log.ticks[0].fn();
    assert.deepEqual(log.opened.map((p) => p.id), ['fankeel']);
});

test('a press whose write fails says so in a toast', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const bs = buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    $.fs.write = async () => { throw new Error('disk full'); };
    await bs[0].props.onPress({});
    assert.equal(store[DIR + '/design-answer.md'], undefined);
    assert.equal(log.toasts.length, 1);
    assert.match(log.toasts[0], /答案沒寫成/);
});

test('a pane the user closed and reopened with the command is not closed when the gate ends', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
    await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
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
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.deepEqual(log.opened, []);
    assert.equal(log.reads.filter((p) => p === OTHER).length, 1, 'an unchanged neighbour was read again');
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /⚑1/);
    const before = log.invalidated;
    store[OTHER] = JSON.stringify(Object.assign({}, other, { claims: ['z.js'] }));
    mtimes[OTHER] = 2;
    await log.ticks[0].fn();
    assert.equal(log.reads.filter((p) => p === OTHER).length, 2);
    assert.equal(log.invalidated, before + 1);
    assert.doesNotMatch(bandLines(await hooks.band($, BAND, passed))[0], /⚑/);
});

test('a short pane with a four-option gate keeps every description, every button and the foot', async () => {
    const hooks = await wired();
    const options = ['a', 'b', 'c', 'd'].map((label) => ({ label, description: ('about ' + label + ' at some length, ').repeat(4) + 'end of ' + label }));
    const four = { questions: [{ question: 'Which?', header: 'design', options }], at: 1000, until: Date.now() + 600000 };
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(four) });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 18 } });
    const seen = texts(tree);
    const squash = (s) => s.replace(/\s+/g, '');
    for (const o of options) assert.ok(squash(seen.join('')).includes(squash(o.description)), 'the description of ' + o.label + ' was dropped');
    assert.ok(seen.length > 14, 'the fixture fits the pane: ' + seen.length);
    assert.equal(buttons(tree).length, 5);
    assert.ok(seen.some((t) => t.startsWith('abcdef12')));
    assert.ok(!seen.some((t) => t.startsWith('touched') || t === 'context'), 'a block that drops was kept beside a gate taller than the pane');
    const badge = leaves(tree)[0];
    assert.deepEqual([badge.children.join(''), badge.props.backgroundColor, badge.props.color, badge.props.bold], [' gate · design ', '#d7af5f', '#000000', true]);
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
    midTick($, () => hooks['command.run']($, { command: 'fankeel-pane', args: '' }));
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 1, 'the tick opened the pane the user had just opened');
    delete store[DIR + '/design-pending.json'];
    await log.ticks[0].fn();
    assert.deepEqual(log.closed, [], 'the end of the gate closed the pane the user opened');
});

test('a pane the user closes while a tick reads is opened for the gate that tick first sees', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
    store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    midTick($, () => hooks['command.run']($, { command: 'fankeel-pane', args: '' }));
    await log.ticks[0].fn();
    assert.equal(log.closed.length, 1);
    assert.equal(log.opened.length, 2, 'the gate got no pane after the user closed it mid-tick');
});

test('with a gate waiting the band\'s second row is the badge and the question', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks.band($, BAND, passed);
    assert.equal(bandLines(tree)[1], '▌ gate 在等   Go on?  1 檔  2 of 3');
    const badge = leaves(tree).find((n) => n.props.backgroundColor);
    assert.deepEqual([badge.children.join(''), badge.props.backgroundColor, badge.props.color, badge.props.bold], [' gate 在等 ', '#d7af5f', '#000000', true]);
});

test('the band and the Pane count the same files and the same clashes', async () => {
    const hooks = await wired();
    const mine = Object.assign({}, live, { claims: ['a.js', 'b.js', 'c.js'] });
    const peer = (task, claims) => JSON.stringify({ task, stage: 'build', active: true, updated: new Date().toISOString(), claims });
    const files = Object.assign(entryFile(mine), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: peer('shares b', ['b.js']),
        [ROOT + '/.fankeel/sessions/22222222-0000-4000-8000-000000000003.json']: peer('shares c and a', ['c.js', 'a.js']),
        [ROOT + '/.fankeel/sessions/33333333-0000-4000-8000-000000000004.json']: peer('shares nothing', ['z.js']),
    });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const band = bandLines(await hooks.band($, BAND, passed));
    const pane = texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } }));
    const [, n, m] = band[1].match(/(\d+) of (\d+)/);
    assert.deepEqual([Number(n), Number(m)], [mine.route.indexOf(mine.stage) + 1, mine.route.length]);
    const touched = Number(band[1].match(/(\d+) 檔/)[1]);
    assert.equal(touched, 3);
    assert.ok(pane.includes('touched ' + touched), pane.join(' | '));
    const flags = Number(band[0].match(/⚑(\d+)/)[1]);
    assert.equal(flags, 2);
    assert.equal(pane.filter((t) => t.startsWith('⚑ 共用')).length, flags);
});

test('the context block shows the tokens against FANKEEL_COMPACT_AT, and a new count redraws', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: '300000' } });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const rest = leaves(tree).find((n) => n.children.join('') === '· 到 300k 自動 compact');
    assert.ok(rest, texts(tree).join(' | '));
    assert.deepEqual([rest.props.color, rest.props.bold], ['#d7af5f', true]);
    assert.ok(texts(tree).includes('312k'));
    const after = log.invalidated;
    log.tokens = 320000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.ok(texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).includes('320k'));
});

test('with no FANKEEL_COMPACT_AT the threshold is HARD, and with no token count there is no context block', async () => {
    const { HARD } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'compact.ts')).href);
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: 'soon' } });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const rest = leaves(tree).find((n) => n.children.join('') === '· 到 ' + Math.round(HARD / 1000) + 'k 自動 compact');
    assert.ok(rest, texts(tree).join(' | '));
    assert.deepEqual([rest.props.color, rest.props.bold], ['#8a8a8a', undefined]);
    // Number('Infinity') is not finite: the same rule as hooks/compact.ts threshold.
    const inf = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: 'Infinity' } });
    const infHooks = await wired();
    await infHooks['session.start'](inf.$, {}, async () => ({}));
    await inf.log.ticks[0].fn();
    assert.ok(texts(await infHooks['ui.render'](inf.$, { viewport: { columns: 44, rows: 40 } })).includes('· 到 450k 自動 compact'));
    log.tokens = null;
    await log.ticks[0].fn();
    assert.ok(!texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).includes('context'));
    $.session.usage = async () => { throw new Error('not yet'); };
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /demo task/, 'a usage() that throws took the band with it');
});

test('a usage() that rejects drops the context block and nothing else of the tick', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
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
    assert.doesNotMatch(bandLines(await hooks.band($, BAND, passed))[0], /⚑/);
    store[OTHER] = valid;
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /⚑1/, 'a read that failed was cached');
});

test('a claimed plan with a build ledger draws its tasks done, and a line added to the ledger redraws', async () => {
    const hooks = await wired();
    const PLAN = 'docs/plans/2026-10-12-demo.md';
    const LEDGER = ROOT + '/.fankeel/build/2026-10-12-demo/progress.md';
    const HEAD = '# fankeel build ledger — plan: ';
    const files = Object.assign(entryFile(Object.assign({}, live, { claims: ['a.js', PLAN, 'notes.md'] })), {
        [ROOT + '/' + PLAN]: ['# Demo', '', '## Task 1: one', '', '## Task 2: two', '', '## Coverage', ''].join('\n'),
        [LEDGER]: HEAD + PLAN + '\nTask 1: complete — one\n',
    });
    const { $, log, store } = fake({ files });
    const draw = async () => texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    let seen = await draw();
    assert.ok(seen.includes('tasks 1 of 2'), seen.join(' | '));
    assert.ok(seen.includes('●') && seen.includes('○') && seen.includes('2026-10-12-demo'));
    const after = log.invalidated;
    store[LEDGER] += 'Task 2: complete — two\n';
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.ok((await draw()).includes('tasks 2 of 2'));
    assert.equal(log.reads.filter((p) => p === ROOT + '/' + PLAN).length, 1, 'the plan file was read again though it had not changed');
    store[LEDGER] = HEAD + 'docs/plans/other.md\nTask 1: complete — one\n';
    await log.ticks[0].fn();
    assert.ok(!(await draw()).some((t) => t.startsWith('tasks ')), 'another plan\'s ledger was counted');
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
        const reply = await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
        assert.equal(reply.text, said, JSON.stringify([surfaces, reason]));
    }
});

test('the Pane is laid out in its own body columns and rows, and coloured by the stage', async () => {
    const { width } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-status.ts')).href);
    const hooks = await wired();
    const mine = Object.assign({}, live, { notes: ['一則很長的筆記，'.repeat(8)], claims: ['a.js', 'docs/a/very/long/path/that/goes/on/and/on/and/on/file.md'] });
    const files = Object.assign(entryFile(mine), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: JSON.stringify({ task: '另一個很長的任務標題，'.repeat(6), stage: 'build', active: true, updated: new Date().toISOString(), claims: ['a.js'] }),
    });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const at = (bodyRows) => hooks['ui.render']($, { viewport: { columns: 200, rows: 50 }, props: { bodyColumns: 41, scroll: { offset: 0, bodyRows } } });
    const tree = await at(32);
    for (const row of tree.children) {
        const cells = row.tag === 'Text' ? width(row.children.join('')) : row.children.reduce((n, c) => n + width(c.children.join('')), row.children.length - 1);
        assert.ok(cells <= 41, '41 < ' + cells + ': ' + texts(row).join(' '));
    }
    const heads = (t) => leaves(t).filter((n) => n.props.bold && n.props.color === '#5f5fd7').map((n) => n.children.join(''));
    assert.deepEqual(heads(tree), ['context', 'notes', '其他 session', 'touched 2']);
    const clash = leaves(tree).find((n) => n.children.join('').startsWith('⚑ 共用'));
    assert.deepEqual([clash.props.color, clash.props.bold], ['#ff5f5f', true]);
    const foot = leaves(tree).find((n) => n.children.join('').startsWith('abcdef12'));
    assert.equal(foot.props.color, '#8a8a8a');
    assert.deepEqual(heads(await at(5)), ['context'], 'the room is the body rows the surface gave, not the viewport');
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
