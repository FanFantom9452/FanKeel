'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');
const { firstLine, freePath, indexRow } = require('../scripts/judge.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'judge.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';

function seed() {
    const root = tmp('fankeel-judge-');
    registry.ensureLayout(root);
    registry.writeSession(root, A, { task: 'pick a colour', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: new Date().toISOString(), updated: new Date().toISOString() });
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'README.md'), '# docs\n\n## Judgements\n\n| question | record |\n|---|---|\n\n## Roles\n');
    fs.writeFileSync(path.join(root, 'brief.md'), '# Which ramp?\n\noptions: a, b\n');
    fs.writeFileSync(path.join(root, 'answer.md'), 'pick: b\nwhy: fewer stops\n');
    return root;
}

function run(root, args, input) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8', input }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || ''), code: e.status };
    }
}

test('record writes the file with six frontmatter keys, the brief and the answer verbatim, and one index row', () => {
    const root = seed();
    const out = run(root, ['record', '--session', A, '--brief', 'brief.md', '--answer', 'answer.md', '--slug', 'ramp', '--model', 'fable'].map((a) => (a.endsWith('.md') ? path.join(root, a) : a)));
    assert.equal(out.code, 0, out.out);
    const files = fs.readdirSync(path.join(root, 'docs', 'judgements'));
    assert.equal(files.length, 1);
    assert.match(files[0], /^\d{4}-\d{2}-\d{2}-ramp\.md$/);
    const text = fs.readFileSync(path.join(root, 'docs', 'judgements', files[0]), 'utf8');
    for (const key of ['judged:', 'model: fable', 'agent: fankeel-judge', 'task: "pick a colour"', 'session: ' + A, 'stage: design']) assert.ok(text.includes(key), key);
    assert.ok(text.includes('# Which ramp?\n\noptions: a, b'));
    assert.ok(text.includes('pick: b\nwhy: fewer stops'));
    const index = fs.readFileSync(path.join(root, 'docs', 'README.md'), 'utf8');
    // One row, and the repo's own link convention (`[relpath](relpath)`, see
    // docs/README.md throughout) names the path twice — once as link text,
    // once as href — so one row is two occurrences, not one.
    assert.equal((index.match(/judgements\//g) || []).length, 2);
    assert.match(index, /\| Which ramp\? \| \[judgements\//);
});

test('a second record on the same slug is -2 and the first is byte-identical; stdin is an answer', () => {
    const root = seed();
    const args = ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--slug', 'ramp'];
    run(root, args.concat(['--answer', path.join(root, 'answer.md')]));
    const dir = path.join(root, 'docs', 'judgements');
    const first = fs.readdirSync(dir)[0];
    const before = fs.readFileSync(path.join(dir, first));
    const second = run(root, args.concat(['--answer', '-']), 'pick: a\n');
    assert.equal(second.code, 0, second.out);
    assert.ok(fs.readdirSync(dir).some((f) => f.endsWith('-ramp-2.md')));
    assert.deepEqual(fs.readFileSync(path.join(dir, first)), before);
});

test('no session, a stood-down session, or a bad slug exits 1', () => {
    const root = seed();
    const base = ['record', '--brief', path.join(root, 'brief.md'), '--answer', path.join(root, 'answer.md')];
    assert.equal(run(root, base.concat(['--slug', 'x'])).code, 1);
    assert.equal(run(root, base.concat(['--session', A, '--slug', 'Not Ascii'])).code, 1);
    registry.update(root, A, (d) => { d.active = false; return true; });
    assert.equal(run(root, base.concat(['--session', A, '--slug', 'x'])).code, 1);
    assert.equal(fs.existsSync(path.join(root, 'docs', 'judgements')), false);
});

// Filed on 2026-09-11 with nothing under `## Answer`: the answer was drawn from a
// background agent's tasks/<id>.output, which is 0 bytes, and record exited 0.
test('a blank answer exits 1, says where the answer lives, and files nothing', () => {
    const root = seed();
    const args = ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--slug', 'ramp', '--answer', '-'];
    for (const input of ['', ' \n\t\n']) {
        const out = run(root, args, input);
        assert.equal(out.code, 1, JSON.stringify(input));
        assert.match(out.out, /agent-<id>\.jsonl/);
    }
    assert.equal(fs.existsSync(path.join(root, 'docs', 'judgements')), false);
});

// Filed on 2026-10-19 as one line, "Handing back the judgement now.": the judge
// returned through a SubagentHandback call, and the last text message was piped.
function transcript(root, name, entries) {
    const file = path.join(root, name);
    fs.writeFileSync(file, entries.map((content) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content } })).join('\n') + '\n');
    return file;
}

test('--transcript takes the SubagentHandback message over the last text, and the last text where there is none', () => {
    const root = seed();
    const args = ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--slug', 'ramp'];
    const handback = transcript(root, 'agent-h.jsonl', [
        [{ type: 'text', text: 'Reading.' }],
        [{ type: 'tool_use', name: 'SubagentHandback', input: { message: 'pick: b\nwhy: handed back' } }],
        [{ type: 'text', text: 'Handing back the judgement now.' }],
    ]);
    const plain = transcript(root, 'agent-t.jsonl', [
        [{ type: 'text', text: 'Reading.' }],
        [{ type: 'text', text: 'pick: a\nwhy: last text' }],
    ]);
    assert.equal(run(root, args.concat(['--transcript', handback])).code, 0);
    assert.equal(run(root, args.concat(['--transcript', plain])).code, 0);
    const dir = path.join(root, 'docs', 'judgements');
    const read = (end) => fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(end))), 'utf8');
    assert.ok(read('-ramp.md').includes('pick: b\nwhy: handed back') && !read('-ramp.md').includes('Handing back'));
    assert.ok(read('-ramp-2.md').includes('pick: a\nwhy: last text'));
});

test('an answer with no pick: line exits 1, names --transcript, and files nothing', () => {
    const root = seed();
    const args = ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--slug', 'ramp', '--answer', '-'];
    const out = run(root, args, 'All checks done; handing back the judgement now.\n');
    assert.equal(out.code, 1);
    assert.match(out.out, /pick:/);
    assert.match(out.out, /--transcript/);
    assert.equal(run(root, ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--slug', 'ramp', '--answer', '-', '--transcript', 'x.jsonl']).code, 1);
    assert.equal(fs.existsSync(path.join(root, 'docs', 'judgements')), false);
});

test('firstLine strips a leading heading marker and truncates past 120 characters', () => {
    assert.equal(firstLine('# Which ramp?\n\noptions: a, b\n'), 'Which ramp?');
    assert.equal(firstLine('\n\n  \n# Second line is first non-blank\nmore\n'), 'Second line is first non-blank');
    const long = 'x'.repeat(140);
    const got = firstLine(long);
    assert.equal(got.length, 118);
    assert.ok(got.endsWith('…'));
});

test('freePath hands back the base name when free, then -2, then -3', () => {
    const dir = tmp('fankeel-judge-freepath-');
    const base = '2026-09-09-ramp';
    const first = freePath(dir, base);
    assert.equal(first, path.join(dir, base + '.md'));
    fs.writeFileSync(first, 'one');
    const second = freePath(dir, base);
    assert.equal(second, path.join(dir, base + '-2.md'));
    fs.writeFileSync(second, 'two');
    const third = freePath(dir, base);
    assert.equal(third, path.join(dir, base + '-3.md'));
});

test('indexRow appends a row under the heading and reports false with no such heading', () => {
    const dir = tmp('fankeel-judge-indexrow-');
    const withHeading = path.join(dir, 'has-heading.md');
    fs.writeFileSync(withHeading, '# docs\n\n## Judgements\n\n| question | record |\n|---|---|\n\n## Roles\n');
    const ok = indexRow(withHeading, 'Which ramp?', 'judgements/2026-09-09-ramp.md', '2026-09-09T00:00:00.000Z', 'fable');
    assert.equal(ok, true);
    const text = fs.readFileSync(withHeading, 'utf8');
    assert.match(text, /\| Which ramp\? \| \[judgements\/2026-09-09-ramp\.md\]\(judgements\/2026-09-09-ramp\.md\) — \*judged 2026-09-09, fable\*/);
    assert.ok(text.indexOf('## Roles') > text.indexOf('| Which ramp?'));

    const withoutHeading = path.join(dir, 'no-heading.md');
    fs.writeFileSync(withoutHeading, '# docs\n\n## Roles\n');
    const before = fs.readFileSync(withoutHeading, 'utf8');
    const none = indexRow(withoutHeading, 'Which ramp?', 'judgements/2026-09-09-ramp.md', '2026-09-09T00:00:00.000Z', 'fable');
    assert.equal(none, false);
    assert.equal(fs.readFileSync(withoutHeading, 'utf8'), before);
});

// 2026-10-19: a background reader's hand-back reached the top session, not the
// judge that sent it. Readers go out in the foreground, so the result is the
// dispatching agent's own tool result.
const AGENTS = path.join(__dirname, '..', 'agents');

test('the judge sends every reader with run_in_background: false', () => {
    const text = fs.readFileSync(path.join(AGENTS, 'fankeel-judge.md'), 'utf8');
    const reading = text.split('\n## Reading\n')[1].split('\n## ')[0];
    assert.match(reading, /Each goes with\s+`run_in_background: false`/);
    assert.match(reading, /returns to you as a tool result/);
});

test('the stage agent sends every reader with run_in_background: false', () => {
    const text = fs.readFileSync(path.join(AGENTS, 'fankeel-brain.md'), 'utf8');
    const tools = text.split('\n## Tools\n')[1].split('\n## ')[0];
    assert.match(tools, /Every `fankeel:fankeel-reader` goes out with\s+`run_in_background: false`/);
    assert.match(tools, /returns to you as a tool result/);
});
