---
status: design-intent
---

# Build workflow written by a script Implementation Plan

**Goal:** a plan's `workflow` group becomes a Workflow script file that `scripts/ledger.js` writes and names, so the session holding the Workflow tool opens it with `scriptPath` instead of authoring one, and one real plan's script is run to completion as the TODO entry `stage-agents-16` requires.
**Architecture:** `lib/plantasks.js` gains `workflowScript`, a pure function from parsed tasks and a group to script text; the script's body is a real function, `buildRun`, serialised with `toString()` so a test can run it under stub `agent` and `pipeline`. `scripts/ledger.js` gains a `workflow --group <N>` verb that checks the group's surface, writes each implementer's brief through the same function `brief <n>` uses, writes `.fankeel/build/<plan stem>/workflow-g<N>.js` and prints its path. A build brain hands that path to its controller in its group report as a `workflow: <path>` line: `workflowOf` in `lib/handoff.js` reads it, `scripts/await.js` prints the instruction to open it with `scriptPath` and message the result back, and keeps the brain's in-flight mark while it waits, and `renderBrainBrief` in `lib/render.js` with `agents/fankeel-brain.md` tells the brain when to write it and what to do with the result. The build skill and the subagents reference say so, and a user task runs the script generated from an already-landed plan in a detached worktree.
**Tech Stack:** Node `>=22.5` (`package.json` `engines`; v24.21.0 here), CommonJS with `'use strict'`, built-in modules only — `package.json` has no dependencies — and `node --test`. The Workflow runtime is the host's: plain JavaScript, `agent()`, `pipeline()`, `export const meta` as a pure literal.
**Spec:** [2026-10-16-build-workflow-script-design.md](2026-10-16-build-workflow-script-design.md)

## Global Constraints

Generated from `node scripts/map.js` (904 markdown files, 25 planned, not built, 276 retired, 19 undeclared), `CONTRIBUTING.md` (this repository has no `CLAUDE.md`), `package.json` and the test suite:

- `lib/*.js`: "Pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction." (`CONTRIBUTING.md`, the Core logic row). `scripts/*.js` are thin wrappers over `lib/`. `lib/plantasks.js` reads a plan and nothing else: it does not read the disk for this feature.
- Tests: `"test": "node --test"`. Every exported name must be imported by something (`tests/source.test.js:117`). A new file is visible to that test only once it is `git add`ed. An implementer runs only its own test command; the parent runs the whole suite before committing.
- `READ_CAP` 1500 and `FILE_CAP` 3 (`lib/plantasks.js:353-354`): at most three `Modify:` entries a task, and a file over 1500 lines named as `path:a-b`.
- Indentation: four spaces in `lib/` and `scripts/`; two in `tests/`. Line endings LF (`.gitattributes`: `* text=auto eol=lf`).
- Ledger tests pin `process.env.CLAUDE_CONFIG_DIR` to a scratch directory and delete `CLAUDE_PROJECT_DIR` (`tests/ledger.test.js:20-24`), and take scratch directories from `tests/tmp.js`.
- In `skills/fankeel-build/SKILL.md`, every paragraph that mentions `ledger.js`, `groups` or `brief` also names the no-plan reader (`/no plan|without a plan|file table|spike/i`, `tests/skills.test.js:442`).
- A Workflow script is plain JavaScript, never TypeScript; its `meta` is a pure literal with `name`, `description` and `phases` whose titles match each `agent()` call's `phase`; it may not call `Date.now()`, `Math.random()` or an argless `new Date()`; every `agent()` call names its `model` (`docs/90-agent/reference/subagents.md:297-303`).
- Off limits, owned by other live sessions: `scripts/task.js`, `tests/plugin-validate.test.js`, `tests/task-todo.test.js`, `tests/hands.test.js`, and the version in `package.json` and every `version:` frontmatter. `hooks/*.ts` belongs to the mod session, which is still running: no task here touches it, and one that finds it must is returned `blocked:`.
- The hand-off line is exactly `workflow: <path>` on a line of its own in a build group report — the `label: value` shape the report already uses for `reads:` and `hands:`. Tasks 3 and 4 read or write this one shape, and nothing else names it differently.
- Caps a test already holds: a controlled stage's block under 2400 characters at the reference root (`tests/render.test.js:781`); a brain brief at most `BRIEF_MAX` at the reference root (`tests/brief.test.js:537`).
- Commit messages: `type: what changed` under 60 characters, one bullet per change with its module, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Risks

- The session `task.js stage 換站時印出新一站的 stage rules` has landed (aa599fb7, 0.111.3), and `lib/render.js` and `lib/stages.js` are clean in git — Task 4 — nothing waits on it; Task 4 reads `lib/render.js` as it is when it starts, not as quoted here.
- Sequencing: Tasks 1-3 can start now; Task 4 needs Task 2; Task 6 needs only Task 2 and can run once Task 2 lands; Task 5 describes Tasks 3 and 4, so it goes last of the dispatched tasks.
- The controlled build block measures up to 2352 of 2400 characters (`blockSizes()` as the plan reviewer ran it; 2059 on the all-stages profile when this plan was written), and `lib/stages.js:655-664` warns of under 20 characters of headroom — Task 3 — no task grows the controller's block: `scripts/await.js` prints the whole instruction on its `workflow` line, which no cap covers, and the controller already does what that line says (`AWAIT_RULE`).
- The build brain brief gains one line and sits nearest `BRIEF_MAX` of all briefs — Task 4 — runs `tests/brief.test.js`; the rest of the rule lives in `agents/fankeel-brain.md`, which no cap holds, so only the path-bearing line is in the brief.
- `tests/task-control.test.js` and `tests/stage-prints-rules.test.js` may assert what `renderBrainBrief` prints — Task 4 — runs both, read-only, beside its own; a failure there is returned as `blocked:` with the failing line, not edited.
- The workflow's result passes through the controller's context when it is relayed to the brain — Task 3 — the script returns status, paths and a review per task and never a diff, and the relay is the one SendMessage the rule names.
- The brain's group number from its mark is not the `groups` row number — Task 4 — the agent-file bullet tells the brain to use the row that holds its tasks.
- A brain that rewrites its report but keeps the `workflow:` line would make the controller open the run twice — Task 3 and Task 4 — `workflowOf` reads the last such line, and the agent file tells the brain to leave the line out when it rewrites the report after the run.
- That a Workflow script may `return` at top level and that `agentType: 'fankeel:fankeel-implementer'` resolves inside one comes from the host's authoring reference, not from a run here — Task 1 and Task 6 — Task 6's run is the check; a refusal there stops Task 6 and is recorded in the TODO entry rather than worked around.
- Workflow agents start in the session's working directory, not in the script's root — Task 1 and Task 6 — the implementer prompt says to cd into the root before every command; after the run Task 6 checks `git -C F:/ymlab/fankeel status --porcelain` names nothing the run wrote.
- The real run's plan edits `docs/90-agent/todo/brief-3.md` and `docs/90-agent/todo/pane-8.md`, which other sessions have modified in the main tree today, and `logicalFile` in `lib/guard.js` maps a linked worktree's edit onto the main tree's path, so `deny` can refuse it — Task 6 — before the run, `git status --porcelain -- docs/90-agent/todo/` in the main tree; while either is still modified there, the run waits for those sessions to land.
- Moving the brief writer into a function can change the bytes `brief <n>` writes — Task 2 — runs `tests/ledger.test.js` and `tests/ledger-brief-prefix.test.js` beside its own file.
- A paragraph inserted into `skills/fankeel-build/SKILL.md` and `docs/90-agent/reference/subagents.md` shifts every `path:line` citation below it — Task 5 — runs `node scripts/docs-check.js` before and after and reports any citation that moved, fixing none outside its Files block.

## Task 1: `workflowScript` writes one group as a Workflow script

**Files:**
- Modify: `lib/plantasks.js` — `REVIEWER_MODEL`, `buildRun` and `workflowScript` below `surfaces`; two names added to `module.exports`
- Test: `tests/plantasks-workflow.test.js`
- Read: `agents/fankeel-reviewer.md` — its `model:` line, which `REVIEWER_MODEL` must equal
- Read: `skills/fankeel-build/SKILL.md` — step 5's reviewer template, which the reviewer prompt adapts to a path-pinned range

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: `workflowScript(tasks, group, opts)` — `tasks` as `parseTasks` returns them, `group` an array of task numbers, `opts` `{ root: string, plan: string, stem: string, group: number, briefs: { [n]: string } }`; returns the script text, or `null` when fewer than three tasks in `group` carry an `implementer` Dispatch line; throws an `Error` whose message names every such task with no model. `REVIEWER_MODEL` — the string `'sonnet'`.

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

Steps:

1. Write the failing test. Create `tests/plantasks-workflow.test.js`:

In `tests/plantasks-workflow.test.js`, the whole file:

```js
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
```

2. Run it and watch it fail: `node --test tests/plantasks-workflow.test.js` — every test fails, `workflowScript is not a function`.

3. Write the minimal implementation.

In `lib/plantasks.js`, directly below `surfaces()` and above the comment that opens `fences()`, add:

```js
// The model `agents/fankeel-reviewer.md` pins. A Workflow `agent()` call that
// names no model inherits the main loop's, so the generated script names this
// one; `tests/plantasks-workflow.test.js` holds it to the agent file.
const REVIEWER_MODEL = 'sonnet';

// The body of every generated build script. It is a function here so a test
// can run it under stub `agent` and `pipeline`, and the script carries its
// source through `toString()`, so it closes over nothing: everything it reads
// arrives as an argument. Implement then review, one pipeline item per task
// and no barrier between the two, because nothing commits while it runs and a
// review pinned by path needs only its own task finished.
async function buildRun(ROOT, TASKS, REVIEWER_MODEL, agent, pipeline) {
    const opts = (t, phase, agentType, model) => Object.assign(
        { label: 'Task ' + t.n + ' ' + phase.toLowerCase(), phase, agentType, model },
        t.effort ? { effort: t.effort } : {});
    const implement = (t) => agent([
        'Task ' + t.n + ': ' + t.name + '.',
        'Your whole brief is ' + t.brief + '. Read it first and build what it says.',
        'The working tree is ' + ROOT + '. Every path in the brief is relative to it: Read and Edit under it by absolute path, and cd into it before every command.',
        'Nothing commits while this run is going. Do not commit, and do not touch the index, HEAD or branch state.',
        'Return what the last section of the brief asks for, and nothing else.',
    ].join('\n'), opts(t, 'Implement', 'fankeel:fankeel-implementer', t.model));
    const review = async (returned, t) => {
        if (!returned) return { n: t.n, implementer: null, review: null };
        const paths = t.paths.join(' ');
        const verdict = await agent([
            'You are reviewing ONE task\'s change in ' + ROOT + '. READ-ONLY: never mutate the working tree, the index, HEAD or branch state.',
            'THE CHANGE, pinned by path because nothing commits while this run is going: git -C ' + ROOT + ' diff HEAD -- ' + paths
                + ', and every path git -C ' + ROOT + ' status --porcelain --untracked-files=all -- ' + paths + ' lists as untracked, read whole.',
            'THE BRIEF: ' + t.brief + ' -- its Files block says what the task owns, its section says what it must do.',
            'THE MAP: ' + ROOT + '/.fankeel/map.md',
            'THE IMPLEMENTER RETURNED:',
            String(returned),
            'Part 1 -- against the brief: Missing (a promise or step the change does not implement, or claims without evidence), Extra (a change no line of the task asks for, a file outside the Files block touched), Misunderstood (the right thing built the wrong way).',
            'Part 2 -- the tests: every new test needs a red-when line in the return above; pick one, apply its mutation to a scratch copy, and confirm the named test reddens. A mutation that reddens every test in the file killed the harness and counts as dead.',
            'Part 3 -- every changed line traces to the task\'s text, and the patterns already in the repository are followed. Name the page this change makes false as page:line.',
            'Part 4 -- cuts, over the lines this change added and no others, in the format of the ## Cuts section of your agent file.',
            'RETURN, and nothing else: one line per finding as path:line -- <the problem>, most serious first, then the cuts and their net: line, or the single word clean when Parts 1-4 found nothing. Every line you return stays in a long-running parent context for the rest of the session.',
        ].join('\n'), opts(t, 'Review', 'fankeel:fankeel-reviewer', REVIEWER_MODEL));
        return { n: t.n, implementer: returned, review: verdict };
    };
    const results = await pipeline(TASKS, implement, review);
    return TASKS.map((t, i) => results[i] || { n: t.n, implementer: null, review: null });
}

// One `workflow` group as the text of a Workflow script, for a session that
// holds the Workflow tool to open by `scriptPath` — a stage agent holds none,
// which is why the text is written rather than authored. Only the tasks whose
// Dispatch line says `implementer` go out; an `in-session` or `user` task is
// not dispatched whatever its group, so fewer than three of them is `null`.
// The meta line is JSON because the host wants a pure literal there.
function workflowScript(tasks, group, opts) {
    const o = opts || {};
    const picked = tasks.filter((t) => group.includes(t.n) && t.dispatch === 'implementer');
    if (picked.length < 3) return null;
    const unnamed = picked.filter((t) => !t.model).map((t) => t.n);
    if (unnamed.length) {
        throw new Error('no model on the Dispatch line of Task ' + unnamed.join(', ')
            + ': a Workflow agent that names none inherits the session\'s');
    }
    const items = picked.map((t) => ({
        n: t.n,
        name: t.name,
        brief: (o.briefs || {})[t.n] || '',
        model: t.model,
        effort: t.effort || '',
        paths: [...new Set([...t.modify, ...t.test].map(barePath))],
    }));
    const meta = {
        name: 'fankeel-build-' + o.stem + '-g' + o.group,
        description: 'Implement then review group ' + o.group + ' of ' + o.plan + ': Tasks ' + items.map((i) => i.n).join(', '),
        phases: [{ title: 'Implement' }, { title: 'Review' }],
    };
    return [
        'export const meta = ' + JSON.stringify(meta) + ';',
        '',
        'const ROOT = ' + JSON.stringify(o.root) + ';',
        'const TASKS = ' + JSON.stringify(items, null, 2) + ';',
        '',
        'return await (' + buildRun.toString() + ')(ROOT, TASKS, ' + JSON.stringify(REVIEWER_MODEL) + ', agent, pipeline);',
        '',
    ].join('\n');
}
```

In `lib/plantasks.js`, replace the `module.exports` line with:

```js
module.exports = { parsePlan, parseTasks, conflict, groups, ready, proseConflicts, surfaces, missingInterfaces, fences, lint, filedPaths, requireConflicts, readSize, workflowScript, REVIEWER_MODEL, READ_CAP, FILE_CAP };
```

4. Run it and watch it pass: `node --test tests/plantasks-workflow.test.js` — eight pass, zero fail. Also run `node --test tests/plantasks.test.js` — unchanged, all pass.

5. Commit: `feat: plantasks writes a workflow group as a script`.

## Task 2: `ledger.js workflow --group <N>` writes the script and prints its path

**Files:**
- Modify: `scripts/ledger.js` — `taskSurfaces`, `writeBrief` and `workflowFile`; the `workflow` verb; `groupsReport` calls `taskSurfaces`, and `brief` calls `writeBrief`
- Test: `tests/ledger-workflow.test.js`
- Read: `lib/ledger.js` — `ledgerPath(root, planFile)`, which names the directory the script is written to
- Read: `lib/plantasks.js` — `workflowScript`, `surfaces` and `requireConflicts`, called and not changed

**Interfaces:**
- Consumes: `workflowScript(tasks, group, opts)` from Task 1.
- Produces: the CLI `node scripts/ledger.js --plan <f> workflow --group <N>`, whose first output line is `fankeel ledger — <absolute path of workflow-g<N>.js>` and which exits 1 with one line on a refusal.

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

Steps:

1. Write the failing test. Create `tests/ledger-workflow.test.js`:

In `tests/ledger-workflow.test.js`, the whole file:

```js
'use strict';

// `workflow --group <N>` is the one place a build group becomes a file the
// session holding the Workflow tool opens by `scriptPath`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { parseTasks, workflowScript } = require('../lib/plantasks.js');

// `groups` reads the profile, and the machine profile lives under the config
// directory: pinned to an empty one so no test reads the real machine's.
process.env.CLAUDE_CONFIG_DIR = tmp('fankeel-ledger-wf-cfg-');
delete process.env.CLAUDE_PROJECT_DIR;

const SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');

const task = (n, file, dispatch) => [
  '## Task ' + n + ': task ' + n, '',
  '**Files:**', '- Modify: `' + file + '`', '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  '**Dispatch:** ' + dispatch, '',
].join('\n');

const HEADER = ['# P', '', '**Goal:** g.', '**Spec:** d.md', '', '## Global Constraints', '', '- none', ''].join('\n');

// Tasks 1-3 are disjoint, so group 1 is `workflow`; Task 4 shares lib/a.js
// with Task 1, so group 2 is `agent`.
const plan = (d2, d3) => [
  HEADER,
  task(1, 'lib/a.js', 'implementer, sonnet'),
  task(2, 'lib/b.js', d2 || 'implementer, sonnet'),
  task(3, 'lib/c.js', d3 || 'implementer, sonnet'),
  task(4, 'lib/a.js', 'implementer, sonnet'),
].join('\n');

function setup(text) {
  const dir = tmp('fankeel-ledger-wf-');
  const file = path.join(dir, 'p.md');
  fs.writeFileSync(file, text);
  return { dir, file };
}

function run(dir, file, args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', file, ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: String(e.stdout) };
  }
}

test('workflow --group 1 prints the path of the script it wrote, beside the ledger', () => {
  const { dir, file } = setup(plan());
  const { code, out } = run(dir, file, ['workflow', '--group', '1']);
  assert.equal(code, 0, out);
  const written = /^fankeel ledger — (.+)$/m.exec(out)[1];
  assert.equal(written, path.join(dir, '.fankeel', 'build', 'p', 'workflow-g1.js'));
  assert.match(fs.readFileSync(written, 'utf8'), /^export const meta = /);
  assert.match(out, /scriptPath/);
  assert.match(out, /1, 2, 3\.$/m);
});

test('the script it writes is workflowScript\'s output for that group, byte for byte', () => {
  const { dir, file } = setup(plan());
  assert.equal(run(dir, file, ['workflow', '--group', '1']).code, 0);
  const build = path.join(dir, '.fankeel', 'build', 'p');
  const written = fs.readFileSync(path.join(build, 'workflow-g1.js'), 'utf8');
  const briefs = {};
  for (const n of [1, 2, 3]) briefs[n] = path.join(build, 'task-' + n + '-brief.md');
  const direct = workflowScript(parseTasks(fs.readFileSync(file, 'utf8')), [1, 2, 3],
    { root: dir, plan: file, stem: 'p', group: 1, briefs });
  assert.equal(written, direct);
});

test('each brief it writes is the one brief <n> writes from nothing', () => {
  const { dir, file } = setup(plan());
  run(dir, file, ['workflow', '--group', '1']);
  for (const n of [1, 2, 3]) {
    const briefFile = path.join(dir, '.fankeel', 'build', 'p', 'task-' + n + '-brief.md');
    const fromWorkflow = fs.readFileSync(briefFile, 'utf8');
    fs.rmSync(briefFile);
    assert.equal(run(dir, file, ['brief', String(n)]).code, 0);
    assert.equal(fs.readFileSync(briefFile, 'utf8'), fromWorkflow, 'Task ' + n);
  }
});

test('it refuses a group that is not workflow, a group outside the plan, and no group at all', () => {
  const { dir, file } = setup(plan());
  const agent = run(dir, file, ['workflow', '--group', '2']);
  assert.equal(agent.code, 1);
  assert.match(agent.out, /group 2 is `agent`, not `workflow`/);
  const outside = run(dir, file, ['workflow', '--group', '3']);
  assert.equal(outside.code, 1);
  assert.match(outside.out, /--group 1\.\.2/);
  const none = run(dir, file, ['workflow']);
  assert.equal(none.code, 1);
  assert.match(none.out, /workflow wants --group/);
  assert.ok(!fs.existsSync(path.join(dir, '.fankeel', 'build', 'p', 'workflow-g2.js')));
});

test('it refuses a group sending fewer than three implementers', () => {
  const { dir, file } = setup(plan(undefined, 'in-session — one shell call.'));
  const { code, out } = run(dir, file, ['workflow', '--group', '1']);
  assert.equal(code, 1);
  assert.match(out, /sends 2 implementers, fewer than three/);
});

test('it refuses a task with no model on its Dispatch line by name', () => {
  const { dir, file } = setup(plan('implementer — no model named.'));
  const { code, out } = run(dir, file, ['workflow', '--group', '1']);
  assert.equal(code, 1);
  assert.match(out, /Task 2/);
});

test('a brain build still gets the script, while groups still prints agents', () => {
  const { dir, file } = setup(plan());
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  assert.match(run(dir, file, ['groups']).out, /1: 1, 2, 3 {2}— agents/);
  const { code, out } = run(dir, file, ['workflow', '--group', '1']);
  assert.equal(code, 0, out);
});
```

2. Run it and watch it fail: `node --test tests/ledger-workflow.test.js` — every test fails; the refusal tests fail on the message, because `workflow` is not a verb yet and the script answers `Verbs: …`.

3. Write the minimal implementation.

In `scripts/ledger.js`, change the opening comment's first sentence from `Twelve verbs, because twelve is what the build` to `Thirteen verbs, because thirteen is what the build`, and add after the `ready` and `hands` line of that comment:

```js
// `workflow` came on 2026-10-16: one group written as a Workflow script, for
// the session holding the Workflow tool to open by `scriptPath`.
```

In `scripts/ledger.js`, replace the `VERBS` line with:

```js
const VERBS = new Set(['init', 'complete', 'ruling', 'show', 'groups', 'ready', 'hands', 'scan', 'ranges', 'lint', 'brief', 'fix', 'workflow']);
```

In `scripts/ledger.js`, replace the `VERB_FLAGS` line with:

```js
const VERB_FLAGS = { init: BASE_FLAGS.concat(['range']), complete: BASE_FLAGS.concat(['range', 'render']), fix: BASE_FLAGS.concat(['range', 'render']), brief: BASE_FLAGS.concat(['group', 'prefix']), ready: BASE_FLAGS.concat(['worktree']), workflow: BASE_FLAGS.concat(['group']) };
```

In `scripts/ledger.js`, directly above `function groupsReport`, add:

```js
// The surface each group takes from its tasks alone: `surfaces`, with a group
// carrying a require-edge diagnostic held off `workflow` the way a group with
// no Interfaces block already is. Whether build runs under a stage agent is
// not asked here: `groups` applies that, and `workflow` writes the script a
// stage agent cannot open but the session holding the Workflow tool can.
function taskSurfaces(tasks, requireHits) {
    const flagged = new Set(requireHits.flatMap((r) => [r.a, r.b]));
    return plantasks.surfaces(tasks).map((g) => (
        g.surface === 'workflow' && g.tasks.some((n) => flagged.has(n))
            ? { tasks: g.tasks, surface: 'agents' }
            : g
    ));
}
```

In `scripts/ledger.js`, in `groupsReport`, delete the line `const flagged = new Set(requireHits.flatMap((r) => [r.a, r.b]));` and replace the whole `const surfaced = plantasks.surfaces(tasks).map((g) => (` statement, through its closing `));`, with:

```js
    const surfaced = taskSurfaces(tasks, requireHits).map((g) => (
        g.surface === 'workflow' && brainBuild ? { tasks: g.tasks, surface: 'agents' } : g
    ));
```

In `scripts/ledger.js`, directly above `function main(argv)`, add:

```js
// One task's brief file, written beside the ledger, and its path. `brief <n>`
// and `workflow --group <N>` both write through here, so the brief a Workflow
// implementer reads is the one `brief <n>` would have written.
function writeBrief(root, planOpt, n) {
    const { file, text: planText } = readPlan(root, planOpt);
    const { header, tasks } = plantasks.parsePlan(planText);
    const task = tasks.find((t) => t.n === n);
    if (!task) fail('brief: no Task ' + n + ' in ' + file + '. ' + CONFORMING_HEADING);
    // For every name this task consumes, the entry that produces it — the
    // exact signature, from the task that owns it, rather than a memory.
    const produced = [];
    for (const name of task.consumes) {
        for (const t of tasks) {
            if (t.n === task.n) continue;
            for (const entry of t.producesText) {
                if (entry.includes('`' + name + '`') && !produced.includes('- Task ' + t.n + ' produces: ' + entry)) {
                    produced.push('- Task ' + t.n + ' produces: ' + entry);
                }
            }
        }
    }
    const out = [
        '# Task ' + n + ' — ' + task.name,
        '',
        planOpt + ', Task ' + n + '. This file is your whole brief.',
        '',
        paragraph(header, 'Goal'),
        '',
        paragraph(header, 'Spec'),
        '',
        section(header, 'Global Constraints'),
        '',
        task.body,
        '',
        '## From the tasks this consumes',
        '',
        produced.length ? produced.join('\n') : 'Nothing consumed from an earlier task.',
        '',
        FOOTER,
        '',
    ].join('\n');
    const dir = path.dirname(ledger.ledgerPath(root, planOpt));
    fs.mkdirSync(dir, { recursive: true });
    const briefFile = path.join(dir, 'task-' + n + '-brief.md');
    fs.writeFileSync(briefFile, out);
    return briefFile;
}

// `workflow --group <N>`: group N written as one Workflow script beside the
// ledger, every implementer's brief written first, and the script's path
// printed for the session holding the Workflow tool to open by `scriptPath`.
function workflowFile(root, planOpt, group) {
    const { text } = readPlan(root, planOpt);
    const tasks = plantasks.parseTasks(text);
    const rows = taskSurfaces(tasks, plantasks.requireConflicts(tasks, root));
    const n = Number(group);
    if (!Number.isInteger(n) || n < 1 || n > rows.length) {
        fail('workflow wants --group 1..' + rows.length + ' for this plan, got ' + group);
    }
    const row = rows[n - 1];
    if (row.surface !== 'workflow') {
        fail('fankeel ledger — group ' + n + ' is `' + row.surface + '`, not `workflow`: send its tasks as Agents.');
    }
    const sent = tasks.filter((t) => row.tasks.includes(t.n) && t.dispatch === 'implementer');
    if (sent.length < 3) {
        fail('fankeel ledger — group ' + n + ' sends ' + sent.length + ' implementers, fewer than three: send them as Agents.');
    }
    const briefs = {};
    for (const t of sent) briefs[t.n] = writeBrief(root, planOpt, t.n);
    let script;
    try {
        script = plantasks.workflowScript(tasks, row.tasks, {
            root, plan: planOpt, stem: path.basename(String(planOpt), '.md'), group: n, briefs,
        });
    } catch (e) {
        return fail('fankeel ledger — ' + e.message);
    }
    const file = path.join(path.dirname(ledger.ledgerPath(root, planOpt)), 'workflow-g' + n + '.js');
    fs.writeFileSync(file, script);
    return 'fankeel ledger — ' + file
        + '\n\nOpen it with Workflow { scriptPath }. Nothing commits while it runs; then commit each task in this order: '
        + sent.map((t) => t.n).join(', ') + '.';
}
```

In `scripts/ledger.js`, in `main`, replace the non-prefix half of the `brief` branch — from `const n = Number(text[0]);` through `return 'fankeel ledger — ' + briefFile;` — with:

```js
        const n = Number(text[0]);
        if (!Number.isInteger(n) || n < 1) fail('brief <task number>');
        return 'fankeel ledger — ' + writeBrief(root, opts.plan, n);
```

In `scripts/ledger.js`, in `main`, directly above `if (verb === 'fix') {`, add:

```js
    if (verb === 'workflow') {
        if (opts.group === undefined) fail('workflow wants --group <N>, a group `groups` prints as workflow.');
        return workflowFile(root, opts.plan, opts.group);
    }
```

4. Run it and watch it pass: `node --test tests/ledger-workflow.test.js tests/ledger.test.js tests/ledger-brief-prefix.test.js` — every test passes, the existing `brief` and `groups` tests unchanged.

5. Commit: `feat: ledger.js workflow writes a group's script`.


## Task 3: the controller reads a group report's `workflow:` line

**Files:**
- Modify: `lib/handoff.js` — `workflowOf(file)` beside `readsOf`; one name added to `module.exports`
- Modify: `scripts/await.js` — `lineFor`'s `handoff` case prints the `workflow` line when the report carries one; `main` re-marks the brain for such a report through `registry.markInflight`, and `waitFor` reads a group mark's `at` as a floor on `since`
- Read: `lib/registry.js` — `markInflight(projectRoot, sessionId, stage, agentId, lap, group, kind)`, the one writer of `inflight`, called and not changed
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task — the line shape is the Global Constraints' `workflow: <path>`.
- Produces: `workflowOf(file)` — `file` a path; returns the trimmed path on the last line of the file that reads `workflow: <path>`, or `null` for no such line or no file. And a new first word on `await.js`'s output, `workflow`, followed by the script's path and the whole instruction quoted in step 3 — the controller's own block does not grow — prefixed with the group tag as every other line is.

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

Steps:

1. Write the failing test.

In `tests/await.test.js`, add `workflowOf` to the names destructured from the handoff module on its third require line, and at the end of the file add:

```js
// stage-agents-16: a build brain cannot run Workflow, so a group report that
// carries `workflow: <path>` hands the script to the controller instead of
// asking anything; the last such line counts, as for `reads:`.
test('workflowOf reads the last workflow: line, and null without one', () => {
    const dir = tmp('fankeel-await-');
    const report = at(path.join(dir, 'build-g2.md'), T, 'group 2\n\nworkflow: /r/a.js\n\nworkflow:   /r/b.js  \n');
    assert.equal(workflowOf(report), '/r/b.js');
    assert.equal(workflowOf(at(path.join(dir, 'build-g3.md'), T, 'group 3\nreads:\n- a — b\n')), null);
    assert.equal(workflowOf(path.join(dir, 'none.md')), null);
});

test('await.js tells the controller to open a group report\'s workflow script', async () => {
    const f = fixture({ inflight: [{ stage: 'build', at: 1, agentId: 'g7', group: 7 }] });
    const dir = path.join(f.config, 'projects', 'F--x', SID);
    at(path.join(f.config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(dir, 'subagents', 'agent-g7.jsonl'), Date.now(), JSON.stringify({ message: { role: 'user', content: 'build group 2: tasks 3, 4, 5.' } }) + '\n');
    const g7 = path.join(f.task, 'build-g7.md').split(path.sep).join('/');
    at(g7, Date.now(), 'group 7\n\nworkflow: /r/.fankeel/build/p/workflow-g2.js\n');
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'g7', '--timeout', '0.1'], f.env);
    assert.ok(out.text.startsWith('group 7, agent g7: workflow /r/.fankeel/build/p/workflow-g2.js — '), out.text);
    assert.match(out.text, /Workflow\(\{ scriptPath: "\/r\/\.fankeel\/build\/p\/workflow-g2\.js" \}\)/);
    assert.match(out.text, /SendMessage agent g7 `Workflow returned:` and the result, exactly/);
    assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId), ['g7'], 'a brain waiting on its workflow keeps its mark');
    const stale = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'g7', '--timeout', '0.3'], f.env);
    assert.ok(stale.text.startsWith('group 7, agent g7: timeout'), 'the report already handed over is not news: ' + stale.text);
    at(g7, Date.now() + 1000, 'group 7\n\ndone 3 of 3\n');
    const again = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'g7', '--timeout', '0.5'], f.env);
    assert.ok(again.text.startsWith('group 7, agent g7: handoff ' + g7), again.text);
    assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId), [], 'the report without the line clears it as before');
});
```

2. Run it and watch it fail: `node --test tests/await.test.js` — the two new tests fail, `workflowOf is not a function`; every other test passes.

3. Write the minimal implementation.

In `lib/handoff.js`, directly below `readsOf`, add:

```js
// The script a build group report hands its controller: the last line that
// reads `workflow: <path>`, taken last for the reason `readsOf` takes the last
// `reads:` block. A brain that cannot run Workflow writes it once the script
// is written, and leaves it out when it rewrites the report after the run, so
// the controller never opens one run twice.
function workflowOf(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    const marks = [...text.matchAll(/^workflow:[ \t]+(.+?)[ \t]*$/gm)];
    return marks.length ? marks[marks.length - 1][1] : null;
}
```

In `lib/handoff.js`, add `workflowOf` to `module.exports`, directly after `readsOf`.

In `scripts/await.js`, add `workflowOf` to the names destructured from the handoff module on line 23, and in `lineFor` replace the `if (state === 'handoff')` line with:

```js
    if (state === 'handoff') {
        const script = workflowOf(o.handoff);
        if (script) return tag + 'workflow ' + script + ' — open it with `Workflow({ scriptPath: "' + script + '" })`, then SendMessage agent ' + (o.agentId || '?') + ' `Workflow returned:` and the result, exactly.';
        return tag + 'handoff ' + o.handoff + ' — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.';
    }
```

In `scripts/await.js`, in `main`, replace the line that opens `if (state === 'lost' || (state === 'handoff'` with:

```js
        // A group report carrying `workflow:` is a brain still alive, waiting for
        // the run's result: its mark stays, so the await after the SendMessage
        // still reads build-g<N>.md rather than build.md, and it is re-marked
        // now, so that await waits for a report newer than this one instead of
        // handing the same script over twice. A SendMessage writes no answer file.
        const handedOver = state === 'handoff' && Number.isInteger(o.group) && Boolean(workflowOf(o.handoff));
        if (handedOver) registry.markInflight(o.root, opts.session, 'build', o.agentId, o.lap, o.group, o.kind);
        else if (state === 'lost' || (state === 'handoff' && o.kind !== 'close' && Number.isInteger(o.group))) registry.clearInflight(o.root, opts.session, o.agentId);
```

In `scripts/await.js`, in `waitFor`, directly below the `try`/`catch` that sets `since`, add:

```js
    // A group mark is re-set when its report hands a workflow over and on every
    // SendMessage delivery, and neither writes an answer file: a report no newer
    // than the mark is the one already handed over.
    if (group !== undefined && mark && Number.isFinite(mark.at)) since = Math.max(since, mark.at);
```

In `scripts/await.js`, in `waitFor`'s returned object, add `lap` beside `group`, so `main` can pass it to `markInflight`.

4. Run it and watch it pass: `node --test tests/await.test.js tests/handoff.test.js tests/await-pending.test.js` — every test passes.

5. Commit: `feat: await.js opens a group report's workflow line`.

## Task 4: the build brain writes the `workflow:` line and takes the result back

**Files:**
- Modify: `lib/render.js:560-700` — one line in `renderBrainBrief`'s `stage === 'build'` branch
- Modify: `agents/fankeel-brain.md` — one bullet under `## On a build stage`; one clause in `## Return`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: the CLI `node scripts/ledger.js --plan <f> workflow --group <N>` from Task 2.
- Produces: the brain brief's line `workflow script:`, 147 characters with its newline and no path in it, pointing at the agent file's bullet.

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

Steps:

1. Write the failing test.

In `tests/brief.test.js`, directly below the test named `a controlled build's brain brief stays under the 10,000-character cap on one additionalContext`, add:

```js
// stage-agents-16: the brain cannot run Workflow, so its brief names the
// command that writes the script, and its agent file says what follows.
test('a controlled build\'s brain brief names the workflow script command, and its agent file says what follows the result', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.ok(text.includes('  - workflow script: a `groups` row of three or more that holds your tasks goes as one Workflow; your agent file\'s `## On a build stage` says how.'), text);
  assert.ok(sizeAtReference(text) <= BRIEF_MAX, 'brain brief is ' + sizeAtReference(text) + ' chars at the reference root');
  const file = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  const build = file.split(/^## /m).find((s) => s.startsWith('On a build stage'));
  assert.match(build, /`workflow: <the path it printed>`/);
  assert.match(build, /`Workflow returned:`/);
  assert.match(build, /without\s+the\s+`workflow:`\s+line/);
  assert.match(build, /workflow --group <row>/);
  assert.match(build, /row that holds your tasks/);
});
```

2. Run it and watch it fail: `node --test tests/brief.test.js` — the new test fails on `workflow script:`; every other test passes.

3. Write the minimal change.

In `lib/render.js`, in `renderBrainBrief`'s `if (stage === 'build') {` branch, directly below the line that pushes `'  - floor model: `'`, add:

```js
        lines.push('  - workflow script: a `groups` row of three or more that holds your tasks goes as one Workflow; your agent file\'s `## On a build stage` says how.');
```

In `agents/fankeel-brain.md`, under `## On a build stage`, add as the last bullet:

```md
- A group goes as one Workflow, which you cannot run, when the
  `ledger.js --plan <f> groups` row that holds your tasks has three or more:
  run `node <plugin>/scripts/ledger.js --plan <f> workflow --group <row>`,
  `<row>` being that row's number, not your own group number. A refusal line means send its implementers as
  Agents, as above. A path back means send none of them: write your group
  report with one line `workflow: <the path it printed>` and return the
  report path. The controller opens the script and messages you
  `Workflow returned:` and the run's result, one `{ n, implementer, review }`
  per task. Save each `implementer` to `review-<n>.txt` beside your report,
  ask for the commit as above — one block per task, no `worktree` line,
  since the run built in the main tree — and record each `complete <n>`
  with the range that came back. Then rewrite the report without the
  `workflow:` line and return its path again.
```

In `agents/fankeel-brain.md`, in `## Return`, after `on a design or plan stage, `commit <path>` for its file.`, add the sentence: `On a build stage whose group goes as one Workflow, the report path carrying the `workflow:` line, before the run and once more after it, without the line.`

4. Run it and watch it pass: `node --test tests/brief.test.js tests/agents.test.js tests/brief-group.test.js tests/task-control.test.js tests/stage-prints-rules.test.js` — every test passes, the `BRIEF_MAX` tests at `tests/brief.test.js:995`, `:1035` and `:1096` included; the line is 147 fixed characters, and the overflow fixtures at :995 and :1035 make room by dropping older facts and answers through `fit`. A failure in the last two files is returned as `blocked:`, not fixed.

5. Commit: `feat: a build brain hands its workflow group over`.

## Task 5: the build skill and the subagents reference describe the script and the hand-off

**Files:**
- Modify: `skills/fankeel-build/SKILL.md:1-345` — `last_verified`; the dangling `—` at the end of step 4's brief-footer paragraph; one paragraph at the end of step 4
- Modify: `docs/90-agent/reference/subagents.md:1-372` — `last_verified`, and one paragraph under the size threshold
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `workflowOf(file)` from Task 3 and the brain brief's line `workflow script:` from Task 4, by name only.
- Produces: nothing later tasks depend on.

**Dispatch:** implementer, opus, high — the architectural floor; it owes no argument.

Steps:

1. Run `node scripts/docs-check.js` and keep its output.

2. Write the failing test.

In `tests/skills.test.js`, directly below the test named `the build skill carries the commit skeleton its injection cannot`, add:

```js
// A workflow group is opened from the script ledger.js writes, never authored
// by hand: the session holding the Workflow tool needs the path, the shape of
// the return and where each implementer return goes, and a brain hands the
// path over as a `workflow:` line.
test('the build skill opens a workflow group from the script ledger.js writes', () => {
  const step = /\n4\. Commit[\s\S]*?\n5\. /.exec(read('fankeel-build'));
  assert.ok(step, 'step 4 of the build loop is not where this test looks for it');
  const text = step[0].replace(/\s+/g, ' ');
  assert.match(text, /workflow --group <N>/);
  assert.match(text, /Workflow\(\{ scriptPath/);
  assert.match(text, /review-<n>\.txt/);
  assert.match(text, /`workflow: <path>`/);
  assert.match(text, /rather than a diff\. /, 'the brief-footer paragraph ends in a full stop');
});
```

3. Run it and watch it fail: `node --test tests/skills.test.js` — the new test fails on `workflow --group <N>`; every other test passes.

4. Write the minimal change.

In `skills/fankeel-build/SKILL.md`, set the frontmatter's `last_verified:` to `2026-10-16` and leave `version:` alone. In step 4's `workflow` case, the paragraph opening `Every implementer in the run gets its brief file` ends `rather than a diff —` with nothing after it: replace that closing ` —` with `.`, so it reads as a whole sentence and `When the run returns` still follows it. Then, at the end of step 4 — between the line `rather than after it.` and the line `5. One reviewer, on this template and no other`, with one blank line above the new paragraph and none below it, as `5.` sits now — add (three-space indent, matching the step):

```md

   **Opening a `workflow` group.** The script is written, not authored, and
   only on the plan path — with no plan there is no group to write:
   `node <plugin>/scripts/ledger.js --plan <plan bucket>/<file>.md workflow
   --group <N>` writes every implementer's brief and the script to
   `.fankeel/build/<plan stem>/workflow-g<N>.js`, and prints that path. The
   session holding the Workflow tool opens it as
   `Workflow({ scriptPath: "<that path>" })`. Each task goes out as
   `fankeel:fankeel-implementer` on its Dispatch line's model and effort, then
   as `fankeel:fankeel-reviewer` on the path-pinned diff above, and the run
   returns one `{ n, implementer, review }` per task: save each `implementer`
   to `review-<n>.txt`, as step 2 says, before committing. A stage agent has
   no Workflow tool, so a build brain whose `groups` row has three or more
   runs the same command and writes its group report with a line
   `workflow: <path>`; `scripts/await.js` tells the controller to open it and SendMessage the brain `Workflow returned:`
   and the result, and the brain commits and records each task from there.
```

In `docs/90-agent/reference/subagents.md`, set the frontmatter's `last_verified:` to `2026-10-16`, and directly below the paragraph that ends `merely not refuted.` under `## The other threshold, which is size`, add:

```md
A `workflow` group is not written by hand. `workflowScript` in
`lib/plantasks.js` turns one into a Workflow script — one pipeline item per
implementer task, implement then review, every `agent` call carrying its
`agentType`, the model its task's Dispatch line names or the reviewer's
pinned `sonnet`, and the line's effort — and
`node scripts/ledger.js --plan <f> workflow --group <N>` writes it beside the
ledger and prints its path for the session holding the Workflow tool to open
with `scriptPath`. A stage agent has no Workflow tool, so under a brain build
`groups` still prints `agents`; a brain whose row has three or more runs the
same command and puts `workflow: <path>` in its group report, `workflowOf` in
`lib/handoff.js` reads it, and `scripts/await.js` tells the controller to open
it and message the result back, keeping the brain's in-flight mark meanwhile.
```

5. Run it and watch it pass: `node --test tests/skills.test.js` — every test passes, `fankeel-build: every ledger mention sits inside a paragraph that names the no-plan reader` included. Run `node scripts/docs-check.js` again; report any line it prints that the first run did not.

6. Commit: `docs: build opens a workflow group by scriptPath`.

## Task 6: a real plan's script runs to completion, and the TODO entry closes

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-16.md` — one dated paragraph of evidence at the end of the body

**Interfaces:**
- Consumes: the CLI `node scripts/ledger.js --plan <f> workflow --group <N>` from Task 2.
- Produces: nothing.

**Dispatch:** user — the Workflow tool runs only when the user opts in, and the user approves the run's dialog; no subagent holds the Workflow tool.

Steps:

1. In the main tree, `git -C F:/ymlab/fankeel status --porcelain -- docs/90-agent/todo/`. While `brief-3.md` or `pane-8.md` is still modified there by another session, wait for it to land: the run edits both.

2. Make the worktree the run builds in, at the commit that added the plan:

```sh
git -C F:/ymlab/fankeel worktree add --detach F:/ymlab/fankeel-wf-run 0d1bc90a
node F:/ymlab/fankeel/scripts/ledger.js --root F:/ymlab/fankeel-wf-run --plan docs/90-agent/plans/2026-10-16-todo-patrol-probes.md workflow --group 1
```

The second command prints `fankeel ledger — F:\ymlab\fankeel-wf-run\.fankeel\build\2026-10-16-todo-patrol-probes\workflow-g1.js` and the commit order `1, 2, 3, 4`.

3. With the user's go-ahead, call `Workflow({ scriptPath: "<the printed path>" })` and approve its dialog: two phases, eight agents.

4. Pass when the run's status is `completed` and its result holds four entries, `n` 1 to 4, none with a null `implementer` or `review`. Note the run id, its status, `agentCount`, `totalTokens` and `durationMs` from `<config>/projects/<session>/workflows/<run id>.json`, and each implementer's status line. Then `git -C F:/ymlab/fankeel status --porcelain` must name nothing the run wrote.

5. Remove the worktree, which holds a rerun of work already landed: `git -C F:/ymlab/fankeel worktree remove --force F:/ymlab/fankeel-wf-run`.

6. Append to `docs/90-agent/todo/stage-agents-16.md` a paragraph opening `2026-10-16 結案：` that names the commits of Tasks 1-5, the run id and the figures from step 4, the four status lines, and the red-then-green lines of `tests/plantasks-workflow.test.js` from Task 1's return. Commit it with `docs: stage-agents-16 closes on a real workflow run`, then `node scripts/todo.js done stage-agents-16 --sha <that commit's sha>`.

## Coverage

| promise | task |
|---|---|
| `workflowScript(tasks, group, opts)` in `lib/plantasks.js` returns the text of one Workflow script for one group, or `null` | Task 1 |
| Its first line is `export const meta = ` followed by a JSON literal, so the meta object is a pure literal | Task 1 |
| Every task becomes one pipeline item that runs implement then review, with no barrier between the two stages | Task 1 |
| The implementer goes out as `fankeel:fankeel-implementer` on the model its Dispatch line names | Task 1 |
| The reviewer goes out as `fankeel:fankeel-reviewer` on `REVIEWER_MODEL`, the model `agents/fankeel-reviewer.md` pins | Task 1 |
| The script holds the working tree's absolute root and tells both agents to work under it | Task 1, run in Task 6 |
| The script never calls `Date.now`, `Math.random` or an argless `new Date`, and a ranged `Modify:` entry reaches the diff as its bare path | Task 1 |
| `node scripts/ledger.js --plan <f> workflow --group <N>` writes each implementer task's brief, writes the script | Task 2 |
| It refuses a group that is not `workflow` from its tasks alone | Task 2 |
| A brain build does not change what it writes: the profile's `stage.agents` decides what `groups` prints | Task 2 |
| The script it writes is `workflowScript`'s output for that group, byte for byte, and each brief it writes is the one `brief <n>` writes | Task 2 |
| A build brain whose tasks sit in a `groups` row of three or more runs `ledger.js --plan <f> workflow --group <that row's number>` | Task 4 |
| It writes its group report with one line `workflow: <the path it printed>`, the same `label: value` line shape | Task 4 |
| `workflowOf(file)` in `lib/handoff.js` reads that line, the last one in the file | Task 3 |
| The controller's own block does not grow: `scripts/await.js` prints the whole instruction | Task 3 |
| A `workflow:` report keeps the brain's in-flight mark, re-set to now | Task 3 |
| The brain's brief (`renderBrainBrief` in `lib/render.js`) names the command, and its agent file says what to do when the result arrives | Task 4 |
| Step 4 of `skills/fankeel-build/SKILL.md` names the verb, `Workflow({ scriptPath })`, what the parent does with the returned list, and the brain's hand-off | Task 5 |
| `docs/90-agent/reference/subagents.md`, under the size threshold, says the script is generated | Task 5 |
| The script generated from `docs/90-agent/plans/2026-10-16-todo-patrol-probes.md` group 1, in a detached worktree at `0d1bc90a` | Task 6 |
| The run's id, its status and the four implementer status lines are written into the entry | Task 6 |
| the generated script run under stub `agent` and `pipeline` dispatches one implementer and one reviewer per task | Task 1 |
| the meta line parses as JSON and names the two phases | Task 1 |
| `ledger.js workflow --group 1` writes what `workflowScript` returns for that group and refuses a group that is not `workflow` | Task 2 |
| `await.js` prints `workflow <path>` for a group report carrying a `workflow:` line | Task 3 |
| the brain brief names the `workflow --group` command and the agent file says what follows the result | Task 4 |
| a `workflow:` report keeps the in-flight mark, so the next await reads that group's report | Task 3 |
| the build skill's step 4 names `workflow --group` and `scriptPath` | Task 5 |
| a Workflow run over a real plan's group returns four non-null entries | Task 6 |
