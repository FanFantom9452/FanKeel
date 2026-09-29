---
status: current
date: 2026-09-29
---

# TODO Patrol Implementation Plan

**Goal:** turn the seven Needs-a-decision entries of `TODO.md` into eleven small changes that each close (or record the decision on) one entry.
**Architecture:** every change is local to one hook, one script, one agent file or one skill, each with its own test file; the two ledger changes and the three skill changes share `scripts/ledger.js` and `tests/skills.test.js`, so they are ordered rather than merged. The one new page is a decision record; closing `TODO.md` entries is land's work, not a task.
**Tech Stack:** Node.js built-ins only (CommonJS), `node --test`; Claude Code hook events PostToolUse (`hooks/resume.js`), SubagentStart (`hooks/brief.js`), PreToolUse/PostToolUse (`hooks/budget.js`).
**Spec:** ../../../.fankeel/build/task-20260928T184117/design.md

## Global Constraints

Generated from `CONTRIBUTING.md`, `package.json`, `.fankeel/map.md` and the tests named; there is no `CLAUDE.md` and no `AGENTS.md` in this repository.

- No dependency may be added: `package.json` has none, and the test runner is `node --test` (`"test": "node --test"`).
- `lib/*.js`: pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` (CONTRIBUTING.md `## Scope and ownership`, Core logic).
- `scripts/*.js` are thin wrappers over `lib/`. A new flag on the station CLI needs a row on `docs/90-agent/reference/station.md`, or `tests/station-doc.test.js` fails. No task here adds one.
- `hooks/*.js`: every hook exits `0` on every path, including its own errors (CONTRIBUTING.md, Hooks; README.md `## Development`).
- Tests: `node --test`. Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it. No task here adds a test file.
- Indent follows the file being edited: 4 spaces in `hooks/`, `lib/`, `scripts/`, `tests/await.test.js`, `tests/agents.test.js`, `tests/budget.test.js`; 2 spaces in `tests/resume.test.js`, `tests/brief.test.js`, `tests/render.test.js`, `tests/ledger.test.js`, `tests/skills.test.js`.
- Skills: `skills/*/SKILL.md`, keep an operation's skill thin; do not copy routing tables or shared conventions out of the skill that owns them (CONTRIBUTING.md, Skills).
- The stage-rules injection is capped at 2400 bytes and is never raised (`tests/render.test.js:488`, `tests/profile.test.js:400`). A brain's brief stays under 10,000 characters (`tests/brief.test.js:454`, and the `< 10000` asserts in `tests/brief.test.js:118-132`).
- Documentation filing (CONTRIBUTING.md, Documentation): `docs/03-decisions` is decision, `docs/90-agent/reference` is reference, `docs/90-agent/reports` is report and is write-once. A new page gets its `docs/README.md` row in the same change.
- `TODO.md` and `docs/90-agent/reference/todo-completions.md` are land's work; no task edits either.
- Version numbers move only through `scripts/version.js`; no task runs it.
- Write files with LF line endings (Windows); a `python` write needs `newline=''`.
- An implementer runs only its own test file. The parent runs the whole suite (`npm test`) before committing a group.

## Risks

- `hooks/resume.js` sees a controller's own question while a gate from an earlier report is still on disk, so Task 1 may write a miss file for a question that was never the gate's; a miss file is diagnostic only and nothing reads it, so the cost is noise. Task 1 says so in the code comment.
- Task 2 depends on line 1 of `subagents/agent-<id>.jsonl` being on disk when SubagentStart fires (design section 2, unverified, one sample). Its first step re-checks a real transcript; an unreadable line leaves today's numbering in place.
- Task 6 makes `ledger.js groups` read the machine profile through `CLAUDE_CONFIG_DIR`, so every `groups` test in `tests/ledger.test.js` could flip on a machine whose own profile names build; Task 6 pins that variable to a temp directory at the top of the test file.
- Task 7 adds a lint finding, so every lint test in `tests/ledger.test.js` whose plan lacks `## Risks` changes its count; Task 7 adds the section to the shared `PLAN_HEAD` fixture and re-reads each count.
- Task 8 uses `disable-model-invocation`, which this repository has never used; whether the host honours it for a plugin skill is unverified (design section 5), so the task can only prove the key and the rule are written, not that the host obeys them.
- Tasks 3, 4 share `tests/agents.test.js`; Tasks 6, 7 share `scripts/ledger.js` and `tests/ledger.test.js`; Tasks 8, 9, 10 share `tests/skills.test.js`; Tasks 1, 2 share `scripts/await.js` and `tests/await.test.js`. `ledger.js groups` puts each such pair in different groups, so they run one after the other.

## File structure

| file | responsibility | task |
|---|---|---|
| `hooks/resume.js` | the answer file, and now the miss file beside it | 1 |
| `scripts/await.js` | which report counts as new; which mark it watches and clears | 1, 2 |
| `hooks/brief.js` | stamps the in-flight mark with the ledger group or `close` the brain was sent for | 2 |
| `lib/registry.js` | `markInflight` takes and stores `kind` | 2 |
| `agents/fankeel-brain.md`, `lib/render.js` | the brain's return rule, in its own file and in its build brief | 3 |
| `agents/fankeel-reviewer.md` | the project's `REVIEW.md` | 4 |
| `hooks/budget.js` | finds a workflow agent's transcript | 5 |
| `scripts/ledger.js` | `groups` never says `workflow` for a brain build (Task 6); `lint` requires `## Risks` (Task 7) | 6, 7 |
| `skills/fankeel-plan/SKILL.md` | the header template gains `## Risks` | 7 |
| `skills/fankeel/SKILL.md`, `skills/fankeel-station/SKILL.md` | the user-invoked rule, and the one skill it applies to | 8 |
| `skills/fankeel-build/SKILL.md` | `## Common rationalizations` | 9 |
| `skills/fankeel-verify/SKILL.md` | build, test and lint always run | 10 |
| `docs/03-decisions/2026-09-29-skill-candidates.md`, `docs/README.md` | the record of which six candidates were taken | 11 |

## Closes, when land runs

Not tasks. Land closes these `TODO.md` entries and records each on `docs/90-agent/reference/todo-completions.md`, and adds the one sentence each design section names for `docs/90-agent/reference/subagents.md`:

- 〔await〕 — Tasks 1, 2
- 〔stage-agents〕 — Task 3
- 〔workflow〕 — Tasks 5, 6
- 〔skills〕 — Tasks 8, 9, 11
- 〔verify〕 — Task 10
- 〔plan〕 — Task 7
- 〔review〕 — Task 4

## Task 1: the answer file that was never written

**Files:**
- Modify: `hooks/resume.js:76-86` — on the `stage.agents` branch, write `<stage>-answer.miss.json` when a gate exists and did not match, or when the answer write throws
- Modify: `scripts/await.js:98-101` — with no answer file, `since` falls back to the in-flight mark's `at`
- Read: `lib/handoff.js` — `answerPath`, `readGate`, `gateMatches`, `writeAnswer`; not changed
- Read: `tests/gate.test.js` — its `handoff`, `QUESTIONS`, `askOf` and `agentsOn` helpers (lines 123-133) are copied; not changed
- Test: `tests/resume.test.js`
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — `<stage>-answer.miss.json` is a file nothing reads; `scripts/await.js` keeps its exports

**Dispatch:** implementer, sonnet — the change is given below as code plus two tests; transcription and a red-green run.

Steps:

1. Write the failing await test. In `tests/await.test.js`, after the test `await.js prints the line for each state, reading paths and the agent off the record`, add (`T`, `at` and `fixture` are already defined at the top of that file):

   ```js
   test('await.js with no answer file counts only a handoff newer than the in-flight mark as new', async () => {
       const f = fixture({ inflight: { stage: 'build', at: T, agentId: 'a1' } });
       const handoff = path.join(f.task, 'build.md').split(path.sep).join('/');
       at(handoff, T - 5000);
       const old = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
       assert.match(old.text, /^timeout — /, 'a report that predates the dispatch is not the answer to it: ' + old.text);
       at(handoff, T + 5000);
       const fresh = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
       assert.match(fresh.text, /^handoff /, fresh.text);
   });
   ```

2. Run `node --test tests/await.test.js` and watch that one test fail (`since` is 0, so the old report reads as `handoff`).

3. In `scripts/await.js`, in `waitFor`, replace the `let since = 0; try { ... } catch (e) { /* nothing answered yet: any report counts */ }` block with:

   ```js
   let since = 0;
   try {
       since = fs.statSync(opts.since || answerPath(root, data, data.stage, lap)).mtimeMs;
   } catch (e) {
       // Nothing answered yet — or the answer file was never written, which
       // hooks/resume.js now says with `<stage>-answer.miss.json`. Either way a
       // report older than the dispatch is not the reply to it.
       if (mark && Number.isFinite(mark.at)) since = mark.at;
   }
   ```

4. Run `node --test tests/await.test.js`; every test passes, including the older ones whose marks carry `at: 1`.

5. Write the failing resume tests. In `tests/resume.test.js`, at the end of the file, add a fixture block and three tests. It copies `handoff`, `QUESTIONS`, `askOf` and `agentsOn` from `tests/gate.test.js:123-133` (open that file first), and uses this file's own `seed`, `run` and `tmp`:

   ```js
   const SURVEY_DIR = (root) => path.join(root, '.fankeel', 'build', 'task-20260919T093012');
   const GATE_QUESTIONS = [{ question: 'survey 的結論可以進 design 嗎？', header: 'survey', multiSelect: false, options: [{ label: '進 design', description: 'a' }, { label: '暫停', description: 'b' }] }];

   function surveyWithGate(root) {
     seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
     fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'true' }));
     const ticks = '`'.repeat(3);
     fs.mkdirSync(SURVEY_DIR(root), { recursive: true });
     fs.writeFileSync(path.join(SURVEY_DIR(root), 'survey.md'), '# report\n\n' + ticks + 'json gate\n' + JSON.stringify({ questions: GATE_QUESTIONS, next: 'n' }) + '\n' + ticks + '\n');
   }
   const answered = (root, asked) => run({ cwd: root, session_id: MINE, tool_input: { questions: asked }, tool_response: { answers: { 'q?': '暫停' } } });

   test('a gate on disk that the asked questions do not match leaves a miss file with the reason and both question lists', () => {
     const root = tmp('fankeel-resume-');
     surveyWithGate(root);
     const asked = [{ question: 'something else?', header: 'other', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }];
     answered(root, asked);
     const miss = JSON.parse(fs.readFileSync(path.join(SURVEY_DIR(root), 'survey-answer.miss.json'), 'utf8'));
     assert.match(miss.reason, /do not match/);
     assert.deepEqual(miss.asked, asked);
     assert.deepEqual(miss.filed, GATE_QUESTIONS);
     assert.ok(Number.isFinite(miss.at));
     assert.equal(fs.existsSync(path.join(SURVEY_DIR(root), 'survey-answer.md')), false);
   });

   test('a matching gate writes the answer and no miss file', () => {
     const root = tmp('fankeel-resume-');
     surveyWithGate(root);
     answered(root, JSON.parse(JSON.stringify(GATE_QUESTIONS)));
     assert.ok(fs.existsSync(path.join(SURVEY_DIR(root), 'survey-answer.md')));
     assert.equal(fs.existsSync(path.join(SURVEY_DIR(root), 'survey-answer.miss.json')), false);
   });

   test('an answer write that throws leaves the miss file with the error message as the reason', () => {
     const root = tmp('fankeel-resume-');
     surveyWithGate(root);
     fs.mkdirSync(path.join(SURVEY_DIR(root), 'survey-answer.md'));
     answered(root, JSON.parse(JSON.stringify(GATE_QUESTIONS)));
     const miss = JSON.parse(fs.readFileSync(path.join(SURVEY_DIR(root), 'survey-answer.miss.json'), 'utf8'));
     assert.match(miss.reason, /EISDIR|illegal operation on a directory/);
   });
   ```

6. Run `node --test tests/resume.test.js`; the first and third new tests fail (no miss file), the second passes.

7. In `hooks/resume.js`, replace the body of the `try` under `// \`stage.agents\`: the answer left where the stage agent is told to look` — the block from `const gate = readGate(` to its closing `}` before `} catch (e) { /* housekeeping */ }` — with:

   ```js
   const gate = readGate(handoffPath(root, mine, mine.stage), nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE);
   const asked = payload.tool_input && payload.tool_input.questions;
   const file = answerPath(root, mine, mine.stage);
   const response = payload.tool_response;
   if (gate && file && response != null) {
       // The answer that never arrives used to be silent. Beside the answer
       // file, `<stage>-answer.miss.json` says why not and holds both question
       // lists. Diagnostic only: nothing reads it, and a controller's own
       // question asked while an older gate is still on disk lands here too.
       const miss = file.replace(/-answer\.md$/, '-answer.miss.json');
       const filed = Array.isArray(gate.questions) ? gate.questions : null;
       const note = (reason) => {
           try {
               writeAnswer(miss, JSON.stringify({ at: Date.now(), reason, asked: asked === undefined ? null : asked, filed }, null, 2));
           } catch (e) { /* housekeeping */ }
       };
       if (!gateMatches(asked, gate.questions)) {
           note(gate.invalid
               ? 'the handoff\'s gate is invalid at ' + gate.invalid + ': ' + gate.detail
               : 'the questions asked do not match the handoff\'s gate');
       } else {
           try {
               writeAnswer(file, typeof response === 'string' ? response : JSON.stringify(response, null, 2));
           } catch (e) {
               note(String((e && e.message) || e));
           }
       }
   }
   ```

8. Run `node --test tests/resume.test.js tests/await.test.js`; both pass. Run `node --test tests/gate.test.js` as a read-only check that the existing answer tests still pass; it is not edited.

9. Commit: `fix: a mismatched gate leaves an answer.miss.json, and await ignores a report older than the dispatch`.

## Task 2: the mark knows which build brain it is

**Files:**
- Modify: `hooks/brief.js:74-84` — at SubagentStart for a build brain, read line 1 of its own transcript and pass group or kind to `markInflight`
- Modify: `lib/registry.js:812-844` — `markInflight` takes a seventh parameter `kind` and stores it on the mark
- Modify: `scripts/await.js:88-135` — a `close` mark watches plain `build.md`; a `group` mark whose handoff arrived is cleared
- Read: `lib/render.js` — `renderBrief` and `newestPlan`, which `hooks/brief.js` and `scripts/await.js` call; not changed
- Test: `tests/brief.test.js`
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: `sessionDirOf(transcriptPath)` from `lib/usage.js`, already imported in `hooks/brief.js`; `registry.inflights(data)` and `registry.clearInflight(root, sessionId, agentId)`, unchanged
- Produces: `registry.markInflight(projectRoot, sessionId, stage, agentId, lap, group, kind)` — `kind` is `'group'`, `'close'` or omitted; a mark gains `kind` only when given

**Dispatch:** implementer, sonnet — the shapes and code are below; the only check the implementer adds is one real transcript line.

Steps:

1. Check the unverified fact first. Run `head -1` on any subagent transcript under the project's directory in the Claude config directory (projects, slug, session, subagents, agent-id .jsonl) and confirm line 1 is JSON whose `message.content` is the dispatch prompt (a string, or an array of `{ text }` parts). If it is neither, stop and report; the parser below assumes both.

2. Write the failing brief test. In `tests/brief.test.js`, after the test `two brains dispatched together for build get distinct groups, and both marks stay in flight until each reports`, add:

   ```js
   function agentLine(root, id, prompt) {
     const sub = path.join(root, 'sess', 'subagents');
     fs.mkdirSync(sub, { recursive: true });
     fs.writeFileSync(path.join(sub, 'agent-' + id + '.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } }) + '\n');
   }

   test('a build brain sent as `build group 3` gets mark group 3 whatever order it started in; `build close` gets kind close', () => {
     const root = tmp();
     seedProfile(root, { 'stage.agents': ['build'] });
     seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
     const transcript = path.join(root, 'sess.jsonl');
     agentLine(root, 'c1', 'Run build close for this plan.');
     agentLine(root, 'g3', 'Run build group 3: tasks 4, 5.');
     run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'c1', transcript_path: transcript }));
     run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'g3', transcript_path: transcript }));
     const marks = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8')).inflight;
     const close = marks.find((m) => m.agentId === 'c1');
     const group = marks.find((m) => m.agentId === 'g3');
     assert.equal(close.kind, 'close');
     assert.deepEqual([group.kind, group.group], ['group', 3]);
   });

   test('a build brain whose transcript cannot be read keeps today\'s numbering and carries no kind', () => {
     const root = tmp();
     seedProfile(root, { 'stage.agents': ['build'] });
     seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
     run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'u1', transcript_path: path.join(root, 'sess.jsonl') }));
     const mark = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8')).inflight;
     assert.equal(mark.group, 1);
     assert.equal('kind' in mark, false);
   });
   ```

3. Run `node --test tests/brief.test.js`; the first new test fails (no `kind`), the second passes.

4. In `lib/registry.js`, change the signature to `function markInflight(projectRoot, sessionId, stage, agentId, lap, group, kind) {`, and after the `if (lapNum) mark.lap = lapNum;` line add:

   ```js
   // Which case the brain was sent for — `group` (task numbers) or `close`
   // (the stage's own gate-bearing run) — so scripts/await.js can tell them
   // apart; a mark with none reads as it always did.
   if (kind === 'group' || kind === 'close') mark.kind = kind;
   ```

   Extend the comment above the function with one sentence naming `kind`.

5. In `hooks/brief.js`, above `main`, add:

   ```js
   // What a build brain was sent for: line 1 of its own transcript is the
   // dispatch prompt, which names `build group <n>` or `build close`. Unreadable
   // — no path, no file yet, bad JSON, neither phrase — is null, and the mark is
   // then made the way it always was.
   function caseOf(payload) {
       const dir = sessionDirOf(payload.transcript_path);
       if (!dir || !payload.agent_id) return null;
       let line;
       try {
           const fd = fs.openSync(path.join(dir, 'subagents', 'agent-' + payload.agent_id + '.jsonl'), 'r');
           try {
               const buf = Buffer.alloc(65536);
               const n = fs.readSync(fd, buf, 0, buf.length, 0);
               line = buf.toString('utf8', 0, n).split(/\r?\n/, 1)[0];
           } finally {
               fs.closeSync(fd);
           }
       } catch (e) {
           return null;
       }
       let text = '';
       try {
           const content = JSON.parse(line).message.content;
           text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map((p) => (p && p.text) || '').join('\n') : '');
       } catch (e) {
           return null;
       }
       const m = /\bbuild (?:close|group (\d+))\b/.exec(text);
       if (!m) return null;
       return m[1] ? { kind: 'group', group: Number(m[1]) } : { kind: 'close' };
   }
   ```

   Also in `hooks/brief.js`, replace the `group = registry.markInflight(...)` call inside `main` with:

   ```js
   const sent = mine.stage === 'build' ? caseOf(payload) : null;
   group = registry.markInflight(root, payload.session_id, mine.stage, payload.agent_id, lapOf(mine, mine.stage), sent && sent.group, sent && sent.kind);
   ```

6. Run `node --test tests/brief.test.js`; all pass, including the nested-brain tests.

7. Write the failing await test. In `tests/await.test.js`, after the test `await.js clears only the lost agent's own in-flight mark, leaving a sibling's standing`, add:

   ```js
   // docs/90-agent/plans/2026-09-28-agent-lifetime-design.md §1 and TODO 〔await〕:
   // the mark carries which case the brain was sent for, so a close brain that
   // started first no longer watches build-g1.md, and a group brain's mark
   // clears when its own handoff arrives. The 39522eef version of the clear
   // was reverted (5e2e621d) because a close mark also carried a group number.
   test('await.js watches build.md for a close mark and build-g3.md for a group mark, and clears only the group mark on handoff', async () => {
       const f = fixture({});
       const transcript = path.join(f.root, 'sess.jsonl');
       for (const [id, prompt] of [['c1', 'Run build close.'], ['g3', 'Run build group 3.']]) {
           at(path.join(f.root, 'sess', 'subagents', 'agent-' + id + '.jsonl'), Date.now(), JSON.stringify({ message: { role: 'user', content: prompt } }) + '\n');
           const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'brief.js')], {
               input: JSON.stringify({ session_id: SID, cwd: f.root, hook_event_name: 'SubagentStart', agent_id: id, agent_type: 'fankeel:fankeel-brain', transcript_path: transcript }),
               encoding: 'utf8',
               env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: f.root, CLAUDE_CONFIG_DIR: f.config }),
           });
           assert.equal(r.status, 0, r.stderr);
       }
       const plain = path.join(f.task, 'build.md').split(path.sep).join('/');
       const g3 = path.join(f.task, 'build-g3.md').split(path.sep).join('/');
       at(plain, Date.now());
       at(g3, Date.now());
       const close = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'c1', '--timeout', '0.5'], f.env);
       assert.ok(close.text.startsWith('handoff ' + plain), close.text);
       assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId).sort(), ['c1', 'g3'], 'a close mark is left for hooks/gate.js');
       const group = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'g3', '--timeout', '0.5'], f.env);
       assert.equal(group.text.startsWith('group 3, agent g3: handoff ' + g3), true, group.text);
       assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId), ['c1'], 'the group mark clears once its own handoff arrives');
   });
   ```

8. Run `node --test tests/await.test.js`; the new test fails (the close mark watches `build-g1.md`).

9. In `scripts/await.js`, in `waitFor`, replace the `const group = ...` line and its two-line comment with:

   ```js
   // Only build's brief names a `-g<n>` handoff (lib/render.js, renderBrainBrief),
   // and only for a group brain: a `close` mark watches the plain one whatever
   // number `markInflight` gave it, so the mark's `kind` decides, not its `group`.
   const kind = mark && (mark.kind === 'group' || mark.kind === 'close') ? mark.kind : undefined;
   const group = data.stage === 'build' && mark && kind !== 'close' && Number.isInteger(mark.group) ? mark.group : undefined;
   ```

   In the object `waitFor` returns, add `kind` beside `group`. Then, in `scripts/await.js`, in `main`, replace the `if (state === 'lost') registry.clearInflight(...)` line with:

   ```js
   // A group brain returns with no gate, so hooks/gate.js never clears its
   // mark; its own handoff arriving is the only signal there is. A close mark
   // is left standing for hooks/gate.js, once the gate is confirmed.
   if (state === 'lost' || (state === 'handoff' && o.kind === 'group')) registry.clearInflight(o.root, opts.session, o.agentId);
   ```

10. Run `node --test tests/await.test.js tests/brief.test.js`; both pass. Also run `node --test tests/registry.test.js` as a read-only check that no existing mark shape changed; it is not edited.

11. Commit: `fix: the in-flight mark records whether a build brain was sent for a group or the close`.

## Task 3: a brain never returns over a live implementer

**Files:**
- Modify: `agents/fankeel-brain.md:99` — `## Return` forbids any return while a dispatched agent has not returned
- Modify: `lib/render.js:519` — the build brief's group-and-close line says the same beside where it says to return the path
- Read: `lib/registry.js` — the helpers `lib/render.js` imports from it; not changed
- Test: `tests/agents.test.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — one sentence added in two places, with a test on each and a mutation control.

Steps:

1. Write the failing tests. In `tests/agents.test.js`, after the test `the stage agent's Return section says a group writes no gate, and only build close does`, add:

   ```js
   test('the stage agent\'s Return section forbids any return while a dispatched agent has not returned', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
       const ret = text.split('\n## Return\n')[1];
       assert.match(ret, /never while an agent you dispatched has not returned — end the turn with `waiting` until it has/);
   });
   ```

   In `tests/render.test.js`, at the end of the file, add (`entry`, `MINE` and `NOW` exist at the top of the file):

   ```js
   test('a build brain\'s brief says beside both the group return and the close return to return only once every implementer has returned', () => {
     const { renderBrief } = require('../lib/render.js');
     const on = { values: { 'stage.agents': ['build'], 'dispatch.floor': 'sonnet' }, sources: {}, unreadable: [] };
     const mine = entry(MINE, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
     const brief = renderBrief({ mine, agentType: 'fankeel:fankeel-brain', root: '/r', profile: on });
     const line = brief.split('\n').find((l) => l.includes('Your prompt names your case'));
     assert.ok(line, 'the group-and-close line is missing');
     assert.equal(line.split('once every implementer you sent has returned').length - 1, 2, 'one for the group return, one for the close return');
   });
   ```

2. Run `node --test tests/agents.test.js tests/render.test.js`; the two new tests fail.

3. In `agents/fankeel-brain.md`, in `## Return`, replace the opening sentence `Return once, when the stage is done or blocked.` with:

   ```md
   Return once, when the stage is done or blocked, and never while an agent you dispatched has not returned — end the turn with `waiting` until it has.
   ```

   Leave the rest of the paragraph (`When you must wait for an agent you dispatched...`) as it is.

4. In `lib/render.js`, in the `Your prompt names your case:` line (the first `lines.push` inside `if (stage === 'build')`), change `and return that path — a fresh brain continues what is left.` to `and return that path once every implementer you sent has returned — a fresh brain continues what is left.`, and change `— the only gate this whole stage asks.` to `— the only gate this whole stage asks, returned once every implementer you sent has returned.`

5. Run `node --test tests/agents.test.js tests/render.test.js tests/brief.test.js`; all pass, including the brief-length asserts (the brief stays under 10,000 characters).

6. Mutation control, one variable at a time. Delete only the sentence in `agents/fankeel-brain.md`, run `node --test tests/agents.test.js`, watch the new test go red, restore it. Then delete only the two phrases in `lib/render.js`, run `node --test tests/render.test.js`, watch the new test go red, restore them. Paste both red outputs in the report.

7. Commit: `fix: a stage agent never returns while an implementer it sent is still running`.

## Task 4: the reviewer reads a project's REVIEW.md

**Files:**
- Modify: `agents/fankeel-reviewer.md:48` — a new `## The project's REVIEW.md` section before `## Never a finding`
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — a section of prose and one test; the unverified working-directory question is answered in the wording.

Steps:

1. Write the failing test. In `tests/agents.test.js`, after the test `a general exclusion list covers every lens: ...`, add:

   ```js
   test('the reviewer reads a project\'s REVIEW.md before any lens: its do-not-report list joins Never a finding, its Important decides severity', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
       assert.match(text, /^## The project's REVIEW\.md$/m);
       const section = text.split('\n## The project\'s REVIEW.md\n')[1].split('\n## ')[0];
       assert.match(section, /git rev-parse --show-toplevel/);
       assert.match(section, /before any lens/);
       assert.match(section, /Never a finding/);
       assert.match(section, /Important/);
       assert.match(section, /no such file/);
       assert.ok(text.indexOf('## The project\'s REVIEW.md') < text.indexOf('\n## Never a finding'), 'the section comes before Never a finding');
   });
   ```

2. Run `node --test tests/agents.test.js`; the new test fails (`REVIEW.md` is absent from the agent file).

3. In `agents/fankeel-reviewer.md`, immediately above the `## Never a finding` heading, add:

   ```md
   ## The project's REVIEW.md

   Before any lens, look for `REVIEW.md` at the repository root — the directory
   `git rev-parse --show-toplevel` prints, not wherever this shell happens to
   stand. Where it exists, read it. Its "do not report" list joins `## Never a
   finding` below for every lens: a finding it names is not reported. Its
   definition of Important decides the severity of a finding wherever a lens
   grades one. Where there is no such file, nothing changes: review exactly as
   the rest of this file says.
   ```

4. Run `node --test tests/agents.test.js`; all pass, including the `Never a finding` test that splits on that heading.

5. Commit: `feat: the reviewer reads a project's REVIEW.md`.

## Task 5: budget.js finds a workflow agent's transcript

**Files:**
- Modify: `hooks/budget.js:33-41` — when `subagents/agent-<id>.jsonl` is absent, look under `subagents/workflows/*/`
- Read: `lib/usage.js` — `agentFiles(sessionDir)` walks that layout and its `AGENT_FILE` regexp; not changed
- Test: `tests/budget.test.js`

**Interfaces:**
- Consumes: `agentFiles(sessionDir)` from `lib/usage.js`, returning absolute paths of every `agent-<hex>.jsonl` under `subagents/` and `subagents/workflows/<run>/`
- Produces: none

**Dispatch:** implementer, sonnet — the code is given; one test.

Steps:

1. Write the failing test. In `tests/budget.test.js`, after the test `460k on PreToolUse: a Write under .fankeel/build/ is let through`, add. The agent id is hex on purpose: `agentFiles()` skips a file whose id is not (open `AGENT_FILE` in `lib/usage.js` to confirm):

   ```js
   test('460k in a workflow agent\'s transcript, present only under subagents/workflows/: a Read is denied', () => {
       const root = tmp('fankeel-budget-');
       seed(root, MINE);
       const t = transcript(root, 1000);
       const dir = path.join(root, 'transcript', 'subagents', 'workflows', 'wf_x');
       fs.mkdirSync(dir, { recursive: true });
       fs.writeFileSync(path.join(dir, 'agent-a0b1c2.jsonl'), JSON.stringify({ message: { usage: {
           input_tokens: 460000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
       } } }) + '\n');
       const out = run({ session_id: MINE, cwd: root, agent_id: 'a0b1c2', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'lib/x.js' }, transcript_path: t });
       const o = JSON.parse(out).hookSpecificOutput;
       assert.equal(o.permissionDecision, 'deny');
       assert.match(o.permissionDecisionReason, /relay-a0b1c2\.md/);
   });
   ```

2. Run `node --test tests/budget.test.js`; the new test fails (the hook prints nothing).

3. In `hooks/budget.js`, add `const fs = require('node:fs');` beside the other requires, change the `usage` import to `const { sessionDirOf, agentFiles } = require('../lib/usage.js');`, and replace the two lines that build `agentFile` with:

   ```js
   // A workflow's agents write under subagents/workflows/<run>/, not beside the
   // session's own — the layout lib/usage.js already walks. The direct path
   // first: this runs on every tool call of every subagent, and the walk reads
   // a directory.
   let agentFile = path.join(dir, 'subagents', 'agent-' + payload.agent_id + '.jsonl');
   if (!fs.existsSync(agentFile)) {
       const found = agentFiles(dir).find((f) => path.basename(f) === 'agent-' + payload.agent_id + '.jsonl');
       if (found) agentFile = found;
   }
   ```

4. Run `node --test tests/budget.test.js`; all pass.

5. Commit: `fix: budget.js meters a workflow agent's transcript too`.

## Task 6: groups never offers Workflow to a brain

**Files:**
- Modify: `scripts/ledger.js:191-275` — `groupsReport` reads the project profile; with build on `stage.agents`, a `workflow` group prints `agents` and the closing line drops "or one Workflow"
- Read: `lib/profile.js` — `profileFor(root, mine)`; not changed
- Read: `lib/stages.js` — `controlling(stage, values)`; not changed
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: `profileFor(root, mine)` from `lib/profile.js` (`mine` may be `{}`; the profile is `{ values, sources, unreadable }`); `controlling(stage, values)` from `lib/stages.js` (true when `values['stage.agents']` names the stage)
- Produces: none

**Dispatch:** implementer, sonnet — code and tests are given; the first step answers the unverified `profileFor` question.

Steps:

1. Check the unverified fact. Run this from the repository root and confirm it prints `false`, then `true` with a project profile naming build:

   ```sh
   node -e "const p=require('./lib/profile.js'),s=require('./lib/stages.js');const os=require('os'),fs=require('fs'),path=require('path');const d=fs.mkdtempSync(path.join(os.tmpdir(),'pf-'));process.env.CLAUDE_CONFIG_DIR=path.join(d,'cfg');console.log(s.controlling('build',p.profileFor(d,{}).values));fs.mkdirSync(path.join(d,'.fankeel'));fs.writeFileSync(path.join(d,'.fankeel','profile.json'),JSON.stringify({'stage.agents':['build']}));console.log(s.controlling('build',p.profileFor(d,{}).values))"
   ```

   If `profileFor(root, {})` throws, stop and report; the code below wraps it in a `try` either way.

2. Pin the config directory for the whole test file. In `tests/ledger.test.js`, directly under `const root = () => tmp('fankeel-ledger-');`, add:

   ```js
   // `groups` now reads the profile, and the machine profile lives under the
   // config directory: pinned to an empty one so no test reads the real machine's.
   process.env.CLAUDE_CONFIG_DIR = tmp('fankeel-ledger-cfg-');
   ```

3. Write the failing tests. In `tests/ledger.test.js`, after the test `groups names the tasks that declared no interfaces`, add:

   ```js
   const THREE_DISJOINT = [
     '## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', '',
     '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
     '## Task 2: two', '', '**Files:**', '- Modify: `lib/b.js`', '',
     '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
     '## Task 3: three', '', '**Files:**', '- Modify: `lib/c.js`', '',
     '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
   ].join('\n');

   test('groups prints workflow for three disjoint tasks when build is not on stage.agents, and agents when it is', () => {
     const dir = root();
     const plan = path.join(dir, 'plan.md');
     fs.writeFileSync(plan, THREE_DISJOINT);
     const before = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });
     assert.match(before, /1: 1, 2, 3 {2}— workflow/);
     assert.match(before, /or one Workflow\./);
     fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
     fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
     const after = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });
     assert.match(after, /1: 1, 2, 3 {2}— agents/);
     assert.doesNotMatch(after, /workflow/i);
     assert.match(after, /1 groups over 3 tasks/);
   });
   ```

4. Run `node --test tests/ledger.test.js`; the new test fails on its last three asserts (`workflow` is still printed).

5. In `scripts/ledger.js`, add near the other requires `const profileLib = require('../lib/profile.js');` and `const { controlling } = require('../lib/stages.js');`. In `groupsReport`, replace the `const surfaced = ...` statement with:

   ```js
   // A stage agent has no Workflow tool, so when build runs under one
   // (`stage.agents` names build) a group the tasks would call `workflow` is
   // sent as `agents`. A profile that cannot be read leaves today's answer.
   let brainBuild = false;
   try {
       brainBuild = controlling('build', profileLib.profileFor(root, {}).values);
   } catch (e) { /* no profile: what it always printed */ }
   const surfaced = plantasks.surfaces(tasks).map((g) => (
       g.surface === 'workflow' && (brainBuild || g.tasks.some((n) => flagged.has(n)))
           ? { tasks: g.tasks, surface: 'agents' }
           : g
   ));
   ```

   Then change the closing sentence `'\n\nOne group is one surface: one dispatch, two Agents in one response, or one Workflow.'` to `'\n\nOne group is one surface: one dispatch, two Agents in one response' + (brainBuild ? '.' : ', or one Workflow.')`.

6. Run `node --test tests/ledger.test.js`; all pass, including every older `groups` test.

7. Commit: `fix: ledger groups never prints workflow when build runs under a stage agent`.

## Task 7: a Risks section, checked by lint

**Files:**
- Modify: `scripts/ledger.js:614-630` — the `lint` verb adds a finding when the plan header has no `## Risks`
- Modify: `skills/fankeel-plan/SKILL.md:57-66` — the header template gains `## Risks`
- Read: `lib/plantasks.js` — `parsePlan` returns `header` as the text before the first task; not changed
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: `plantasks.parsePlan(planText)` returning `{ header, tasks }` with `header` a string; `plantasks.lint(planText, designText, root)` returning an array of finding strings
- Produces: none

**Dispatch:** implementer, sonnet — the header check lives in `scripts/ledger.js` beside the `**Spec:**` check, so `plantasks.lint` and its unit tests are untouched; code and tests are given.

Steps:

1. Check the unverified fact. Run `grep -rn "'lint'\|\.lint(" tests scripts lib hooks` and confirm the only callers of the `lint` verb are in `tests/ledger.test.js` and the lint-cap test file (CLI), and that `plantasks.lint` is called only by the verb. Any other caller means archived plans might be linted; if you find one, stop and report it.

2. Update the fixtures so one variable changes. In `tests/ledger.test.js`, in `PLAN_HEAD`, after `'## Global Constraints', '', '- **No dependency may be added.**', '- four-space indent', '',` add `'## Risks', '', '- none found', '',`. The existing tests `lint reads the design from the Spec line...` (still `2 findings`) and `lint is clean when the Coverage table quotes every promise` keep their counts because the fixture now carries the section.

3. Write the failing test. In `tests/ledger.test.js`, after the test `lint refuses a plan whose header names no Spec`, add:

   ```js
   test('lint names a plan whose header has no Risks section, and is clean once it says none found', () => {
     const dir = root();
     fs.writeFileSync(path.join(dir, 'design.md'), DESIGN);
     const coverage = [
       '## Coverage', '', '| promise | task |', '|---|---|',
       '| the page gains a `waited` column beside the burn column | Task 1 |',
       '| `tests/a.test.js` — makeA returns the thing | Task 1 |', '',
     ].join('\n');
     const plan = path.join(dir, 'plan.md');
     fs.writeFileSync(plan, PLAN_HEAD.replace('## Risks\n\n- none found\n\n', '') + PLAN_TASKS + coverage);
     const missing = run(dir, plan, 'lint');
     assert.equal(missing.code, 1);
     assert.match(missing.out, /lint: 1 findings/);
     assert.match(missing.out, /no `## Risks` section/);
     fs.writeFileSync(plan, PLAN_HEAD + PLAN_TASKS + coverage);
     const present = run(dir, plan, 'lint');
     assert.equal(present.code, 0, present.out);
     assert.match(present.out, /lint: clean/);
   });
   ```

4. Run `node --test tests/ledger.test.js`; the new test fails (a Risks-less plan lints clean today).

5. In `scripts/ledger.js`, in the `lint` verb, replace `const lines = plantasks.lint(planText, designText, root);` with:

   ```js
   const lines = plantasks.lint(planText, designText, root);
   // A plan names what could make a task wrong, even to say nothing did.
   if (!/^##\s+Risks\s*$/m.test(header)) {
       lines.push('the plan header has no `## Risks` section — one bullet per thing that could make a task wrong, or `none found`');
   }
   ```

6. In `skills/fankeel-plan/SKILL.md`, in the header template fence (`## The header`), after the `## Global Constraints` line add a blank line and a `## Risks` line, so the template ends:

   ```md
   ## Global Constraints

   ## Risks
   - <what could make a task wrong> — <which task it would hit> — <what that task checks first>, or `none found`
   ```

   Below the fence, add one paragraph: `**Risks** sit between Global Constraints and the first task; \`ledger.js lint\` reports a plan whose header has no \`## Risks\` heading. \`none found\` is an answer — the heading is what says the question was asked.` Say in the report that the bullet shape is this repository's own: the playbook example is known only through a fetch summary (design section 7).

7. Run `node --test tests/ledger.test.js`, and the lint-cap CLI test file beside it by name (`node --test` on it) as a read-only check: it asserts one line, not a count, so it stays green without an edit. Run `node --test tests/plan-skill-caps.test.js tests/stages.test.js` as a read-only check that no test pins the old header template; neither is edited.

8. Commit: `feat: plan lint requires a ## Risks section`.

## Task 8: a user-invoked skill never reaches another

**Files:**
- Modify: `skills/fankeel/SKILL.md:885-907` — `## Calibration` gains one paragraph and its opening count
- Modify: `skills/fankeel-station/SKILL.md:1-9` — frontmatter `disable-model-invocation: true`
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `frontmatter(text)` and `read(name)` from `tests/skills.test.js` — `frontmatter` returns each key as a trimmed string, so the value reads `'true'`
- Produces: none

**Dispatch:** implementer, sonnet — two small edits and one test; whether the host honours the key stays unverified and is reported as such.

Steps:

1. Write the failing test. In `tests/skills.test.js`, at the end of the file, add (`names`, `read` and `frontmatter` exist at the top):

   ```js
   // docs/03-decisions/2026-09-24-skill-repos.md candidate 4 (mattpocock/skills
   // README.md:186): a user-invoked skill may use model-invoked skills, never
   // another user-invoked one. The host is what keeps the model off a skill
   // marked disable-model-invocation; this pins that the key and the rule are written.
   test('a skill marked disable-model-invocation is named by no other such skill, fankeel-station is one, and the rule is written in the fankeel skill', () => {
     const userInvoked = names.filter((n) => (frontmatter(read(n)) || {})['disable-model-invocation'] === 'true');
     assert.ok(userInvoked.includes('fankeel-station'), 'fankeel-station is for a person to type');
     for (const a of userInvoked) {
       for (const b of userInvoked) {
         if (a === b) continue;
         assert.equal(read(a).includes(b), false, a + ' names another user-invoked skill, ' + b);
       }
     }
     const calibration = read('fankeel').split('\n## Calibration\n')[1].split('\n## ')[0];
     assert.match(calibration, /A skill the user invoked may use model-invoked skills, never another user-invoked one/);
   });
   ```

2. Run `node --test tests/skills.test.js`; the new test fails on its first assert.

3. In `skills/fankeel-station/SKILL.md`, add `disable-model-invocation: true` as a new line in the frontmatter, directly under the `description:` line.

4. In `skills/fankeel/SKILL.md`, under `## Calibration`: change `Four rules sit above the ones a stage carries` to `Five rules sit above the ones a stage carries`, and after the paragraph that begins `**While a task is active, \`fankeel-<stage>\` is the procedure for that step.**` add:

   ```md
   **A skill the user invoked may use model-invoked skills, never another
   user-invoked one.** A skill marked `disable-model-invocation: true` — today
   `fankeel-station` — is reachable only when a person types it, so no other
   skill routes to it and no model reaches for it. Two questions to the user, one
   from each of two stacked skills, is the failure this prevents.
   ```

5. Run `node --test tests/skills.test.js`; all pass, including `the fankeel skill routes the station phrases, and only the station skill names /fankeel-station`. If `claude plugin validate .` exists on this machine, run it and paste the result; if not, list it under `Not run:` with the reason. Report that whether the host honours the key for a plugin skill is unverified (design section 5).

6. Commit: `feat: a user-invoked skill is never routed to another; fankeel-station is user-invoked only`.

## Task 9: Common rationalizations in the build skill

**Files:**
- Modify: `skills/fankeel-build/SKILL.md:623` — a `## Common rationalizations` table before `## Output`
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `read(name)` from `tests/skills.test.js`
- Produces: none

**Dispatch:** implementer, sonnet — a 4 to 6 row table; every row is an incident this repository already recorded, and the first step is to check each one is still recorded where the row will say.

Steps:

1. Check every incident before writing it. Candidates, each with where it is recorded; open each and confirm it says what the row will say:
   - polling with `sleep` — `agents/fankeel-brain.md` (`## Return`, the `261 of 295 Bash calls` sentence, 2026-09-23) and `docs/90-agent/reports/2026-09-23-brain-wakeup.md`.
   - a stash that dropped neighbours — `docs/03-decisions/2026-09-25-todo-line-and-multiplier.md:23` (a `git stash push -u` then drop cleared an uncommitted override).
   - searching the disk for a definition — `skills/fankeel-plan/SKILL.md:137` (`find /` sat 38 minutes on 2026-09-06).
   - a cost claim carried from memory — `skills/fankeel-build/SKILL.md`, section `## A cost claim is measured, not assumed`.
   - a suite green only with neighbours dirty — search `docs/` and `skills/` for it (`grep -rn "neighbours dirty\|neighbour.*dirty" docs skills`); if it is not recorded in the repository, drop the row rather than write it from memory.
   A row whose incident cannot be found is dropped; the table needs 4 to 6 rows, and the cost claim row and the three above with a source are enough.

2. Write the failing test. In `tests/skills.test.js`, at the end of the file, add:

   ```js
   test('fankeel-build carries a Common rationalizations table of 4 to 6 rows, each citing a date or a path', () => {
     const text = read('fankeel-build');
     assert.match(text, /^## Common rationalizations$/m);
     const body = text.split('\n## Common rationalizations\n')[1].split('\n## ')[0];
     const rows = body.split('\n').filter((l) => l.startsWith('|') && !/^\|\s*-{2,}/.test(l) && !/^\|\s*excuse\s*\|/i.test(l));
     assert.ok(rows.length >= 4 && rows.length <= 6, rows.length + ' rows');
     for (const row of rows) {
       assert.match(row, /\d{4}-\d{2}-\d{2}|[\w./-]+\.(md|js|json)\b/, 'a row cites no date or path: ' + row);
     }
   });
   ```

3. Run `node --test tests/skills.test.js`; the new test fails (the heading is absent).

4. In `skills/fankeel-build/SKILL.md`, immediately above `## Output`, add the section, one row per incident you confirmed in step 1, in this shape (fill the rows from the sources, quoting numbers as the source states them):

   ```md
   ## Common rationalizations

   | excuse | what happened |
   |---|---|
   | "I will poll until it returns" | 2026-09-23: a build agent spent 261 of 295 Bash calls on `sleep`/`echo` loops, each re-sending its whole context (`agents/fankeel-brain.md`, `## Return`). |
   ```

   The row above is the first row, already written; add the others in the same two-column shape.

5. Run `node --test tests/skills.test.js`; all pass.

6. Commit: `docs: fankeel-build lists the rationalizations its own history recorded`.

## Task 10: build, test and lint always run at verify

**Files:**
- Modify: `skills/fankeel-verify/SKILL.md:60-79` — a new section after `## What each claim requires`
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `read(name)` from `tests/skills.test.js`
- Produces: none

**Dispatch:** implementer, sonnet — one section of prose and one test; the injected verify rule (in the stages library) is not touched (its 2400-byte budget has about 12 bytes free).

Steps:

1. Write the failing test. In `tests/skills.test.js`, at the end of the file, add:

   ```js
   test('fankeel-verify always runs the project\'s declared build, test and lint, and says none declared when there are none', () => {
     const text = read('fankeel-verify');
     assert.match(text, /^## Always run: build, test and lint$/m);
     const body = text.split('\n## Always run: build, test and lint\n')[1].split('\n## ')[0];
     assert.match(body, /whether or not anyone claimed/);
     assert.match(body, /package\.json/);
     assert.match(body, /Makefile/);
     assert.match(body, /none declared/);
   });
   ```

2. Run `node --test tests/skills.test.js`; the new test fails.

3. In `skills/fankeel-verify/SKILL.md`, between the paragraph ending `...not a description of what it should have said.` and `## Red flags — stop`, add:

   ```md
   ## Always run: build, test and lint

   Whether or not anyone claimed them, verify runs every one of build, test and
   lint that the project declares — a `package.json` script or a Makefile target
   of that name — and pastes each output as its own row of the evidence, under
   the same rule as the table above. Find them with
   `node -e "console.log(Object.keys(require('./package.json').scripts || {}))"` and
   `grep -E '^(build|test|lint):' Makefile`. A project that declares none of the
   three says so in one line: `none declared`.
   ```

4. Run `node --test tests/skills.test.js`; all pass.

5. Commit: `docs: verify always runs the project's declared build, test and lint`.

## Task 11: the decision record for the six skill candidates

**Files:**
- Modify: `docs/03-decisions/2026-09-29-skill-candidates.md` — a new page (file does not exist yet)
- Modify: `docs/README.md` — one index row after the row for `2026-09-24-skill-repos.md` (about line 214); that row stays as it is
- Read: `.fankeel/build/task-20260928T184117/repos/mattpocock-skills/README.md` — the invocation rule, the install paths
- Read: `.fankeel/build/task-20260928T184117/repos/mattpocock-skills/CHANGELOG.md` — the Changesets output
- Read: `.fankeel/build/task-20260928T184117/repos/mattpocock-skills/CONTEXT.md` — the shared vocabulary
- Read: `.fankeel/build/task-20260928T184117/repos/agent-skills/README.md` — the fixed sections of a skill
- Read: `docs/03-decisions/2026-09-24-skill-repos.md` — the six candidates, worded as they were; not edited

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — every claim is read off a clone and quoted with its path and line, and the reasons come from what fankeel already has.

Steps:

1. Read the six candidates in `docs/03-decisions/2026-09-24-skill-repos.md` (`## 對方有、fankeel 沒有`), then find each one's source in the clones with `grep -rn` (for example `grep -rn "Rationalizations" agent-skills/skills | head`, `grep -n "user-invoked" mattpocock-skills/README.md`, `grep -n "^## " mattpocock-skills/CHANGELOG.md | head`, `grep -n "^#" mattpocock-skills/CONTEXT.md | head`, `grep -n -i "install" mattpocock-skills/README.md`). For each candidate, write down the file, line and the sentence as the clone actually has it. Where the clone differs from the 09-24 page's summary, the record says so.

2. Write `docs/03-decisions/2026-09-29-skill-candidates.md` in Traditional Chinese (identifiers, paths and quotes stay as written), frontmatter `status: decision` and `last_verified: 2026-09-29`, a one-sentence conclusion first, then one section per candidate:
   - Candidate 1, Rationalizations, is taken for `skills/fankeel-build/SKILL.md` only (Task 9 of this plan; each row cites an incident the repository recorded).
   - Candidate 4, user-invoked never calls another user-invoked, is taken (Task 8: the rule in `skills/fankeel/SKILL.md`, `disable-model-invocation: true` on `fankeel-station`; the host's honouring of the key is unverified).
   - Candidates 2, 3, 5 and 6 are not taken, each with one line of reason, and each reason names what fankeel already has or does not need, taken from the 09-24 page's own row plus what the clone shows: 2 (a per-skill Verification checklist) against the `stop_condition` in `skills/registry.json`; 3 (Changesets changelog) against `scripts/version.js --changes`; 5 (a project `CONTEXT.md`) against `.fankeel/docs.json` and `.fankeel/map.md`; 6 (read-only or editable install) against the single local-directory install.
   - A closing section, `## 沒能核對的部分`, says what could not be checked; the 09-24 page is not edited, and its `## 挑選` section is answered here.

3. In `docs/README.md`, add one row directly after the row that names `2026-09-24-skill-repos.md`, in the same two-column shape: what the page answers, then a link whose text is `decisions/2026-09-29-skill-candidates.md` and whose target is `03-decisions/2026-09-29-skill-candidates.md`, relative to `docs/`.

4. Run `node scripts/docs-check.js` and `node scripts/docs-audit.js`; the new page resolves, its row is indexed, and nothing else changed status.

5. Commit: `docs: record which of the six skill candidates fankeel took, and why four were not`.

## Coverage

| promise | task |
|---|---|
| A gate that exists but did not match leaves `<stage>-answer.miss.json` with the reason and both question lists. | Task 1 |
| A write that throws leaves the same file with the error message as `reason`. | Task 1 |
| `await.js` with no answer file treats only a handoff newer than the in-flight mark's `at` as new. | Task 1 |
| A brain sent as `build group 3` gets mark group 3, whatever order it started in. | Task 2 |
| A brain sent as `build close` gets `kind: 'close'` and await watches `build.md`. | Task 2 |
| A group brain's mark is cleared once its `build-g<n>.md` arrives; a close mark is left for hooks/gate.js. | Task 2 |
| A transcript that cannot be read leaves today's numbering in place. | Task 2 |
| A brain's own file forbids any return while an agent it dispatched is still running. | Task 3 |
| A build brief, group and close alike, says the same beside where it says to return the path. | Task 3 |
| A workflow agent over the token budget is refused like any other subagent. | Task 5 |
| With build on `stage.agents`, `ledger.js groups` never prints `workflow`. | Task 6 |
| Without it, `groups` prints what it prints today. | Task 6 |
| The rule is written in the fankeel skill. | Task 8 |
| `fankeel-station` is user-invoked only. | Task 8 |
| No user-invoked skill names another. | Task 8 |
| fankeel-build lists the excuses its own history recorded, each with what it cost. | Task 9 |
| A new decision record `docs/03-decisions/2026-09-29-skill-candidates.md` (the 09-24 page is a decision and is not edited): candidates 2, 3, 5, 6 not taken, one line of reason each, verbatim-checked against the clones; 1 taken for build only, 4 taken. | Task 11 |
| Then the 〔skills〕 TODO entry closes, recorded on docs/90-agent/reference/todo-completions.md. | struck — land's work, listed under Closes above; no task edits `TODO.md` or `todo-completions.md` |
| Verify's evidence always carries a row for each declared build, test and lint. | Task 10 |
| A project declaring none of the three says so in one line. | Task 10 |
| Every new plan carries `## Risks`, even if it says `none found`. | Task 7 |
| `ledger.js lint` names a plan that lacks it. | Task 7 |
| A project's REVIEW.md "do not report" list silences those findings in every lens. | Task 4 |
| Its Important definition decides severity. | Task 4 |
| A project without one reviews exactly as today. | Task 4 |
