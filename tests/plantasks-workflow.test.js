'use strict';

// A stage agent has no Workflow tool, so a group of three or more disjoint
// tasks is written as a script the session holding that tool opens by path.
// The script is run here the way the host runs it — plain JavaScript with
// `agent` and `pipeline` in scope and top-level await and return — minus the
// meta line, which the host reads as a literal rather than executes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseTasks, workflowScript, REVIEWER_MODEL } = require('../lib/plantasks.js');

const task = (n, file, dispatch) => [
  '## Task ' + n + ': task ' + n, '',
  '**Files:**', '- Modify: `' + file + '`', '- Test: `tests/t' + n + '.test.js`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** ' + dispatch, '',
].join('\n');

const plan = (d1, d2, d3) => parseTasks([
  task(1, 'lib/a.js:10-40', d1),
  task(2, 'lib/b.js', d2),
  task(3, 'lib/c.js', d3),
].join('\n'));

const TASKS = plan('implementer, sonnet', 'implementer, opus, high — a protocol to reason about.', 'implementer, sonnet');

const OPTS = {
  root: '/repo', plan: 'docs/plans/p.md', stem: 'p', group: 1,
  briefs: { 1: '/repo/.fankeel/build/p/task-1-brief.md', 2: '/repo/.fankeel/build/p/task-2-brief.md', 3: '/repo/.fankeel/build/p/task-3-brief.md' },
};

const IMPLEMENTER = 'fankeel:fankeel-implementer';
const REVIEWER = 'fankeel:fankeel-reviewer';

async function run(script, answer) {
  const calls = [];
  const agent = async (prompt, opts) => { calls.push({ prompt, opts }); return answer(prompt, opts); };
  const pipeline = (items, ...stages) => Promise.all(items.map(async (item, i) => {
    let r = item;
    for (const stage of stages) {
      try { r = await stage(r, item, i); } catch (e) { return null; }
    }
    return r;
  }));
  const body = script.split('\n').slice(1).join('\n');
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const result = await new AsyncFunction('agent', 'pipeline', body)(agent, pipeline);
  const of = (type) => calls.filter((c) => c.opts.agentType === type)
    .sort((a, b) => a.opts.label.localeCompare(b.opts.label));
  return { result, implementers: of(IMPLEMENTER), reviewers: of(REVIEWER) };
}

const answers = (prompt, opts) => (opts.agentType === IMPLEMENTER ? 'done\n' + opts.label : 'clean');

test('the meta line is a JSON literal naming the plan, the tasks and the two phases', () => {
  const first = workflowScript(TASKS, [1, 2, 3], OPTS).split('\n')[0];
  assert.match(first, /^export const meta = /);
  const meta = JSON.parse(first.replace(/^export const meta = /, '').replace(/;$/, ''));
  assert.equal(meta.name, 'fankeel-build-p-g1');
  assert.match(meta.description, /docs\/plans\/p\.md/);
  assert.match(meta.description, /Tasks 1, 2, 3/);
  assert.deepEqual(meta.phases.map((p) => p.title), ['Implement', 'Review']);
});

test('each task goes out as one implementer then one reviewer, on its own model and effort', async () => {
  const { result, implementers, reviewers } = await run(workflowScript(TASKS, [1, 2, 3], OPTS), answers);
  assert.deepEqual(implementers.map((c) => c.opts.model), ['sonnet', 'opus', 'sonnet']);
  assert.deepEqual(implementers.map((c) => c.opts.effort), [undefined, 'high', undefined]);
  assert.deepEqual(implementers.map((c) => c.opts.phase), ['Implement', 'Implement', 'Implement']);
  assert.deepEqual(reviewers.map((c) => c.opts.model), [REVIEWER_MODEL, REVIEWER_MODEL, REVIEWER_MODEL]);
  assert.deepEqual(reviewers.map((c) => c.opts.effort), [undefined, 'high', undefined]);
  assert.deepEqual(reviewers.map((c) => c.opts.phase), ['Review', 'Review', 'Review']);
  assert.ok(implementers[1].prompt.includes(OPTS.briefs[2]), 'the implementer is pointed at its own brief');
  assert.ok(implementers[1].prompt.includes('/repo'), 'the implementer is told the working tree');
  assert.deepEqual(result.map((r) => r.n), [1, 2, 3]);
  assert.deepEqual(result.map((r) => r.review), ['clean', 'clean', 'clean']);
  assert.equal(result[0].implementer, 'done\nTask 1 implement');
});

test('the reviewer reads a range pinned by path, a ranged Modify entry by its bare path', async () => {
  const { reviewers } = await run(workflowScript(TASKS, [1, 2, 3], OPTS), answers);
  const first = reviewers[0].prompt;
  assert.ok(first.includes('diff HEAD -- lib/a.js tests/t1.test.js'), first);
  assert.ok(!first.includes('lib/a.js:10-40'));
  assert.ok(first.includes('done\nTask 1 implement'), 'the implementer\'s return reaches its reviewer');
  assert.ok(first.includes(OPTS.briefs[1]));
});

test('an implementer that returned nothing gets no reviewer', async () => {
  const skip = (prompt, opts) => (opts.label === 'Task 2 implement' ? null : answers(prompt, opts));
  const { result, reviewers } = await run(workflowScript(TASKS, [1, 2, 3], OPTS), skip);
  assert.deepEqual(reviewers.map((c) => c.opts.label), ['Task 1 review', 'Task 3 review']);
  assert.deepEqual(result[1], { n: 2, implementer: null, review: null });
});

test('a group sending fewer than three implementers has no script', () => {
  assert.equal(workflowScript(TASKS, [1, 2], OPTS), null);
  const inSession = plan('implementer, sonnet', 'implementer, sonnet', 'in-session — one shell call.');
  assert.equal(workflowScript(inSession, [1, 2, 3], OPTS), null);
});

test('a task with no model on its Dispatch line is refused by name', () => {
  const bare = plan('implementer, sonnet', 'implementer — no model named.', 'implementer, sonnet');
  assert.throws(() => workflowScript(bare, [1, 2, 3], OPTS), /Task 2/);
});

test('the script reads no clock and no randomness', () => {
  assert.doesNotMatch(workflowScript(TASKS, [1, 2, 3], OPTS), /Date\.now|Math\.random|new Date\(\)/);
});

test('REVIEWER_MODEL is the model agents/fankeel-reviewer.md pins', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-reviewer.md'), 'utf8');
  assert.equal(REVIEWER_MODEL, /^model:\s*(\S+)/m.exec(text)[1]);
});
