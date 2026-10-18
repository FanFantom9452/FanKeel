'use strict';
// gate tab §2 (docs/90-agent/plans/2026-10-18-gate-tab-design.md): the newest
// handoff of a session's current stage, parsed by that stage's report
// template, and carried on the station's session detail as `gate`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const { read, parseReport, derive } = require('../lib/gatereport.js');
const tmp = require('./tmp.js');

const SURVEY = path.join(__dirname, '..', 'docs', '90-agent', 'reports', 'evidence', '2026-10-18-gate-tab', 'survey.md');
const TEXT = fs.readFileSync(SURVEY, 'utf8');
const STARTED = '2026-09-11T10:00:00.000Z';
const TASK = '.fankeel/build/task-20260911T100000';
const SID = 'dddddddd-4444-4444-8444-444444444444';
const BARE = 'eeeeeeee-5555-4555-8555-555555555555';

function root() {
    const r = tmp('fankeel-gatereport-');
    const dir = path.join(r, TASK);
    fs.mkdirSync(dir, { recursive: true });
    return { r, dir };
}
// Writes `body` to `file` and dates it `ageMs` back.
function put(file, body, ageMs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    const t = (Date.now() - (ageMs || 0)) / 1000;
    fs.utimesSync(file, t, t);
}

test('this task\'s own survey parses to as many findings as it has path:line — what bullets', () => {
    const bullets = TEXT.match(/^- \S+:\d+ — /gm);
    const p = parseReport('survey', TEXT);
    assert.equal(bullets.length, 5);
    assert.equal(p.findings.length, bullets.length);
    assert.deepEqual(p.findings[0], { path: 'assets/station/station.js', line: 1654, what: '`function navHtml`，station.md:774 還寫 1650' });
    assert.match(p.conclusion, /^結論先說：三件事都有可動手的內容/);
    assert.match(p.class, /^architectural — /);
    assert.ok(p.rest.includes('## 盤點（patrol）'), 'the patrol section is kept as report text');
    assert.ok(!p.rest.some((l) => l.includes('"questions"')), 'the gate block is not report text');
});

test('every non-blank survey line outside the gate block lands somewhere: a finding, a key, the conclusion or rest', () => {
    const body = TEXT.replace(/`{3}json gate\r?\n[\s\S]*?\r?\n`{3}/g, '');
    const lines = body.split(/\r?\n/).filter((l) => l.trim() && l.trim() !== 'then AskUserQuestion');
    const p = parseReport('survey', TEXT);
    const keys = ['planned', 'notFound', 'unknown', 'skipped', 'class', 'route'].filter((k) => k in p);
    assert.equal(lines.length, p.findings.length + p.rest.length + 1 + keys.length);
});

test('design, build and land parse by their own templates, and an unrecognised line is kept', () => {
    const design = [
        'Add a gate tab that reads the newest handoff.',
        '',
        '| file | change | dispatch |',
        '|---|---|---|',
        '| `lib/gatereport.js` | new: reads the report | implementer, opus |',
        '| assets/station/station.js | the tab | implementer, opus — the panels |',
        '',
        'proves it done: tests/gatereport.test.js counts the findings',
        'against the map: no conflict',
        'unverified: the pane order',
        'spec: `.fankeel/build/2026-10-18-gate-tab/mockup.html`',
        'a line nobody planned for',
        'then AskUserQuestion',
    ].join('\n');
    assert.deepEqual(parseReport('design', design), {
        approach: 'Add a gate tab that reads the newest handoff.',
        files: [
            { path: 'lib/gatereport.js', change: 'new: reads the report', dispatch: 'implementer, opus' },
            { path: 'assets/station/station.js', change: 'the tab', dispatch: 'implementer, opus — the panels' },
        ],
        proves: 'tests/gatereport.test.js counts the findings',
        map: 'no conflict',
        unverified: 'the pane order',
        spec: '`.fankeel/build/2026-10-18-gate-tab/mockup.html`',
        rest: ['a line nobody planned for'],
    });
    const build = [
        '- assets/station/station.js +217/-15 — the gate tab',
        '- tests/station-gate-tab.test.js (new) — its panels',
        '- docs/90-agent/reference/station.md +48/-31 — the 關卡 paragraph',
        '- lib/gatereport.js +88/-12 — the reader',
        '',
        'done: 2 of 3 — ledger',
        'docs-check: clean',
        'deferred: pane order — gate-10',
        'then AskUserQuestion',
    ].join('\n');
    assert.deepEqual(parseReport('build', build), {
        files: [
            { path: 'assets/station/station.js', add: 217, del: 15, isNew: false, what: 'the gate tab' },
            { path: 'tests/station-gate-tab.test.js', add: null, del: null, isNew: true, what: 'its panels' },
            { path: 'docs/90-agent/reference/station.md', add: 48, del: 31, isNew: false, what: 'the 關卡 paragraph' },
            { path: 'lib/gatereport.js', add: 88, del: 12, isNew: false, what: 'the reader' },
        ],
        done: { n: 2, m: 3, text: '2 of 3 — ledger' },
        docsCheck: 'clean',
        deferred: 'pane order — gate-10',
        rest: [],
    });
    const land = [
        '1d7cf209 chore: 0.111.26 - plan gate page lands',
        'shipped:',
        '  - the plan tab draws the plan before its gate',
        '  - hovering a card lights what it waits for',
        'suite: suite.js: 1520 pass, 0 fail',
        'cost: $35.88 — 214 requests',
        'open: the pane order is unverified',
        '白話: 以前看不到要核准的步驟；現在問題跳出前，監控站先開一頁列出來。',
        'then AskUserQuestion',
    ].join('\n');
    assert.deepEqual(parseReport('land', land), {
        sha: '1d7cf209',
        subject: 'chore: 0.111.26 - plan gate page lands',
        shipped: ['the plan tab draws the plan before its gate', 'hovering a card lights what it waits for'],
        suite: 'suite.js: 1520 pass, 0 fail',
        cost: '$35.88 — 214 requests',
        open: 'the pane order is unverified',
        plain: '以前看不到要核准的步驟；現在問題跳出前，監控站先開一頁列出來。',
        rest: [],
    });
});

test('read hands back the survey report with its gate question', () => {
    const { r, dir } = root();
    put(path.join(dir, 'survey.md'), TEXT);
    const got = read(r, { stage: 'survey', started: STARTED, moves: [['survey', 1]] });
    assert.equal(got.stage, 'survey');
    assert.equal(got.path, TASK + '/survey.md');
    assert.equal(got.text, TEXT);
    assert.equal(got.gate.questions[0].question, '三件事盤點完了，要怎麼往下走？');
    assert.equal(got.parts.findings.length, 5);
});

test('the newest of the plain report and its group files is read, and a lap reads only its own', () => {
    const { r, dir } = root();
    put(path.join(dir, 'build.md'), 'done: 1 of 2\n', 5000);
    put(path.join(dir, 'build-g2.md'), '- lib/a.js +1/-0 — a\n', 0);
    const got = read(r, { stage: 'build', started: STARTED, moves: [['build', 1]] });
    assert.equal(got.path, TASK + '/build-g2.md');
    assert.equal(got.parts.files.length, 1);
    put(path.join(dir, 'build-2.md'), 'done: 2 of 2\n', 10000);
    put(path.join(dir, 'build.md'), 'done: 1 of 2\n', 0);
    const lap = read(r, { stage: 'build', started: STARTED, moves: [['build', 1], ['verify', 1], ['build', 2]] });
    assert.equal(lap.path, TASK + '/build-2.md', 'an earlier lap\'s file is no candidate, however new');
});

test('no stage or no start reads as null; no file and a file that will not open each say so', () => {
    const { r, dir } = root();
    const data = { stage: 'design', started: STARTED, moves: [['design', 1]] };
    assert.equal(read(r, { started: STARTED }), null);
    assert.equal(read(r, { stage: 'design' }), null);
    assert.deepEqual(read(r, data), { error: 'none', stage: 'design', path: TASK + '/design.md' });
    // A directory named like the report: it is there, and it does not read as a file.
    fs.mkdirSync(path.join(dir, 'design.md'));
    assert.deepEqual(read(r, data), { error: 'unreadable', stage: 'design', path: TASK + '/design.md' });
});

test('a task directory that will not list reads as unreadable, not as no report', () => {
    const r = tmp('fankeel-gatereport-');
    // A file where the task directory goes: listing it fails with ENOTDIR, not ENOENT.
    put(path.join(r, TASK), 'not a directory');
    const got = read(r, { stage: 'build', started: STARTED, moves: [['build', 1]] });
    assert.deepEqual(got, { error: 'unreadable', stage: 'build', path: TASK + '/build.md' });
});

test('a survey quoting the scanner block takes its lead from prose, and its own skipped: over the scanner\'s', () => {
    // The block `node scripts/survey.js gate page` prints, quoted as a report quotes it.
    const text = [
        '# Survey: gate page',
        '',
        'fankeel survey — 2766 files, matching: gate, page',
        'source: git',
        'skipped: 1528 with no pattern for their extension',
        'excluded: 322 archive files, 2 plan files — pass --include-role <role,...> to include',
        '',
        '結論先說：兩件事要動。',
        '',
        '- lib/a.js:3 — a',
        '',
        'skipped: none — every matching file was read',
        'class: small — one file',
    ].join('\n');
    const p = parseReport('survey', text);
    assert.equal(p.conclusion, '結論先說：兩件事要動。');
    assert.equal(p.skipped, 'none — every matching file was read');
    assert.ok(p.rest.includes('source: git'));
    assert.ok(p.rest.includes('skipped: 1528 with no pattern for their extension'));
});

test('a session at a stage with no gate page reads as null, its handoff never copied', () => {
    const { r, dir } = root();
    put(path.join(dir, 'verify.md'), 'verified: all\n');
    assert.equal(read(r, { stage: 'verify', started: STARTED, moves: [['verify', 1]] }), null);
});

test('a lead line with a colon in it is still the lead, not rest', () => {
    const d = parseReport('design', 'Add a tab: it reads the file.\n\nspec: x.md\n');
    assert.equal(d.approach, 'Add a tab: it reads the file.');
    assert.deepEqual(d.rest, []);
    const s = parseReport('survey', 'Three things matter: foo\n\n- lib/a.js:3 — a\n\nLater prose.\n');
    assert.equal(s.conclusion, 'Three things matter: foo');
    assert.deepEqual(s.rest, ['Later prose.']);
});

test('a design whose spec is an HTML page under .fankeel/build/ links it as a mockup; any other spec does not', () => {
    const { r, dir } = root();
    const data = { stage: 'design', started: STARTED, moves: [['design', 1]] };
    put(path.join(dir, 'design.md'), 'An approach.\n\nspec: `.fankeel/build/m/mockup.html`\n');
    assert.deepEqual(read(r, data).parts.mockup, { path: '.fankeel/build/m/mockup.html', href: pathToFileURL(path.join(r, '.fankeel/build/m/mockup.html')).href, shot: null });
    put(path.join(dir, 'design.md'), 'An approach.\n\nspec: docs/90-agent/plans/2026-10-18-gate-tab-design.md\n');
    assert.equal(read(r, data).parts.mockup, null);
});

test('gather puts the report on the session beside tasks, and the detail script carries it', () => {
    const base = tmp('fankeel-gatereport-station-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'projects', 'ws-slug'), { recursive: true });
    registry.ensureLayout(r1);
    const common = { stage: 'build', route: ['survey', 'build', 'verify'], active: false, claims: [],
        started: STARTED, updated: '2026-09-11T10:00:09.000Z', configDir: cfg, ended: { at: '2026-09-11T10:00:09.000Z', reason: 'exit' },
        moves: [['survey', 1], ['build', 2]] };
    registry.writeSession(r1, SID, Object.assign({ task: 'with a transcript' }, common));
    registry.writeSession(r1, BARE, Object.assign({ task: 'without one' }, common));
    fs.writeFileSync(path.join(cfg, 'projects', 'ws-slug', SID + '.jsonl'),
        JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: '2026-09-11T10:00:01.000Z', message: { model: 'claude-sonnet-5', usage: { input_tokens: 900 }, content: [] } }) + '\n');
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: STARTED }) + '\n');
    put(path.join(r1, TASK, 'build.md'), '- lib/a.js +1/-0 — a\n\ndone: 1 of 1\n');
    const m = station.gather({ configDir: cfg });
    const find = (id) => m.registries[0].sessions.find((s) => s.sessionId === id);
    assert.equal(find(SID).gate.path, TASK + '/build.md');
    assert.equal(find(BARE).gate, null, 'no transcript, no detail, no report read');
    assert.ok(station.serializeDetail(find(SID)).includes('"gate":{"stage":"build","path":"' + TASK + '/build.md"'));
});

test('a gate block handoff.readGate refuses reads as no question, the report still drawn', () => {
    const { r, dir } = root();
    const bad = { questions: [{ header: 'h', question: '要往下走嗎？', multiSelect: false, options: [{ label: 'only one', description: 'd' }] }] };
    put(path.join(dir, 'survey.md'), '- lib/a.js:3 — a\n\n```json gate\n' + JSON.stringify(bad) + '\n```\n');
    const got = read(r, { stage: 'survey', started: STARTED, moves: [['survey', 1]] });
    assert.equal(got.gate, null);
    assert.equal(got.parts.findings.length, 1);
});

test('derive splits the survey lead at its numbered points, unknown and skipped into lists, and counts the patrol', () => {
    const p = derive('survey', parseReport('survey', TEXT));
    assert.equal(p.lead.head, '結論先說：三件事都有可動手的內容。');
    assert.equal(p.lead.points.length, 3);
    assert.match(p.lead.points[0], /^gate-10 的觸發條件/);
    assert.deepEqual(p.unknownList, ['pane 在 AskUserQuestion 前或後出現', '800px pane 是否要橫捲（gate-10 自己列為沒驗）', 'model-4 的上游官方頁這次沒重讀（本 stage 沒有網路工具）']);
    assert.deepEqual(p.skippedList, ['1528 個檔案沒有對應語言的宣告模式，只算檔名，不再打開', '沒派 reader，全部自己讀']);
    assert.equal(p.skippedFiles, 1528);
    assert.deepEqual([p.patrol.listed, p.patrol.inTodo], [23, 23]);
    assert.deepEqual(p.patrol.counts, { 'do now': 1, 'needs the user': 0, 'waiting on': 8, keep: 14 });
    assert.deepEqual(p.patrol.groups.map((g) => g.name), ['do now', 'needs the user', 'waiting on']);
    // The parse is untouched: derive adds to a copy.
    assert.equal(parseReport('survey', TEXT).lead, undefined);
    const plain = derive('survey', parseReport('survey', 'One thing.\n\n- a.js:1 — x\nunknown: none\nskipped: none — every file was read\n'));
    assert.deepEqual([plain.lead, plain.unknownList, plain.skippedList, plain.skippedFiles, plain.patrol], [{ head: 'One thing.', points: [] }, [], [], null, null]);
});

test('derive splits design\'s proves and unverified lines into lists', () => {
    const p = derive('design', parseReport('design', 'An approach.\n\nproves it done: a test; another test\nunverified: none\n'));
    assert.deepEqual([p.provesList, p.unverifiedList], [['a test', 'another test'], []]);
});

test('read gives a design mockup its widest screenshot, and land the suite record beside the report', () => {
    const { r, dir } = root();
    const design = { stage: 'design', started: STARTED, moves: [['design', 1]] };
    put(path.join(dir, 'design.md'), 'An approach.\n\nspec: `.fankeel/build/m/mockup.html`\n');
    put(path.join(r, '.fankeel/build/m/mockup.html'), '<html></html>');
    put(path.join(r, '.fankeel/build/m/shot-800/render.png'), 'png');
    put(path.join(r, '.fankeel/build/m/shot-1600/render.png'), 'png');
    const shot = '.fankeel/build/m/shot-1600/render.png';
    assert.deepEqual(read(r, design).parts.mockup.shot, { path: shot, href: pathToFileURL(path.join(r, shot)).href });
    fs.rmSync(path.join(r, '.fankeel/build/m/shot-1600'), { recursive: true });
    fs.rmSync(path.join(r, '.fankeel/build/m/shot-800'), { recursive: true });
    assert.equal(read(r, design).parts.mockup.shot, null);
    const land = { stage: 'land', started: STARTED, moves: [['land', 1]] };
    put(path.join(dir, 'land.md'), '1d7cf209 chore: x\nsuite: suite.js: 3 pass, 1 fail\n');
    assert.equal(read(r, land).parts.run, null);
    put(path.join(dir, 'suite.json'), JSON.stringify({ sha: null, at: STARTED, command: 'node --test tests/', pass: 3, fail: 1, failed: ['x'], ok: false, runs: [] }));
    assert.deepEqual(read(r, land).parts.run, { pass: 3, fail: 1, ok: false, fast: false, command: 'node --test tests/' });
});

test('read counts a build gate\'s verify to build round trips from the session\'s moves', () => {
    const { r, dir } = root();
    put(path.join(dir, 'build-3.md'), 'done: 2 of 2\n');
    put(path.join(dir, 'build.md'), 'done: 1 of 2\n');
    const moves = [['build', 1], ['verify', 2], ['build', 3], ['verify', 4], ['build', 5], ['land', 6]];
    assert.equal(read(r, { stage: 'build', started: STARTED, moves }).parts.rounds, 2);
    assert.equal(read(r, { stage: 'build', started: STARTED, moves: [['build', 1]] }).parts.rounds, 0);
});
