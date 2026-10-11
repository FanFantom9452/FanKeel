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

function fake({ files = {}, placed = true } = {}) {
    const log = { opened: [], closed: [], toasts: [], invalidated: 0, commands: [], ticks: [], ids: 0, lists: [] };
    const store = Object.assign({}, files);
    const mtimes = {};
    const $ = {
        plugin: { root: 'F:/plugin', name: 'fankeel' },
        session: { id: async () => { log.ids += 1; await new Promise((r) => setTimeout(r, 10)); return ID; }, root: async () => ROOT + '/sub' },
        fs: {
            exists: async (p) => Object.keys(store).some((k) => k === p || k.startsWith(p + '/')),
            read: async (p) => store[p],
            write: async (p, text) => { store[p] = text; },
            stat: async (p) => {
                if (!(p in store)) throw new Error('ENOENT ' + p);
                return { kind: 'file', size: 1, mtimeMs: p in mtimes ? mtimes[p] : 1, isLink: false };
            },
            list: async (dir) => log.lists.push(dir) && Object.keys(store).filter((p) => p.startsWith(dir + '/') && !p.slice(dir.length + 1).includes('/'))
                .map((p) => ({ name: p.slice(dir.length + 1), kind: 'file', size: 1, mtimeMs: 1, isLink: false })),
        },
        clock: { every: (ms, fn) => { log.ticks.push({ ms, fn }); return { cancel() {} }; } },
        command: { register: async (c) => { log.commands.push(c); return { command: c.name }; } },
        ui: {
            open: async (p) => { log.opened.push(p); return placed ? { isPlaced: true } : { isPlaced: false, reason: 'narrow' }; },
            close: async (p) => { log.closed.push(p); },
            panes: async () => (log.opened.length > log.closed.length ? [{ id: 'fankeel', isPlaced: placed }] : []),
            toast: (t) => { log.toasts.push(t); },
            invalidate: () => { log.invalidated += 1; },
            log: () => {},
            resolve: () => ({ Box: 'Box', Text: 'Text', Button: 'Button' }),
        },
    };
    return { $, log, store, mtimes };
}

async function wired() {
    const { register } = await load();
    const hooks = {};
    register((event, a, b) => { hooks[event] = typeof a === 'function' ? a : b; hooks[event + ':matcher'] = typeof a === 'function' ? null : a; });
    return hooks;
}
const entryFile = (data) => ({ [ROOT + '/.fankeel/sessions/' + ID + '.json']: JSON.stringify(data) });
const texts = (node) => (node.tag === 'Text' || node.tag === 'Button' ? [String(node.children.join(''))] : node.children.flatMap(texts));
const buttons = (node) => (node.tag === 'Button' ? [node] : (node.children || []).filter((c) => c && c.tag).flatMap(buttons));

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

test('ui.render draws the task from the registry file', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['ui.render:matcher'], { component: 'Pane', requestId: 'fankeel' });
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const seen = texts(tree).join('\n');
    assert.match(seen, /demo task/);
    assert.match(seen, /2 of 3/);
    assert.equal(buttons(tree).length, 0);
});

test('a session root ending in a backslash still finds the registry file', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    $.session.root = async () => ROOT + '\\';
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    assert.match(texts(tree).join('\n'), /demo task/);
});

test('ui.render with no active entry draws the empty block', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { active: false })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    assert.match(texts(tree).join('\n'), /\/fankeel/);
    assert.doesNotMatch(texts(tree).join('\n'), /demo task/);
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

test('neighbours are read only while the pane is placed, and opening it redraws with them', async () => {
    const hooks = await wired();
    const other = { task: 'someone else', stage: 'build', active: true, updated: new Date().toISOString() };
    const files = Object.assign(entryFile(live), { [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: JSON.stringify(other) });
    const { $, log } = fake({ files });
    const sessions = ROOT + '/.fankeel/sessions';
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.equal(log.lists.filter((d) => d === sessions).length, 0, 'the sessions directory was listed with the pane closed');
    const before = log.invalidated;
    await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
    assert.ok(log.invalidated > before, 'opening the pane did not redraw');
    assert.ok(log.lists.filter((d) => d === sessions).length >= 1);
    assert.match(texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).join('\n'), /someone else/);
});

test('a short pane with a four-option gate stays inside its rows and keeps head, route, foot and every button', async () => {
    const hooks = await wired();
    const four = { questions: [{ question: 'Which?', header: 'design', options: ['a', 'b', 'c', 'd'].map((label) => ({ label, description: 'about ' + label })) }], at: 1000, until: Date.now() + 600000 };
    const tall = Object.assign({}, live, { task: 'x'.repeat(60) });
    const files = Object.assign(entryFile(tall), { [DIR + '/design-pending.json']: JSON.stringify(four) });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 18 } });
    const seen = texts(tree);
    assert.ok(seen.length <= 14, 'drew ' + seen.length + ' rows in 14');
    assert.equal(buttons(tree).length, 5);
    const all = seen.join('\n');
    assert.match(all, /xxxx/);
    assert.match(all, /2 of 3/);
    assert.match(all, /abcdef12/);
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
