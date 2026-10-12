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

test('the Pane draws the task block on top, then what is looked up, every row behind a rail', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['ui.render:matcher'], { component: 'Pane', requestId: 'fankeel' });
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { notes: ['a note'] })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    assert.deepEqual(paneLines(tree), [
        '▌demo task',
        ' ',
        '▌context  312k · 還 138k 可用',
        '▌████████████▍░░░░░ 到 450k 自動 compact',
        ' ',
        '▌這個 session',
        '▌別的 session 也在改同一個檔時',
        '▌  直接擋下，不能改  guard deny',
        '▌這個任務改過的檔',
        '▌  1 個  claims',
        ' ',
        '▌notes',
        '▌· a note',
        ' ',
        '▌abcdef12 · /fankeel-panel 關閉',
    ]);
    assert.doesNotMatch(paneLines(tree).join('\n'), /touched|survey|▸|本站|2 of 3|bounded/);
    assert.equal(buttons(tree).length, 0);
});

test('the band above the prompt draws the stage, the dots and the minutes, then the context bar, from the registry file', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['band:matcher'], { component: 'AbovePrompt' });
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { next: 'write the plan' })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks.band($, BAND, passed);
    assert.deepEqual(bandLines(tree), ['▌FANKEEL DESIGN  ●●○  等你 0 分', '▌ctx ██████▉░░░ 312k/450k']);
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
    // The task's own pane is the user's to close; the gate that comes after opens it again.
    const mine = fake({ files: entryFile(live) });
    await hooks['session.start'](mine.$, {}, async () => ({}));
    await mine.log.ticks[0].fn();
    await hooks['command.run'](mine.$, { command: 'fankeel-panel', args: '' });
    mine.store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    await mine.log.ticks[0].fn();
    assert.equal(mine.log.opened.length, 2, 'the gate got no pane after the user closed the task\'s');
    delete mine.store[DIR + '/design-pending.json'];
    await mine.log.ticks[0].fn();
    assert.equal(mine.log.closed.length, 2, 'the pane the gate opened stayed up after it');

    const hooks2 = await wired();
    const theirs = fake({ files });
    await hooks2['session.start'](theirs.$, {}, async () => ({}));
    await hooks2['command.run'](theirs.$, { command: 'fankeel-panel', args: '' });
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
    assert.match(log.toasts[0], /\/fankeel-panel/);
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

test('narrow terminal: a gate gives one toast, and /fankeel-panel opens again instead of closing', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log } = fake({ files, placed: false });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(log.toasts.length, 1);
    const before = log.opened.length;
    const reply = await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
    assert.deepEqual(log.closed, []);
    assert.equal(log.opened.length, before + 1);
    assert.doesNotMatch(reply.text, /已關閉/);
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

test('a tick whose ui.open rejected is tried again, the gate still new', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
    store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    const open = $.ui.open;
    let calls = 0;
    $.ui.open = async (p) => { calls += 1; if (calls === 1) throw new Error('busy'); return open(p); };
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 1);
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 2);
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

test('a short pane with a four-option gate keeps the task, every description, every button and the foot', async () => {
    const hooks = await wired();
    const options = ['a', 'b', 'c', 'd'].map((label) => ({ label, description: ('about ' + label + ' at some length, ').repeat(4) + 'end of ' + label }));
    const four = { questions: [{ question: 'Which?', header: 'design', options }], at: 1000, until: Date.now() + 600000 };
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(four) });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 18 } });
    const seen = paneLines(tree);
    const squash = (s) => s.replace(/\s+/g, '');
    const words = squash(texts(tree).filter((t) => t !== '▌').join(''));
    for (const o of options) assert.ok(words.includes(squash(o.description)), 'the description of ' + o.label + ' was dropped');
    assert.ok(seen.length > 14, 'the fixture fits the pane: ' + seen.length);
    assert.equal(buttons(tree).length, 5);
    assert.ok(!texts(tree).includes('context'), 'a block that drops was kept beside a gate taller than the pane');
    // The task block, a blank row, the gate, a blank row, the foot.
    assert.deepEqual(seen.slice(0, 2), ['▌demo task', ' ']);
    assert.match(seen[2], /^▌ gate · design {3}還 \d+ 秒$/);
    assert.deepEqual(seen.slice(-2), [' ', '▌abcdef12 · /fankeel-panel 關閉']);
    const badge = leaves(tree).find((n) => n.props.backgroundColor);
    assert.deepEqual([badge.children.join(''), badge.props.backgroundColor, badge.props.color, badge.props.bold], [' gate · design ', '#d7af5f', '#000000', true]);
    const left = leaves(tree).find((n) => /^ {2}還 \d+ 秒$/.test(n.children.join('')));
    assert.deepEqual([left.props.color, left.props.bold, left.props.backgroundColor], ['#d7af5f', true, undefined]);
    // Every gate row sits behind the gate's own rail, the buttons too.
    const gateRows = tree.children.slice(2, -2);
    for (const row of gateRows) assert.deepEqual([row.children[0].children.join(''), row.children[0].props.color], ['▌', '#d7af5f'], texts(row).join(''));
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

test('a pane the user closes while a tick reads is opened for the gate that tick first sees', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await hooks['command.run']($, { command: 'fankeel-panel', args: '' });
    store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    midTick($, () => hooks['command.run']($, { command: 'fankeel-panel', args: '' }));
    await log.ticks[0].fn();
    assert.equal(log.closed.length, 1);
    assert.equal(log.opened.length, 2, 'the gate got no pane after the user closed it mid-tick');
});

test('with a gate waiting the band\'s first row carries the badge and the seconds left, and never the question', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks.band($, BAND, passed);
    assert.match(bandLines(tree)[0], /^▌FANKEEL DESIGN {2}●●○ {3}gate 在等 {3}還 \d+ 秒 {2}等你 0 分$/);
    assert.equal(bandLines(tree)[1], '▌ctx ██████▉░░░ 312k/450k');
    assert.doesNotMatch(bandLines(tree).join('\n'), /Go on\?/);
    const badge = leaves(tree).find((n) => n.props.backgroundColor);
    assert.deepEqual([badge.children.join(''), badge.props.backgroundColor, badge.props.color, badge.props.bold], [' gate 在等 ', '#d7af5f', '#000000', true]);
});

test('the two drawings agree: the band\'s flag counts the sessions the Pane names, and both show the same context numbers', async () => {
    const hooks = await wired();
    const mine = Object.assign({}, live, { claims: ['a.js', 'b.js', 'c.js', 'd.js'] });
    const peer = (task, claims) => JSON.stringify({ task, stage: 'build', active: true, updated: new Date().toISOString(), claims });
    const files = Object.assign(entryFile(mine), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: peer('shares b', ['b.js']),
        [ROOT + '/.fankeel/sessions/22222222-0000-4000-8000-000000000003.json']: peer('shares c and a', ['c.js', 'a.js', 'b.js']),
        [ROOT + '/.fankeel/sessions/33333333-0000-4000-8000-000000000004.json']: peer('shares nothing', ['z.js']),
    });
    const { $, log } = fake({ files });
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
    // The same tokens and the same threshold, each written the one way.
    const [, bandTokens, bandAt] = band[1].match(/ctx \S+ (\d+k)\/(\d+k)/);
    const [, paneTokens] = pane.find((t) => t.startsWith('▌context')).match(/^▌context {2}(\d+k)/);
    const [, paneAt] = pane.find((t) => t.includes('自動 compact')).match(/到 (\d+k) 自動 compact$/);
    assert.deepEqual([bandTokens, bandAt], [paneTokens, paneAt]);
    assert.deepEqual([bandTokens, bandAt], ['312k', '450k']);
});

test('the context block shows the tokens against FANKEEL_COMPACT_AT, and a new count redraws', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: '300000' } });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const rest = leaves(tree).find((n) => n.children.join('') === ' 已到 300k，compact 中');
    assert.ok(rest, paneLines(tree).join(' | '));
    assert.deepEqual([rest.props.color, rest.props.bold], ['#d7af5f', true]);
    assert.ok(texts(tree).includes('  312k'));
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ██████████ 312k/300k ⚠');
    const after = log.invalidated;
    log.tokens = 320000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.ok(texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).includes('  320k'));
});

test('the context count is coloured by how far it is to the threshold, bold from sixty percent', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: '100000' } });
    await hooks['session.start']($, {}, async () => ({}));
    const count = async (tokens) => {
        log.tokens = tokens;
        await log.ticks[0].fn();
        const leaf = leaves(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).find((n) => n.children.join('') === '  ' + Math.round(tokens / 1000) + 'k');
        return [leaf.props.color, leaf.props.bold];
    };
    assert.deepEqual(await count(5000), ['#00ff00', undefined]);
    assert.deepEqual(await count(35000), ['#d7ffd7', undefined]);
    assert.deepEqual(await count(36000), ['#d7ff00', undefined]);
    assert.deepEqual(await count(40000), ['#ffff00', undefined]);
    assert.deepEqual(await count(45000), ['#ffd700', undefined]);
    assert.deepEqual(await count(50000), ['#ffaf00', undefined]);
    assert.deepEqual(await count(55000), ['#ff8700', undefined]);
    assert.deepEqual(await count(60000), ['#ff0000', true]);
    assert.deepEqual(await count(65000), ['#ff0087', true]);
    assert.deepEqual(await count(70000), ['#ff00af', true]);
    assert.deepEqual(await count(75000), ['#ff00d7', true]);
    assert.deepEqual(await count(80000), ['#ff00ff', true]);
    assert.deepEqual(await count(250000), ['#ff00ff', true]);
});

test('with no FANKEEL_COMPACT_AT the threshold is HARD, and with no token count there is no context block', async () => {
    const { HARD } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'compact.ts')).href);
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: 'soon' } });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const rest = leaves(tree).find((n) => n.children.join('') === ' 到 ' + Math.round(HARD / 1000) + 'k 自動 compact');
    assert.ok(rest, paneLines(tree).join(' | '));
    assert.deepEqual([rest.props.color, rest.props.bold], ['#8a8a8a', undefined]);
    // Number('Infinity') is not finite: the same rule as hooks/compact.ts threshold.
    const inf = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: 'Infinity' } });
    const infHooks = await wired();
    await infHooks['session.start'](inf.$, {}, async () => ({}));
    await inf.log.ticks[0].fn();
    assert.ok(texts(await infHooks['ui.render'](inf.$, { viewport: { columns: 44, rows: 40 } })).includes(' 到 450k 自動 compact'));
    log.tokens = null;
    await log.ticks[0].fn();
    assert.ok(!texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).includes('context'));
    assert.deepEqual(bandLines(await hooks.band($, BAND, passed)), ['▌FANKEEL DESIGN  ●●○  等你 0 分'], 'a band with no count still drew a second row');
    $.session.usage = async () => { throw new Error('not yet'); };
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /FANKEEL DESIGN/, 'a usage() that throws took the band with it');
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
    const tasks = (seen) => seen.slice(seen.indexOf(seen.find((t) => t.startsWith('▌tasks '))), seen.indexOf('▌context  312k · 還 138k 可用') - 1);
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.deepEqual(tasks(await draw()), ['▌tasks 1 of 2', '▌● 1 one', '▌◐ 2 two · 你的']);
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], / {2}tasks 1\/2 {2}/);
    const after = log.invalidated;
    store[LEDGER] += 'Task 2: complete — two\n';
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.deepEqual(tasks(await draw()), ['▌tasks 2 of 2', '▌● 1 one', '▌● 2 two']);
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

test('the Pane is laid out in its own body columns and rows, each block behind its own rail', async () => {
    const { width } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-status.ts')).href);
    const hooks = await wired();
    const mine = Object.assign({}, live, { task: '一個很長的任務標題，'.repeat(6), notes: ['一則很長的筆記，'.repeat(8)], claims: ['a.js', 'docs/a/very/long/path/that/goes/on/and/on/and/on/file.md'] });
    const files = Object.assign(entryFile(mine), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: JSON.stringify({ task: '另一個很長的任務標題，'.repeat(6), stage: 'build', active: true, updated: new Date().toISOString(), claims: mine.claims }),
    });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const at = (bodyRows) => hooks['ui.render']($, { viewport: { columns: 200, rows: 50 }, props: { bodyColumns: 41, scroll: { offset: 0, bodyRows } } });
    const tree = await at(32);
    for (const row of tree.children) {
        const cells = width(texts(row).join(''));
        assert.ok(cells <= 41, '41 < ' + cells + ': ' + texts(row).join(''));
        if (row.tag === 'Box') assert.equal(row.children[0].children.join(''), '▌');
    }
    const title = leaves(tree).filter((n) => n.props.bold && n.props.color === undefined).map((n) => n.children.join(''));
    assert.equal(title.join(''), mine.task, 'the title is not drawn whole');
    assert.equal(title.length, 3);
    const RAIL = { '#d787af': 'context', '#5fafaf': 'session', '#87afd7': 'notes' };
    const heads = (t) => leaves(t).filter((n) => n.props.bold && RAIL[n.props.color]).map((n) => [n.children.join(''), RAIL[n.props.color]]);
    assert.deepEqual(heads(tree), [['context', 'context'], ['這個 session', 'session'], ['notes', 'notes']]);
    const rails = (t) => [...new Set(t.children.filter((row) => row.tag === 'Box').map((row) => row.children[0].props.color))];
    assert.deepEqual(rails(tree), [undefined, '#ff5f5f', '#d787af', '#5fafaf', '#87afd7', '#585858']);
    const clash = leaves(tree).filter((n) => n.children.join('').startsWith('⚑ '));
    assert.equal(clash.length, 2);
    assert.deepEqual(clash.map((n) => [n.props.color, n.props.bold]), [['#ff5f5f', true], ['#ff5f5f', true]]);
    assert.ok(clash[1].children.join('').startsWith('⚑ …') && clash[1].children.join('').endsWith('file.md'));
    assert.equal(paneLines(tree).filter((t) => /… @ build · \d+m$/.test(t)).length, 2);
    const foot = leaves(tree).find((n) => n.children.join('').startsWith('abcdef12'));
    assert.equal(foot.props.color, '#8a8a8a');
    // 22 rows in all: the task 3, the clash 4, context 2, session 5, notes 2, the foot 1, and five blank rows between.
    assert.equal(tree.children.length, 22);
    assert.deepEqual(heads(await at(15)).map((h) => h[1]), ['context'], 'the room is the body rows the surface gave, not the viewport');
});

test('the engine\'s rate limits are drawn on the band and in the Pane, and a new figure redraws', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    const limits = [{ kind: 'five_hour', percentUsed: 66 }, { kind: 'seven_day', percentUsed: 58 }];
    $.session.usage = async () => ({ startedAt: 0, context: { tokens: log.tokens, window: 1000000, percent: 31 }, rateLimits: limits });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ██████▉░░░ 312k/450k  │  5h ██████▌░░░  66%  │  7d █████▊░░░░  58%');
    const pane = paneLines(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } }));
    const at = pane.indexOf('▌用量額度');
    assert.deepEqual(pane.slice(at, at + 3), ['▌用量額度', '▌5h ██████▌░░░  66%  剩 34%', '▌7d █████▊░░░░  58%  剩 42%']);
    const after = log.invalidated;
    limits[0] = { kind: 'five_hour', percentUsed: 67 };
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    // An engine that reports no limits at all: the band is ctx alone and the Pane has no quota block.
    $.session.usage = async () => ({ startedAt: 0, context: { tokens: log.tokens } });
    await log.ticks[0].fn();
    assert.equal(bandLines(await hooks.band($, BAND, passed))[1], '▌ctx ██████▉░░░ 312k/450k');
    assert.ok(!paneLines(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } })).includes('▌用量額度'));
});

test('while a gate waits a new second redraws, so both countdowns move; with none it does not', async () => {
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

    const hooks3 = await wired();
    const gated = fake({ files: entryFile(live) });
    await hooks3['session.start'](gated.$, {}, async () => ({}));
    await gated.log.ticks[0].fn();
    await command(hooks3, gated.$);
    gated.store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    await gated.log.ticks[0].fn();
    gated.store[SESSION] = ended;
    await gated.log.ticks[0].fn();
    assert.equal(gated.log.closed.length, 2, 'the pane a gate opened was left up, or closed twice, when the task ended');
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

test('a close that rejects when the gate goes is tried again on the next tick, once', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    const close = $.ui.close;
    let calls = 0;
    $.ui.close = async (p) => { calls += 1; if (calls === 2) throw new Error('busy'); return close(p); };
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await command(hooks, $);
    assert.equal(log.closed.length, 1);
    store[DIR + '/design-pending.json'] = JSON.stringify(gate);
    await log.ticks[0].fn();
    assert.equal(log.opened.length, 2, 'the gate got no pane after the user closed the task\'s');
    delete store[DIR + '/design-pending.json'];
    await log.ticks[0].fn();
    assert.equal(log.closed.length, 1, 'the rejected close was recorded');
    await log.ticks[0].fn();
    assert.equal(log.closed.length, 2, 'the pane the gate opened stayed up after a close that rejected');
    await log.ticks[0].fn();
    assert.equal(log.closed.length, 2, 'closed again on a later tick');
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
    assert.deepEqual((await draw()).slice(-3), [' ', '▌surfaces [terminal, desktop] · surface terminal', '▌abcdef12 · /fankeel-panel 關閉']);
    const after = log.invalidated;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after, 'the same surfaces redrew');
    surfaces.length = 0;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.deepEqual((await draw()).slice(-2), ['▌surfaces [] · surface null', '▌abcdef12 · /fankeel-panel 關閉']);
    $.session.surface = async () => { throw new Error('gone'); };
    await log.ticks[0].fn();
    assert.deepEqual((await draw()).slice(-2), ['▌surfaces ? · Error: gone', '▌abcdef12 · /fankeel-panel 關閉']);
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
