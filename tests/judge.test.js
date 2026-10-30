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

// judge-5: the judge writes its plain summary under ## 白話, and the ask skill
// relays record's plain: block and says how a brief asks for the HTML page.
test('the judge writes a ## 白話 section, and the ask skill relays record\'s plain: block and names html: yes', () => {
    const agent = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-judge.md'), 'utf8');
    const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-ask', 'SKILL.md'), 'utf8');
    assert.match(agent, /^## 白話$/m);
    assert.match(agent, /html: yes/);
    assert.match(agent, /```chartroom/);
    assert.match(skill, /html: yes/);
    assert.match(skill, /plain:/);
    assert.match(skill, /judge\.js html/);
    assert.ok(!/four lines/.test(skill), 'the skill still says the reply is four lines');
    assert.match(skill, /then a `## 白話`/);
    assert.match(agent, /then the plain section, then the summary/);
    const ref = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'subagents.md'), 'utf8');
    assert.match(ref, /`## 白話` that `judge\.js record` prints/);
});

// The ask human: block of a judgement with two questions. The first has its
// assumed option second, the second a branch on the non-assumed side.
const TWO_QUESTIONS = [
    'pick: b',
    'why: fewer stops',
    'ask human:',
    '  - q: 用哪個坡度？',
    '    option: 緩 → 走平路線',
    '      pro: 好走',
    '      con: 慢',
    '    option: 陡 (assumed)',
    '      pro: 快',
    '      con: 累',
    '    reason: 檔案沒有坡度資料',
    '  - q: 要不要開放夜間？',
    '    option: 要 (assumed)',
    '      pro: 方便',
    '      con: 吵',
    '    option: 不要 → 只開白天',
    '      pro: 安靜',
    '      con: 少人',
    '    reason: 沒有人流數據',
    '',
].join('\n');

function writeFile(root, name, text) {
    const file = path.join(root, name);
    fs.writeFileSync(file, text);
    return file;
}

function judgementFile(root) {
    const dir = path.join(root, 'docs', 'judgements');
    return path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.md')));
}

function askedOf(out) {
    const line = out.split('\n').find((l) => l.startsWith('questions: '));
    return JSON.parse(line.slice('questions: '.length));
}

test('record 帶兩題 ask human: 印出 questions JSON 且 frontmatter human: yes；answered 附一次、第二次拒絕', () => {
    const root = seed();
    const answer = writeFile(root, 'two.md', TWO_QUESTIONS);
    const rec = run(root, ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--answer', answer, '--slug', 'ramp']);
    assert.equal(rec.code, 0, rec.out);
    const asked = askedOf(rec.out);
    assert.deepEqual(asked.map((q) => q.header), ['判官 1/2', '判官 2/2']);
    const file = judgementFile(root);
    assert.match(fs.readFileSync(file, 'utf8'), /^human: yes$/m);
    const answers = writeFile(root, 'answers.json', JSON.stringify({ [asked[0].question]: '陡', [asked[1].question]: '不要' }));
    const first = run(root, ['answered', '--session', A, '--record', file, '--answers', answers]);
    assert.equal(first.code, 0, first.out);
    assert.match(first.out, /^decision: 照 不要 → 只開白天$/m);
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.split('## 人類的回答').length - 1, 1);
    const second = run(root, ['answered', '--session', A, '--record', file, '--answers', answers]);
    assert.equal(second.code, 1);
    assert.match(second.out, /人類的回答/);
});

test('record rejects a malformed ask human: block, names the question, and files nothing', () => {
    const root = seed();
    const bad = TWO_QUESTIONS.replace('option: 緩 → 走平路線', 'option: 緩 (assumed)');
    const answer = writeFile(root, 'bad.md', bad);
    const out = run(root, ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--answer', answer, '--slug', 'ramp']);
    assert.equal(out.code, 1);
    assert.match(out.out, /第1題/);
    assert.match(out.out, /assumed/);
    assert.equal(fs.existsSync(path.join(root, 'docs', 'judgements')), false);
});

test('record with no ask human: block writes human: no and prints no questions line', () => {
    const root = seed();
    const out = run(root, ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--answer', path.join(root, 'answer.md'), '--slug', 'ramp']);
    assert.equal(out.code, 0, out.out);
    assert.match(fs.readFileSync(judgementFile(root), 'utf8'), /^human: no$/m);
    assert.ok(!out.out.includes('questions:'));
});

test('answered refuses a record of another session, a missing answer, and a record with no questions', () => {
    const root = seed();
    const rec = run(root, ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--answer', writeFile(root, 'two.md', TWO_QUESTIONS), '--slug', 'ramp']);
    const asked = askedOf(rec.out);
    const file = judgementFile(root);
    const all = writeFile(root, 'all.json', JSON.stringify({ [asked[0].question]: '陡', [asked[1].question]: '要' }));
    const partial = writeFile(root, 'partial.json', JSON.stringify({ [asked[0].question]: '陡' }));
    const wrong = run(root, ['answered', '--session', 'bbbbbbbb-1111-2222-3333-444444444444', '--record', file, '--answers', all]);
    assert.equal(wrong.code, 1);
    assert.match(wrong.out, /session/);
    const short = run(root, ['answered', '--session', A, '--record', file, '--answers', partial]);
    assert.equal(short.code, 1);
    assert.match(short.out, /要不要開放夜間？/);
    assert.ok(!fs.readFileSync(file, 'utf8').includes('## 人類的回答'));

    const plainRoot = seed();
    run(plainRoot, ['record', '--session', A, '--brief', path.join(plainRoot, 'brief.md'), '--answer', path.join(plainRoot, 'answer.md'), '--slug', 'plain']);
    const none = run(plainRoot, ['answered', '--session', A, '--record', judgementFile(plainRoot), '--answers', all]);
    assert.equal(none.code, 1);
    assert.match(none.out, /ask human:/);
});

test('record writes the .html page when human: yes even without html: yes, and prints page:', () => {
    const root = seed();
    const answer = writeFile(root, 'two.md', TWO_QUESTIONS);
    const out = run(root, ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--answer', answer, '--slug', 'ramp']);
    assert.equal(out.code, 0, out.out);
    assert.match(out.out, /^page: .+\.html$/m);
    assert.equal(fs.existsSync(judgementFile(root).replace(/\.md$/, '.html')), true);
});

test('answered rewrites an existing <record>.html sidecar and prints page:', () => {
    const root = seed();
    const rec = run(root, ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--answer', writeFile(root, 'two.md', TWO_QUESTIONS), '--slug', 'ramp']);
    const asked = askedOf(rec.out);
    const file = judgementFile(root);
    const sidecar = file.replace(/\.md$/, '.html');
    fs.writeFileSync(sidecar, 'stale');
    const answers = writeFile(root, 'answers.json', JSON.stringify({ [asked[0].question]: '陡', [asked[1].question]: '要' }));
    const out = run(root, ['answered', '--session', A, '--record', file, '--answers', answers]);
    assert.equal(out.code, 0, out.out);
    assert.match(out.out, /^page: .+\.html$/m);
    assert.notEqual(fs.readFileSync(sidecar, 'utf8'), 'stale');
});
