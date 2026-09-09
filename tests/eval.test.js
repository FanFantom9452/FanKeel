'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tmp = require('./tmp.js');
const ev = require('../lib/eval.js');

// The shape `claude -p --output-format stream-json --verbose` printed on
// 2026-09-08 (.fankeel/build/eval-probe/probe.jsonl): one object per line.
const call = (name, input) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });
const text = (t) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: t }] } });
const result = (t) => JSON.stringify({ type: 'result', subtype: 'success', result: t, num_turns: 3 });

const START_SHORT = call('Bash', { command: 'node scripts/task.js start --session abc --task "fix typo" --route "build,verify"' });
const START_CLASS = call('Bash', { command: 'node scripts/task.js start --session abc --task "fix typo" --class bounded' });

const grader = (name, meta, body) => ({ name, meta, body: body || '' });
const SHORT = grader('starts-with-short-route', { type: 'tool_used', tool: 'Bash', input_match: 'task\\.js start\\b[^\\n]*--route\\W{1,4}build,verify', min: '1' });
const NO_OTHER = grader('no-other-route', { type: 'tool_used', tool: 'Bash', input_match: 'task\\.js start\\b(?![^\\n]*--route\\W{1,4}build,verify)', max: '0' });
const SAYS = grader('says-it-out-loud', { type: 'regex', target: 'last_message', pattern: 'build[,\\s→]+verify', flags: 'i', match: 'contains' });

test('toolCalls keeps every tool_use in order and skips what is not one', () => {
    const calls = ev.toolCalls([text('hi'), START_SHORT, 'not json', call('Read', { file_path: 'README.md' }), result('done')]);
    assert.deepEqual(calls.map((c) => c.name), ['Bash', 'Read']);
    assert.equal(calls[0].input.command.includes('--route "build,verify"'), true);
});

test('lastMessage prefers the result object and falls back to the last text block', () => {
    assert.equal(ev.lastMessage([text('a'), text('b'), result('final')]), 'final');
    assert.equal(ev.lastMessage([text('a'), text('b')]), 'b');
    assert.equal(ev.lastMessage([]), '');
});

test('costOf reads cost and usage off the same result object lastMessage() reads, and is null without one', () => {
    const priced = JSON.stringify({ type: 'result', subtype: 'success', result: 'done', total_cost_usd: 0.0123, usage: { input_tokens: 10, output_tokens: 20 } });
    assert.deepEqual(ev.costOf([priced]), { costUsd: 0.0123, usage: { input_tokens: 10, output_tokens: 20 } });
    assert.equal(ev.costOf([result('done')]), null, 'a result with no total_cost_usd is null, not a partial object');
    assert.equal(ev.costOf([text('a'), text('b')]), null, 'no result message at all is also null');
    assert.equal(ev.costOf([]), null);
});

test('tool_used passes on a matching call and fails on a bounded class', () => {
    const ok = { calls: ev.toolCalls([START_SHORT]), last: '' };
    const bad = { calls: ev.toolCalls([START_CLASS]), last: '' };
    assert.equal(ev.grade(SHORT, ok).pass, true);
    assert.equal(ev.grade(SHORT, bad).pass, false);
    assert.equal(ev.grade(NO_OTHER, ok).pass, true);
    assert.equal(ev.grade(NO_OTHER, bad).pass, false);
});

test('tool_used counts against min and max', () => {
    const twice = { calls: ev.toolCalls([START_SHORT, START_SHORT]), last: '' };
    assert.equal(ev.grade({ ...SHORT, meta: { ...SHORT.meta, max: '1' } }, twice).pass, false);
    assert.equal(ev.grade({ ...SHORT, meta: { ...SHORT.meta, min: '2' } }, twice).pass, true);
    assert.match(ev.grade(SHORT, { calls: [], last: '' }).detail, /0 of min 1/);
});

test('tool_used matches the input as JSON, so a quoted flag still matches', () => {
    // JSON.stringify turns --route "build,verify" into --route \"build,verify\";
    // \W{1,4} in the pattern is what lets the backslash and the quote through.
    const json = JSON.stringify(ev.toolCalls([START_SHORT])[0].input);
    assert.equal(json.includes('\\"build,verify\\"'), true);
    assert.equal(ev.grade(SHORT, { calls: ev.toolCalls([START_SHORT]), last: '' }).pass, true);
});

test('regex on last_message flips with contains and not_contains', () => {
    const said = { calls: [], last: 'class: bounded — route build → verify' };
    const silent = { calls: [], last: 'Fixed the typo.' };
    assert.equal(ev.grade(SAYS, said).pass, true);
    assert.equal(ev.grade(SAYS, silent).pass, false);
    const not = { ...SAYS, meta: { ...SAYS.meta, match: 'not_contains' } };
    assert.equal(ev.grade(not, said).pass, false);
    assert.equal(ev.grade(not, silent).pass, true);
});

test('regex on trace reads every assistant message, last_message only the final one', () => {
    // The first measured run (docs/reports/evidence/2026-09-08-route-typo):
    // the route was said in the first message and the run ended on a question.
    const lines = [text('Route is `build → verify`.'), START_SHORT, text('Verify: fixed.'), result('Should I stand the task down?')];
    const run = { calls: ev.toolCalls(lines), last: ev.lastMessage(lines), texts: ev.assistantText(lines) };
    assert.equal(ev.grade(SAYS, run).pass, false, 'last_message is the question');
    const onTrace = { ...SAYS, meta: { ...SAYS.meta, target: 'trace' } };
    assert.equal(ev.grade(onTrace, run).pass, true, 'the trace holds the first message');
    assert.match(ev.grade(onTrace, run).detail, /in the trace/);
    assert.equal(ev.assistantText([START_SHORT]), '', 'a tool call is not text');
    const unknown = { ...SAYS, meta: { ...SAYS.meta, target: 'files' } };
    assert.equal(ev.grade(unknown, run).pass, false);
    assert.match(ev.grade(unknown, run).detail, /files/);
});

test('an llm grader is skipped, not failed', () => {
    const g = ev.grade(grader('judge', { type: 'llm', focus: 'last_message' }, 'PASS if …'), { calls: [], last: 'x' });
    assert.equal(g.pass, null);
    assert.match(g.detail, /skipped/);
});

test('an unknown grader type is a failure that says so', () => {
    const g = ev.grade(grader('odd', { type: 'file_exists', path: '*.md' }), { calls: [], last: '' });
    assert.equal(g.pass, false);
    assert.match(g.detail, /file_exists/);
});

test('listValue reads a bracketed list and an empty value', () => {
    assert.deepEqual(ev.listValue('[Read, Edit, Bash]'), ['Read', 'Edit', 'Bash']);
    assert.deepEqual(ev.listValue('Read'), ['Read']);
    assert.deepEqual(ev.listValue(''), []);
    assert.deepEqual(ev.listValue(undefined), []);
});

test('parseCase reads a case directory written the official way', () => {
    const dir = tmp('fankeel-eval-');
    fs.mkdirSync(path.join(dir, 'graders'));
    fs.writeFileSync(path.join(dir, 'case.yaml'), 'schema_version: "1.1"\nname: sample\ncontext:\n  scaffold_script: "printf x > a.txt"\n');
    fs.writeFileSync(path.join(dir, 'prompt.md'), '---\nname: sample\nmax_turns: 4\nallowed_tools: [Read, Bash]\n---\n/fankeel do the thing\n');
    fs.writeFileSync(path.join(dir, 'graders', 'g.md'), '---\ntype: regex\ntarget: last_message\npattern: thing\n---\n');
    const c = ev.parseCase(dir);
    assert.equal(c.name, 'sample');
    assert.equal(c.prompt.body.trim(), '/fankeel do the thing');
    assert.equal(c.prompt.meta.max_turns, '4');
    assert.deepEqual(ev.listValue(c.prompt.meta.allowed_tools), ['Read', 'Bash']);
    assert.equal(c.scaffold, 'printf x > a.txt');
    assert.deepEqual(c.graders.map((g) => [g.name, g.meta.type]), [['g', 'regex']]);
});

test('parseCase without case.yaml has no scaffold, and without prompt.md throws', () => {
    const dir = tmp('fankeel-eval-');
    fs.mkdirSync(path.join(dir, 'graders'));
    fs.writeFileSync(path.join(dir, 'prompt.md'), '---\nname: bare\n---\nhello\n');
    assert.equal(ev.parseCase(dir).scaffold, null);
    const empty = tmp('fankeel-eval-');
    assert.throws(() => ev.parseCase(empty), /prompt\.md/);
});

test('the shipped case reads back the way the design promised', () => {
    const c = ev.parseCase(path.join(__dirname, '..', 'evals', 'route-typo'));
    assert.equal(c.name, 'route-typo');
    assert.match(c.prompt.body.trim(), /^\/fankeel /);
    const tools = ev.listValue(c.prompt.meta.allowed_tools);
    assert.equal(tools.includes('AskUserQuestion'), false, 'headless has nobody to answer it');
    assert.equal(tools.includes('Bash'), true, 'task.js start runs through Bash');
    assert.match(c.scaffold, /teh/i);
    assert.deepEqual(c.graders.map((g) => [g.name, g.meta.type]), [
        ['no-other-route', 'tool_used'],
        ['says-it-out-loud', 'regex'],
        ['starts-with-short-route', 'tool_used'],
    ]);
    for (const g of c.graders) assert.doesNotThrow(() => new RegExp(g.meta.input_match || g.meta.pattern), g.name + ' regex compiles');
});

test('the shipped scaffold_script builds the fixture it describes', () => {
    // scripts/eval.js hands the string to `bash -c` exactly as parseCase
    // returns it, so this runs it the same way: an escape that YAML would
    // have unfolded and bash then mangles shows up here as a README with no
    // newline, which is what the first version of this file produced.
    const { spawnSync } = require('node:child_process');
    const c = ev.parseCase(path.join(__dirname, '..', 'evals', 'route-typo'));
    const dir = tmp('fankeel-eval-');
    const r = spawnSync('bash', ['-c', c.scaffold], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), 'Teh keel of a project.\n');
    const log = spawnSync('git', ['log', '--oneline'], { cwd: dir, encoding: 'utf8' });
    // An empty stdout splits to one line too, so the exit code and the
    // non-empty line are what say a repository with one commit is there.
    assert.equal(log.status, 0, 'git log ran: ' + log.stderr);
    const lines = log.stdout.trim().split('\n').filter(Boolean);
    assert.equal(lines.length, 1, 'one commit, got: ' + JSON.stringify(log.stdout));
});

const { execFileSync, spawnSync } = require('node:child_process');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'eval.js');
// Destructured on purpose: tests/source.test.js credits an export as imported
// only when it sees `mod.name` or a destructuring require, and runOnce is the
// one name nothing here can call without spending money.
const { usage, parseArgs, runOnce, render, verdict, main, cmdQuote } = require('../scripts/eval.js');

test('cmdQuote wraps an argument so a space or an & survives cmd.exe', () => {
    assert.equal(cmdQuote('C:\\Program Files\\x'), '"C:\\Program Files\\x"');
    assert.equal(cmdQuote('a&b'), '"a&b"');
    assert.equal(cmdQuote('say "hi"'), '"say \\"hi\\""');
    assert.equal(cmdQuote(12), '"12"');
    // A trailing backslash would escape the closing quote; it is doubled.
    assert.equal(cmdQuote('C:\\Program Files\\x\\'), '"C:\\Program Files\\x\\\\"');
    assert.equal(cmdQuote('a\\"b'), '"a\\\\\\"b"');
});

test('eval.js --help prints usage and exits 0', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' });
    assert.match(out, /eval\.js <case dir>/);
    assert.match(out, /--setting-sources project/);
    assert.match(usage(), /case dir/);
    assert.equal(main(['--help']), 0);
    assert.equal(typeof runOnce, 'function');
});

test('eval.js with no case dir, or a dir with no prompt.md, exits 1 and says why', () => {
    const none = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    assert.equal(none.status, 1);
    assert.match(none.stdout + none.stderr, /case dir/);
    const empty = spawnSync(process.execPath, [SCRIPT, tmp('fankeel-eval-')], { encoding: 'utf8' });
    assert.equal(empty.status, 1);
    assert.match(empty.stdout + empty.stderr, /prompt\.md/);
});

test('parseArgs defaults: plugin dir is the repository, one run, no json', () => {
    const a = parseArgs(['evals/route-typo']);
    assert.equal(a.dir, 'evals/route-typo');
    assert.equal(path.resolve(a.pluginDir), path.resolve(__dirname, '..'));
    assert.equal(a.runs, null);
    assert.equal(a.json, null);
    assert.equal(parseArgs(['x', '--runs', '2', '--model', 'haiku', '--json', 'o.json']).runs, 2);
});

test('parseArgs has no default model — missing --model comes back null, never sonnet', () => {
    assert.equal(parseArgs(['evals/route-typo']).model, null);
    assert.equal(parseArgs(['x', '--model', 'haiku']).model, 'haiku');
});

test('parseArgs reads --max-budget-usd, defaulting to null', () => {
    assert.equal(parseArgs(['x']).maxBudgetUsd, null);
    assert.equal(parseArgs(['x', '--max-budget-usd', '2.50']).maxBudgetUsd, '2.50');
});

test('render prints one line per grader per run and a score, and fails on any fail', () => {
    const c = { name: 'route-typo' };
    const runs = [{ graders: [
        { name: 'a', type: 'tool_used', pass: true, detail: 'Bash: 1 call' },
        { name: 'b', type: 'regex', pass: false, detail: 'did not find' },
        { name: 'c', type: 'llm', pass: null, detail: 'skipped: x' },
    ], toolCalls: 4, lastMessage: 'done', exit: 0, error: null }];
    const text = render(c, runs);
    assert.match(text, /route-typo run 1 a pass — Bash: 1 call/);
    assert.match(text, /route-typo run 1 b fail — did not find/);
    assert.match(text, /route-typo run 1 c skipped — skipped: x/);
    assert.match(text, /score 1\/2/);
    assert.equal(verdict(runs), 1);
    assert.equal(verdict([{ ...runs[0], graders: runs[0].graders.filter((g) => g.pass !== false) }]), 0);
    assert.equal(verdict([{ ...runs[0], graders: [], error: 'claude exited 1' }]), 1);
    assert.equal(verdict([]), 1, 'no run is no evidence');
});

test('render prints a cost line for a run that carries one, and none for a run that does not', () => {
    const c = { name: 'x' };
    const priced = [{ graders: [], error: null, cost: { costUsd: 0.05, usage: { input_tokens: 1 } } }];
    const unpriced = [{ graders: [], error: null, cost: null }];
    assert.match(render(c, priced), /x run 1 cost \$0\.0500/);
    assert.equal(/cost \$/.test(render(c, unpriced)), false);
});

test('zero runs is refused before anything is spawned', () => {
    const dir = tmp('fankeel-eval-');
    fs.writeFileSync(path.join(dir, 'prompt.md'), '---\nname: zero\nruns: 0\n---\nhello\n');
    const byCase = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    assert.equal(byCase.status, 1);
    assert.match(byCase.stderr, /runs must be at least 1/);
    const byFlag = spawnSync(process.execPath, [SCRIPT, dir, '--runs', '0'], { encoding: 'utf8' });
    assert.equal(byFlag.status, 1);
    assert.match(byFlag.stderr, /runs must be at least 1/);
});

// This spawns the real scripts/eval.js as a subprocess. Its safety rests on
// main()'s --model guard returning before runOnce ever calls spawnClaude; a
// mutation that defeats the guard (e.g. parseArgs defaulting model back to
// 'sonnet', which also satisfies `if (!a.model)`) lets the run fall through
// and invoke the real `claude` binary. A mutation check on this file should
// use one that reaches none of the spawning tests instead — costOf removed
// from lib/eval.js's exports, for one.
test('eval.js refuses to run without --model, before anything is spawned', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'evals/route-typo'], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
    assert.equal(r.status, 1);
    assert.match(r.stdout + r.stderr, /--model/);
});
