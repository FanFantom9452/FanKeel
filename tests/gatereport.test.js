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
const { read, parseReport } = require('../lib/gatereport.js');
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

test('a design whose spec is an HTML page under .fankeel/build/ links it as a mockup; any other spec does not', () => {
    const { r, dir } = root();
    const data = { stage: 'design', started: STARTED, moves: [['design', 1]] };
    put(path.join(dir, 'design.md'), 'An approach.\n\nspec: `.fankeel/build/m/mockup.html`\n');
    assert.deepEqual(read(r, data).parts.mockup, { path: '.fankeel/build/m/mockup.html', href: pathToFileURL(path.join(r, '.fankeel/build/m/mockup.html')).href });
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
