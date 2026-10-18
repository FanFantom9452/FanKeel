'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = (name) => import(pathToFileURL(path.join(__dirname, '..', 'hooks', name + '.ts')).href);
const NOW = Date.parse('2026-10-14T06:00:00.000Z');
const M = 60000;
const entry = {
    task: 'Pane 視覺化改版', next: 'task 5 的 agent 回來後跑 pane 測試', stage: 'build', active: true,
    route: ['survey', 'design', 'plan', 'build', 'verify', 'land'],
    clock: { survey: [NOW - 118 * M, NOW - 107 * M], design: [NOW - 106 * M, NOW - 69 * M], plan: [NOW - 68 * M, NOW - 48 * M], build: [NOW - 47 * M, null] },
    moves: [['survey', NOW - 118 * M], ['design', NOW - 106 * M], ['plan', NOW - 68 * M], ['build', NOW - 47 * M]],
    waited: { design: 6 * M, plan: 2 * M, build: 4 * M },
    claims: ['hooks/pane.ts', 'hooks/pane-status.ts'],
    inflight: { stage: 'build', at: NOW - 12 * M, group: 2 },
    notes: ['終端維持文字'],
    updated: new Date(NOW - M).toISOString(),
};
const others = [
    { id: 'b41e07d2-0000-4000-8000-000000000001', entry: { task: 'band 倒數改秒數', stage: 'build', active: true, claims: ['hooks/pane.ts', 'hooks/pane-status.ts'], updated: new Date(NOW - 12 * M).toISOString() } },
    { id: 'c9a2f310-0000-4000-8000-000000000002', entry: { task: 'TODO 歸檔', stage: 'verify', active: true, claims: ['hooks/pane-status.ts'], updated: new Date(NOW - 3 * M).toISOString() } },
];
const context = { tokens: 372000, at: 450000, window: 1000000 };
const limits = [
    { kind: 'five_hour', percentUsed: 46, resetsAt: new Date(NOW + 2.4 * 3600e3).toISOString() },
    { kind: 'seven_day', percentUsed: 64, resetsAt: new Date(NOW + 2.8 * 86400e3).toISOString() },
];
const bandInput = (over) => Object.assign({ entry, others, gateUntil: null, gateAt: null, context, limits, tasks: { done: 4, total: 9 }, cols: 80, now: NOW }, over);
// The route's dots in order, each with its state and its colour: the one hollow ring of r 5 is the station the
// task is at, and a filled r 5 reads as a done dot, so the state list catches a here-dot that is filled again.
function dots(source) {
    return [...source.matchAll(/<circle cx="[\d.]+" cy="11" r="([\d.]+)" fill="(#[0-9a-f]{6}|none)"(?: stroke="(#[0-9a-f]{6})")?/g)]
        .map((m) => ({ r: m[1], fill: m[2], stroke: m[3] })).filter((c) => c.r !== '6.5')
        .map((c) => (c.r === '5' && c.fill === 'none' ? { state: 'here', colour: c.stroke } : c.fill === 'none' ? { state: 'ahead', colour: c.stroke } : { state: 'done', colour: c.fill }));
}
// The text of every <text> element, in order.
const words = (source) => [...source.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

test('altOf is the rows as the terminal draws them, without the rail, one line a row', async () => {
    const { altOf } = await load('pane-svg');
    assert.equal(altOf([[{ text: '▌' }, { text: 'FANKEEL PLAN' }, { text: '●●', gap: 2 }], [{ text: ' ' }, { text: 'ctx ' }, { text: '212k' }]]), 'FANKEEL PLAN  ●●\nctx 212k');
});

test('each dot of the band\'s route is its own station\'s colour, and the state is the shape', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const { RAMP } = await load('pane-band');
    const short = Object.assign({}, entry, { stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'] });
    const seen = dots(bandRow1Svg(bandInput({ entry: short, tasks: null })));
    assert.deepEqual(seen, [
        { state: 'done', colour: RAMP.survey },
        { state: 'here', colour: RAMP.plan },
        { state: 'ahead', colour: '#767676' },
        { state: 'ahead', colour: '#767676' },
        { state: 'ahead', colour: '#767676' },
    ]);
    // The station the task is at is one hollow ring: no filled dot inside it.
    assert.equal((bandRow1Svg(bandInput({ entry: short, tasks: null })).match(/cy="11" r="3\.5"/g) || []).length, 1);
    assert.notEqual(seen[1].colour, RAMP.design);
    // A stage off the route draws every station hollow.
    assert.ok(dots(bandRow1Svg(bandInput({ entry: Object.assign({}, entry, { stage: 'init' }) }))).every((d) => d.state === 'ahead'));
});

test('the band\'s tasks are one cell a task with the count beside them, the same count the text row has', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const { bandRows } = await load('pane-band');
    const source = bandRow1Svg(bandInput());
    const cells = [...source.matchAll(/<rect x="[\d.]+" y="7" width="[\d.]+" height="8" rx="1" fill="(#[0-9a-f]{6})"\/>/g)].map((m) => m[1]);
    assert.deepEqual(cells, [...Array(4).fill('#87af5f'), ...Array(5).fill('#585858')]);
    assert.ok(words(source).includes('4/9'));
    assert.ok(bandRows(bandInput())[0].some((seg) => seg.text === '4/9'));
    assert.ok(!bandRow1Svg(bandInput({ tasks: null })).includes('y="7"'), 'cells drawn with no ledger');
});

test('past ten tasks the band draws one bar as wide as the 5h track, and the band stops growing', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const cells = (source) => (source.match(/<rect x="[\d.]+" y="7" width="[\d.]+" height="8" rx="1" fill="#[0-9a-f]{6}"\/>/g) || []).length;
    const countAt = (source, n) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*>${n}</text>`).exec(source)[1]);
    const four = bandRow1Svg(bandInput({ tasks: { done: 2, total: 4 } }));
    assert.equal(cells(four), 4);
    const ten = bandRow1Svg(bandInput({ tasks: { done: 3, total: 10 } }));
    assert.equal(cells(ten), 10);
    const twenty = bandRow1Svg(bandInput({ tasks: { done: 20, total: 20 } }));
    assert.equal(cells(twenty), 0);
    assert.ok(/<rect x="[\d.]+" y="6" width="96" height="10" rx="2"/.test(twenty), 'no 96px track');
    assert.ok(/<rect x="[\d.]+" y="7" width="94" height="8" rx="1\.5" fill="#87af5f"\/>/.test(twenty), 'the bar is not full at 20/20');
    assert.ok(words(twenty).includes('20/20'));
    const eleven = bandRow1Svg(bandInput({ tasks: { done: 0, total: 11 } }));
    const sixty = bandRow1Svg(bandInput({ tasks: { done: 37, total: 60 } }));
    const fill = /<rect x="[\d.]+" y="7" width="([\d.]+)" height="8" rx="1\.5" fill="#87af5f"\/>/;
    assert.equal(Number(fill.exec(sixty)[1]), Math.round(37 / 60 * 94 * 10) / 10);
    assert.ok(!fill.test(eleven), 'a fill at 0/11');
    assert.equal(countAt(eleven, '0/11'), countAt(twenty, '20/20'));
    assert.equal(countAt(sixty, '37/60'), countAt(twenty, '20/20'));
});

test('a waiting gate is a badge and a ring full at the whole wait, with the seconds left beside it', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const source = bandRow1Svg(bandInput({ gateAt: NOW - 18000, gateUntil: NOW + 42000 }));
    assert.ok(words(source).includes('gate 在等'));
    assert.ok(words(source).includes('42 秒'));
    // 42 of 60 seconds left: seven tenths of a circle of r 6.5.
    assert.match(source, /stroke-dasharray="28\.6 40\.8"/);
    // With no `at` the ring is full.
    assert.match(bandRow1Svg(bandInput({ gateAt: null, gateUntil: NOW + 42000 })), /stroke-dasharray="40\.8 40\.8"/);
    assert.ok(!bandRow1Svg(bandInput()).includes('stroke-dasharray'));
});

test('the band\'s second row draws ctx, 5h and 7d as meters, the compact point in ctx, the pace in 7d and ⚑N last', async () => {
    const { bandRow2Svg } = await load('pane-svg');
    const { bandRows } = await load('pane-band');
    const source = bandRow2Svg(bandInput());
    assert.deepEqual(words(source), ['ctx', '372k', '/1M', '5h', '46%', '7d', '64%', '+4%', '⚑2']);
    // The text row carries the same count.
    assert.ok(bandRows(bandInput())[1].some((seg) => seg.text === '372k'));
    // The compact point: a grey line taller than the well, at 450k of 1M.
    assert.match(source, /<rect x="[\d.]+" y="2" width="2" height="18" rx="1" fill="#8a8a8a"\/>/);
    assert.match(source, /<rect x="[\d.]+" y="3" width="1\.5" height="16" fill="#8a8a8a"\/>/);
    // The pace tick sits in both 5h and 7d: two of them.
    assert.equal(source.match(/<rect x="[\d.]+" y="3" width="1\.5" height="16" fill="#8a8a8a"\/>/g).length, 2);
});

test('a narrow band draws ⚑N right after the rail, inside the width, when the row would run past it', async () => {
    const { bandRow2Svg } = await load('pane-svg');
    // cols 24 is 192px; ctx, 5h and 7d alone run past it, so the flag moves to the front.
    const source = bandRow2Svg(bandInput({ cols: 24 }));
    const got = words(source);
    assert.ok(got.includes('⚑2'), 'the flag is not drawn: ' + JSON.stringify(got));
    assert.equal(got[0], '⚑2', 'the flag is not first: ' + JSON.stringify(got));
    const at = /<text x="([\d.]+)"[^>]*>⚑2<\/text>/.exec(source);
    assert.ok(at, 'no <text> for ⚑2');
    // ⚑ is one em (12px) wide and the digit three fifths of one (7.2px): hooks/pane-svg.ts px().
    assert.ok(Number(at[1]) + 12 + 7.2 <= 192, 'the flag ends at ' + (Number(at[1]) + 19.2) + 'px, past 192');
});

test('compact.at off leaves no compact point; with no window it is the count alone; with nothing to draw there is no row', async () => {
    const { bandRow2Svg } = await load('pane-svg');
    const off = bandRow2Svg(bandInput({ context: { tokens: 212000, at: Infinity, window: 1000000 }, limits: [], others: [] }));
    assert.deepEqual(words(off), ['ctx', '212k', '/1M']);
    assert.ok(!off.includes('height="18" rx="1"'), 'a compact point drawn while compact is off');
    const bare = bandRow2Svg(bandInput({ context: { tokens: 212000, at: Infinity }, limits: [], others: [] }));
    assert.deepEqual(words(bare), ['ctx', '212k']);
    assert.ok(!bare.includes('height="10"'), 'a well drawn with nothing to measure against');
    assert.equal(bandRow2Svg(bandInput({ context: null, limits: [], others: [] })), '');
});

test('the Pane\'s route is a column a station: the minutes from clock, the wait from waited, ahead with no bar', async () => {
    const { routeSvg } = await load('pane-svg');
    const source = routeSvg(entry, NOW, 41);
    assert.match(source, /^<svg [^>]*width="328" height="78"/);
    // The names, then each visited station's minutes and the minutes its gate waited.
    assert.deepEqual(words(source), ['survey', 'design', 'plan', 'build', 'verify', 'land', '11分', '37分', '等6', '20分', '等2', '47分', '等4']);
    // Three done dots, the ring and its dot, two hollow.
    assert.equal((source.match(/r="4" fill="#87af5f"/g) || []).length, 3);
    assert.equal((source.match(/r="3\.75" fill="none"/g) || []).length, 2);
    // The station the task is at is one hollow ring in its own colour.
    const { RAMP } = await load('pane-band');
    assert.ok(source.includes(`r="6" fill="none" stroke="${RAMP.build}" stroke-width="2.5"`));
    assert.ok(!/r="2\.5" fill=/.test(source));
    // Each gate's wait is amber at its bar's end.
    assert.equal((source.match(/y="38" width="[\d.]+" height="4" rx="1" fill="#d7af5f"/g) || []).length, 3);
    assert.equal(routeSvg(Object.assign({}, entry, { stage: 'init' }), NOW, 41), '');
});

test('the clash is the shared files on the left, who holds them on the right, one red line a hold', async () => {
    const { clashSvg } = await load('pane-svg');
    const { RAMP } = await load('pane-band');
    const source = clashSvg(entry, others, NOW, 41);
    assert.deepEqual(words(source), ['⚑', 'hooks/pane.ts', '⚑', 'hooks/pane-status.ts', 'band 倒數改秒數', 'build · 12m', 'TODO 歸檔', 'verify · 3m']);
    // pane.ts is held by one neighbour, pane-status.ts by both.
    assert.equal((source.match(/<path /g) || []).length, 3);
    assert.ok(source.includes(`r="3.5" fill="${RAMP.build}"`) && source.includes(`r="3.5" fill="${RAMP.verify}"`));
    assert.equal(clashSvg(entry, [], NOW, 41), '');
});

// A plan of `total` tasks, the first `done` complete, the numbers in `user` the user's.
const planOf = (total, done, user = []) => ({
    name: 'demo',
    done: Array.from({ length: done }, (_, i) => i + 1),
    tasks: Array.from({ length: total }, (_, i) => ({ n: i + 1, name: 'task ' + (i + 1), user: user.includes(i + 1) })),
});

test('the band\'s route starts 12px past its head', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const source = bandRow1Svg(bandInput({ tasks: null }));
    const cx = Number(source.match(/<circle cx="([\d.]+)" cy="11"/)[1]);
    assert.equal(cx, 10 + 'FANKEEL BUILD'.length * 12 * 0.6 + 12);
});

// hooks/pane.ts on a fake engine: the parts of tests/pane.test.js fake() the two drawings read, and `resolve` hands
// out Svg on the desktop alone, as the engine's Elements table does.
globalThis.h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() });
const SID = 'abcdef12-0000-4000-8000-000000000001';
const ROOT = 'F:/proj';
const PLAN = 'docs/plans/2026-10-14-demo.md';
const LEDGER = ROOT + '/.fankeel/build/2026-10-14-demo/progress.md';
const planText = ['# Demo', '', ...Array.from({ length: 9 }, (_, i) => ['## Task ' + (i + 1) + ': task ' + (i + 1), '', '**Dispatch:** ' + (i === 5 ? 'user — look.' : 'implementer, sonnet — code.'), '']).flat(), '## Coverage', ''].join('\n');
function engine({ profile = null, tokens = 400000, bare = false, svgThrows = false } = {}) {
    const logs = [];
    const T = Date.now();
    const mine = Object.assign({}, entry, {
        clock: { survey: [T - 118 * M, T - 107 * M], design: [T - 106 * M, T - 69 * M], plan: [T - 68 * M, T - 48 * M], build: [T - 47 * M, null] },
        moves: [['survey', T - 118 * M], ['design', T - 106 * M], ['plan', T - 68 * M], ['build', T - 47 * M]],
        inflight: { stage: 'build', at: T - 12 * M },
        started: '2026-10-10T20:33:51.000Z', claims: ['hooks/pane.ts', PLAN],
    });
    const store = {
        [ROOT + '/.fankeel/sessions/' + SID + '.json']: JSON.stringify(mine),
        [ROOT + '/.fankeel/sessions/' + others[0].id + '.json']: JSON.stringify(Object.assign({}, others[0].entry, { updated: new Date(T - 12 * M).toISOString() })),
        [ROOT + '/' + PLAN]: planText,
        [LEDGER]: '# fankeel build ledger — plan: ' + PLAN + '\n' + [1, 2, 3, 4].map((n) => 'Task ' + n + ': complete — task ' + n).join('\n') + '\n',
    };
    if (bare) delete store[ROOT + '/.fankeel/sessions/' + others[0].id + '.json'];
    if (profile) store[ROOT + '/.fankeel/profile.json'] = JSON.stringify(profile);
    const ticks = [];
    const stat = (p) => ({ kind: 'file', size: String(store[p]).length, mtimeMs: 1, isLink: false });
    const $ = {
        plugin: { root: 'F:/plugin', name: 'fankeel' },
        session: {
            id: async () => SID,
            root: async () => ROOT,
            usage: async () => ({ startedAt: 0, context: bare ? null : { tokens, window: 1000000, percent: 40 }, rateLimits: bare ? [] : limits }),
            surfaces: async () => ['desktop'],
            surface: async () => 'desktop',
        },
        env: { get: async () => undefined },
        fs: {
            exists: async (p) => Object.keys(store).some((k) => k === p || k.startsWith(p + '/')),
            read: async (p) => store[p],
            stat: async (p) => {
                if (!(p in store)) throw new Error('ENOENT ' + p);
                return stat(p);
            },
            list: async (dir) => Object.keys(store).filter((p) => p.startsWith(dir + '/') && !p.slice(dir.length + 1).includes('/'))
                .map((p) => Object.assign({ name: p.slice(dir.length + 1) }, stat(p))),
        },
        clock: { now: async () => T, every: (ms, fn) => { ticks.push(fn); return { cancel() {} }; } },
        command: { register: async () => ({}) },
        ui: {
            open: async () => ({ isPlaced: true }),
            close: async () => {},
            panes: async () => [],
            invalidate: () => {},
            log: (text, opts) => { logs.push([text, opts]); },
            resolve: (e) => (e.surface === 'desktop' ? { Box: 'Box', Text: 'Text', Button: 'Button', get Svg() { if (svgThrows) throw new Error('no Svg'); return 'Svg'; } } : { Box: 'Box', Text: 'Text', Button: 'Button' }),
        },
    };
    return { $, ticks, store, logs };
}
async function drawn(over) {
    const { register } = await load('pane');
    const hooks = {};
    register((event, a, b) => { hooks[event === 'ui.render' && a && a.component === 'AbovePrompt' ? 'band' : event] = typeof a === 'function' ? a : b; });
    const { $, ticks, store, logs } = engine(over);
    await hooks['session.start']($, {}, async () => ({}));
    await ticks[0]();
    const band = (surface) => hooks.band($, { surface, props: { bodyColumns: 80 } }, async () => 'passed');
    const pane = (surface) => hooks['ui.render']($, { surface, props: { bodyColumns: 41, scroll: { offset: 0, bodyRows: 60 } } });
    return { band, pane, store, logs, tick: ticks[0] };
}
const kids = (tree) => tree.children.filter((c) => c && c.tag);
const textOf = (node) => (node.tag === 'Text' ? String(node.children.join('')) : node.tag === 'Button' ? String(node.props.label) : (node.children || []).filter((c) => c && c.tag).map(textOf).join(''));
// A drawing without its onPress handlers: each render makes new ones, so two renders compare by what they draw.
const bare = (tree) => JSON.parse(JSON.stringify(tree));
// The terminal's rows, without the cell each one opens with.
const plain = (tree) => kids(tree).map(textOf).map((t) => t.slice(1));

test('on Claude Desktop the band is two Svg rows, each alt the row the terminal draws, with the same numbers', async () => {
    const { band } = await drawn();
    const desk = await band('desktop');
    const term = await band('terminal');
    assert.deepEqual(kids(desk).map((n) => n.tag), ['Svg', 'Svg']);
    assert.deepEqual(kids(desk).map((n) => n.props.alt), plain(term));
    for (const n of kids(desk)) assert.ok(n.props.source.startsWith('<svg ') && n.props.source.length <= 131072);
    // Nothing on the band is animated, so neither row is drawn interactive.
    assert.deepEqual(kids(desk).map((n) => n.props.isInteractive), [undefined, undefined]);
    assert.match(plain(term)[0], /tasks 4\/9/);
    assert.ok(words(kids(desk)[0].props.source).includes('4/9'));
    assert.match(plain(term)[1], /400k\/1M/);
    assert.ok(words(kids(desk)[1].props.source).includes('400k'));
});

test('on Claude Desktop the Pane draws the route and the clash as Svg, and the tasks and the rest as the terminal does; no context block, at the threshold or past it', async () => {
    const { pane } = await drawn();
    const desk = await pane('desktop');
    const term = await pane('terminal');
    const svgs = kids(desk).filter((n) => n.tag === 'Svg');
    assert.equal(svgs.length, 2);
    for (const n of svgs) assert.ok(n.props.source.startsWith('<svg ') && n.props.source.length <= 131072);
    assert.deepEqual(svgs.map((n) => n.props.isInteractive === true), [false, false]);
    const rows = plain(term);
    const block = (from, to) => rows.slice(rows.findIndex((t) => t.startsWith(from)), to === undefined ? undefined : rows.findIndex((t) => t.startsWith(to)) - 1).join('\n');
    assert.equal(svgs[0].props.alt, 'survey › design › plan › build › verify\nland');
    assert.equal(svgs[1].props.alt, block('⚑ hooks/pane.ts', '▾ tasks '));
    assert.ok(rows.includes('▾ tasks 4/9'));
    assert.ok(!rows.some((t) => t.startsWith('context')));
    assert.ok(!svgs.some((n) => n.props.alt.startsWith('context')));
    const hot = await drawn({ tokens: 463000 });
    assert.ok(!plain(await hot.pane('terminal')).some((t) => t.startsWith('context')));
    assert.equal(kids(await hot.pane('desktop')).filter((n) => n.tag === 'Svg').length, 2);
    const words2 = kids(desk).filter((n) => n.tag !== 'Svg').map(textOf);
    assert.ok(words2.includes('▌Pane 視覺化改版'));
    assert.ok(words2.some((t) => t.startsWith(' next: task 5')));
    assert.ok(words2.includes('▌notes'));
    assert.ok(words2.some((t) => t.startsWith('▌abcdef12 · /fankeel-panel')));
    // The tasks are the terminal's own rows on the desktop too: a row a task.
    assert.ok(words2.includes(' ◉ 5 task 5 · 出去 12 分'), words2.join('\n'));
    assert.ok(words2.includes(' ○ 7 task 7 · sonnet'), words2.join('\n'));
});

test('every surface but the desktop draws the text exactly, and asks the engine for no Svg', async () => {
    const { band, pane } = await drawn();
    for (const surface of ['terminal', 'vscode', 'mobile']) {
        assert.deepEqual(await band(surface), await band(undefined), surface);
        assert.deepEqual(bare(await pane(surface)), bare(await pane(undefined)), surface);
    }
    const tags = (node) => [node.tag, ...(node.children || []).filter((c) => c && c.tag).flatMap(tags)];
    assert.ok(!tags(await pane('terminal')).includes('Svg'));
});

test('a gate waiting on Claude Desktop draws its ring from the pending file\'s at to its until', async () => {
    const { band, store, tick } = await drawn();
    const T = Date.now();
    store[ROOT + '/.fankeel/build/task-20261010T203351/build-pending.json'] = JSON.stringify({ questions: [{ question: 'Go on?', options: [{ label: 'Yes' }] }], at: T - 30000, until: T + 30000 });
    await tick();
    const row = kids(await band('desktop'))[0];
    assert.ok(words(row.props.source).includes('gate 在等'));
    // Half of the 60 seconds left, give or take the second the test took: about half a circle of 40.8.
    const share = Number(/stroke-dasharray="([\d.]+) 40\.8"/.exec(row.props.source)[1]) / 40.8;
    assert.ok(share > 0.45 && share <= 0.53, String(share));
    assert.match(row.props.alt, /gate 在等/);
});

test('sixty tasks and a long clash stay far under the engine\'s 131072 characters', async () => {
    const { clashSvg, SVG_MAX } = await load('pane-svg');
    const many = Array.from({ length: 20 }, (_, i) => ({ id: 'n' + i, entry: { task: 'y'.repeat(200), stage: 'build', claims: entry.claims } }));
    const { bandRow1Svg, bandRow2Svg, routeSvg } = await load('pane-svg');
    const long = Object.assign({}, entry, { task: 'z'.repeat(300), next: 'w'.repeat(300) });
    const heavy = bandInput({ entry: long, others: many, gateAt: NOW - 18000, gateUntil: NOW + 42000, tasks: { done: 37, total: 60 }, cols: 200 });
    const stages = Array.from({ length: 40 }, (_, i) => 's' + 'x'.repeat(30) + i);
    const longRoute = Object.assign({}, entry, { route: stages, stage: stages[30], clock: Object.fromEntries(stages.slice(0, 31).map((s, i) => [s, [NOW - (40 - i) * M, i === 30 ? null : NOW - (39 - i) * M]])), waited: Object.fromEntries(stages.map((s) => [s, 9 * M])) });
    for (const source of [clashSvg(entry, many, NOW, 41), bandRow1Svg(heavy), bandRow2Svg(heavy), routeSvg(longRoute, NOW, 200)]) {
        assert.ok(source.length > 0 && source.length < SVG_MAX / 4, String(source.length));
    }
    assert.equal(SVG_MAX, 131072);
});

test('the band\'s rail is the clash colour only while a file is shared', async () => {
    const { bandRow1Svg, bandRow2Svg } = await load('pane-svg');
    const { CLASH } = await load('pane-band');
    const rail = (source) => /<rect x="0" y="2" width="3" height="18" fill="(#[0-9a-f]{6})"\/>/.exec(source)[1];
    const apart = [{ id: 'd1', entry: { task: 'elsewhere', stage: 'build', active: true, claims: ['docs/x.md'], updated: new Date(NOW).toISOString() } }];
    for (const draw of [bandRow1Svg, bandRow2Svg]) {
        assert.equal(rail(draw(bandInput())), CLASH);
        assert.notEqual(rail(draw(bandInput({ others: apart }))), CLASH);
        assert.notEqual(rail(draw(bandInput({ others: [] }))), CLASH);
    }
});

test('the band\'s window and compact.at-off wording are the rows bandRows produces', async () => {
    const { bandRow2Svg } = await load('pane-svg');
    const { bandRows } = await load('pane-band');
    for (const ctx of [{ tokens: 212000, at: 450000, window: 1000000 }, { tokens: 212000, at: Infinity, window: 1000000 }, { tokens: 212000, at: Infinity }, { tokens: 212000, at: 450000 }]) {
        const input = bandInput({ context: ctx, limits: [], others: [] });
        const said = bandRows(input)[1].map((s) => s.text.trim()).filter(Boolean);
        const drawn = words(bandRow2Svg(input));
        assert.ok(drawn.length >= 2, JSON.stringify(ctx));
        for (const w of drawn) assert.ok(said.includes(w), `${w} not in ${JSON.stringify(said)} for ${JSON.stringify(ctx)}`);
        assert.equal(drawn.filter((w) => w[0] === '/').length, said.filter((w) => w[0] === '/').length);
    }
});

test('a band with one row on Claude Desktop is one Svg', async () => {
    const { band } = await drawn({ bare: true });
    const term = await band('terminal');
    assert.equal(kids(term).length, 1);
    assert.deepEqual(kids(await band('desktop')).map((n) => n.tag), ['Svg']);
});

test('a band drawing that throws on Claude Desktop falls back to the terminal rows, and logs once to debug', async () => {
    const { band, logs } = await drawn({ svgThrows: true });
    assert.deepEqual(await band('desktop'), await band('terminal'));
    assert.deepEqual(await band('desktop'), await band('terminal'));
    const said = logs.filter(([t]) => /band Svg not drawn/.test(t));
    assert.equal(said.length, 1);
    assert.equal(said[0][1].to, 'debug');
});

test('a Pane drawing that throws on Claude Desktop falls back to the terminal rows, and logs once to debug', async () => {
    const { pane, logs } = await drawn({ svgThrows: true });
    assert.deepEqual(bare(await pane('desktop')), bare(await pane('terminal')));
    assert.deepEqual(bare(await pane('desktop')), bare(await pane('terminal')));
    const said = logs.filter(([t]) => /Pane Svg not drawn/.test(t));
    assert.equal(said.length, 1);
    assert.equal(said[0][1].to, 'debug');
});

test('the band and the Pane drawings both throwing log once each, not again every render', async () => {
    const { band, pane, logs } = await drawn({ svgThrows: true });
    for (let i = 0; i < 3; i++) { await band('desktop'); await pane('desktop'); }
    assert.equal(logs.filter(([t]) => /band Svg not drawn/.test(t)).length, 1);
    assert.equal(logs.filter(([t]) => /Pane Svg not drawn/.test(t)).length, 1);
});

test('paneParts keeps a block as rows when its drawing is empty', async () => {
    const { paneParts } = await load('pane-svg');
    const seg = (text) => ({ text });
    const clashRows = [{ block: 'clash', segs: [seg('▌'), seg('⚑ hooks/pane.ts')] }];
    const base = { id: 'x', entry, others: [], plan: null, cols: 41, room: 60, now: NOW };
    // No other session holds a file: clashSvg draws nothing, so the rows stay.
    assert.deepEqual(paneParts(base, clashRows), [{ rows: clashRows }]);
});

test('paneParts keeps a block as rows when its drawing is over SVG_MAX', async () => {
    const { paneParts } = await load('pane-svg');
    const clashRows = [{ block: 'clash', segs: [{ text: '▌' }, { text: '⚑ hooks/pane.ts' }] }];
    const base = { id: 'x', entry, others: [], plan: null, cols: 41, room: 60, now: NOW };
    // 2000 shared files draw far past 131072 characters.
    const files = Array.from({ length: 2000 }, (_, i) => 'f/' + i + '.ts');
    const big = Object.assign({}, entry, { claims: files });
    const input = Object.assign({}, base, { entry: big, others: [{ id: 'o', entry: { task: 'o', stage: 'build', claims: files } }] });
    assert.deepEqual(paneParts(input, clashRows), [{ rows: clashRows }]);
});

test('paneParts draws nothing as Svg when there is no task', async () => {
    const { paneParts } = await load('pane-svg');
    const rows = [
        { block: 'task', segs: [{ text: '▌' }, { text: 'x' }] },
        { block: 'notes', segs: [] },
        { block: 'notes', segs: [{ text: '▌' }, { text: 'notes' }] },
    ];
    const parts = paneParts({ id: 'x', entry: null, others: [], plan: null, cols: 41, room: 60, now: NOW }, rows);
    assert.deepEqual(parts, [{ rows }]);
});

test('paneParts leaves the tasks block as rows when statusRows cut it to its title', async () => {
    const { paneParts } = await load('pane-svg');
    const rows = [{ block: 'tasks', segs: [{ text: '▌' }, { text: 'tasks' }, { text: ' 4 of 9' }] }];
    const parts = paneParts({ id: 'x', entry, others: [], plan: planOf(9, 4), cols: 41, room: 60, now: NOW }, rows);
    assert.deepEqual(parts, [{ rows }]);
});

test('paneParts: a task titled like a station keeps its title row as Text and the route rows become the Svg', async () => {
    const { paneParts } = await load('pane-svg');
    const { statusRows } = await load('pane-status');
    const named = Object.assign({}, entry, { task: 'build' });
    const input = { id: 'x', entry: named, others: [], plan: null, cols: 41, room: 60, now: NOW };
    const rows = statusRows(input);
    const parts = paneParts(input, rows);
    const svgs = parts.filter((p) => 'source' in p);
    assert.equal(svgs.length, 1);
    assert.ok(parts.some((p) => 'rows' in p && p.rows.some((r) => r.segs.some((s) => s.text === 'build'))));
    assert.equal(svgs[0].alt, 'survey › design › plan › build › verify\nland');
});

test('the band Svg ctx follows the TokenBar tier of the window', async () => {
    const { bandRow2Svg } = await load('pane-svg');
    const row = (ctx) => bandRow2Svg(bandInput({ context: ctx, limits: [], others: [] }));
    // 50% of a 200k window is yellow; 22% of the 450k threshold would be green.
    assert.ok(row({ tokens: 100000, at: 450000, window: 200000 }).includes('#ffff00'));
    const purple = row({ tokens: 170000, at: 450000, window: 200000 });
    assert.deepEqual(words(purple), ['ctx', '170k', '/200k', '⚠']);
    assert.ok(purple.includes('#ff00ff'));
    assert.deepEqual(words(row({ tokens: 900000, at: 950000, window: 1000000 })), ['ctx', '900k', '/1M', '💀']);
    // Same tokens, no window: the threshold decides.
    assert.deepEqual(words(row({ tokens: 372000, at: 450000 })), ['ctx', '372k', '/450k', '⚠']);
});

test('Remote Control connected draws 遠端 ✓ at the end of the first row, the ✓ green', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const on = bandRow1Svg(bandInput({ remote: true }));
    assert.deepEqual(words(on).slice(-2), ['遠端', '✓']);
    assert.match(on, /<text [^>]*fill="#87af5f"[^>]*>✓[<][/]text>/);
    assert.deepEqual(words(bandRow1Svg(bandInput({ remote: true, gateUntil: NOW + 42000 }))).slice(-2), ['遠端', '✓']);
});

test('Remote Control not connected, or not said, draws 遠端 ✗ in the grey text colour, never green or red', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    for (const over of [{ remote: false }, {}]) {
        const off = bandRow1Svg(bandInput(over));
        assert.deepEqual(words(off).slice(-2), ['遠端', '✗']);
        assert.match(off, /<text [^>]*fill="#8a8a8a"[^>]*>✗[<][/]text>/);
        assert.ok(!off.includes('>✓<'));
    }
    assert.deepEqual(words(bandRow1Svg(bandInput({ gateUntil: NOW + 42000 }))).slice(-2), ['遠端', '✗']);
});

test('nothing the band or the Pane draws is animated, and the route is never drawn interactive', async () => {
    const mod = await load('pane-svg');
    const { statusRows } = await load('pane-status');
    assert.equal(mod.breathing, undefined);
    const drawn = [
        mod.bandRow1Svg(bandInput()),
        mod.routeSvg(entry, NOW, 41),
    ];
    for (const source of drawn) assert.ok(!/<animate|fk-br|fk-pulse|class="[^"]*live/.test(source), source.slice(0, 80));
    const input = { id: 'x', entry, others: [], plan: null, cols: 41, room: 60, now: NOW };
    const route = mod.paneParts(input, statusRows(input)).find((p) => 'source' in p && p.alt.startsWith('survey'));
    assert.ok(route && !route.isInteractive);
});

test('paneParts keeps the tasks block as rows, its head Button and a row a task, and draws no Svg for it', async () => {
    const { paneParts } = await load('pane-svg');
    const { statusRows } = await load('pane-status');
    const input = { id: 'x', entry, others: [], plan: planOf(4, 2), cols: 41, room: 60, now: NOW };
    const parts = paneParts(input, statusRows(input));
    assert.deepEqual(parts.filter((p) => 'source' in p).map((p) => p.alt.split('\n')[0]), ['survey › design › plan › build › verify']);
    const kept = parts.filter((p) => 'rows' in p).flatMap((p) => p.rows).filter((r) => r.block === 'tasks' && r.segs.length);
    assert.equal(kept.length, 5);
    assert.equal(kept[0].segs[1].press, 'fold');
    assert.equal((await load('pane-svg')).tasksSvg, undefined);
});
