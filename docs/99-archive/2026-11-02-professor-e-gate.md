---
status: current
last_verified: 2026-11-02
---

# 教授 11-01 E 組 — 每關都有關卡頁、每關結論提早 commit Implementation Plan

**Goal:** every stage gate has a station gate page with a desktop and a phone link the question box itself carries, and each stage's conclusion is committed the moment the stage changes.
**Architecture:** A stage the session runs itself (not on profile `stage.agents`) writes its report with its `json gate` block to `handoffPath(root, data, stage)` before asking, exactly as a stage agent does, so `lib/gatereport.js` has something to draw; `hooks/gate.js` refuses a stage gate whose report is missing, and `task.js` prints the rule once at stage entry because the per-prompt block has no room under its 2400 cap. `hooks/inject.js` reads `serve.json` and `lib/render.js` adds `gate page:` and `phone:` lines plus the copy-into-option-one rule for an in-session stage. `task.js stage <next>` hands the left stage's report to a new `fileStageReport` in `scripts/record.js`, which masks it with `lib/sensitive.js` and commits that one file with `git commit -o`, never failing the stage change.
**Tech Stack:** Node >= 22.5 (`package.json` `engines`), `node:test`, no dependencies; git via `execFileSync`.
**Spec:** [2026-11-01-professor-ci-tiers-design.md](2026-11-01-professor-ci-tiers-design.md) — §6 and §7; group E of [2026-11-02-professor-index.md](2026-11-02-professor-index.md).

## Global Constraints

Generated from `node scripts/map.js` (`.fankeel/map.md`), `CONTRIBUTING.md` (this repository has no `CLAUDE.md`), `package.json`, and the tests named on each line.

- Node `>=22.5` (`package.json` `engines.node`); no `dependencies` key exists and none may be added (`CONTRIBUTING.md` "Maintenance — … no new dependency").
- `lib/*.js` are pure functions tested directly; nothing in `lib/` requires `scripts/` or `hooks/` (`CONTRIBUTING.md`, Scope table, Core logic row). `scripts/` may require `scripts/` (`scripts/task.js:40` already requires `./compact-window.js`).
- Every hook exits `0` on every path, including its own errors (`CONTRIBUTING.md`, Hooks row); a refusal goes through `refuse()` from `lib/hook.js`, inside a `try` whose `catch` is `/* housekeeping */` (`hooks/gate.js:269-275`).
- Tests are `tests/*.test.js` under `node --test`; a new test file must be `git add`ed before `tests/source.test.js` can see it, and every exported name needs an importer outside `tests/` (`tests/source.test.js:144`, "every exported name is imported by something").
- The injected block of every stage stays under `BLOCK_CAP = 2400` characters at `REFERENCE_ROOT` (`lib/render.js:696`; asserted at `tests/render.test.js:569`, `:781`, `:805`, `:910`). Measured on 2026-11-02 at c8c6656a with `blockSizes()`: default profile survey 2381, design 2206, plan 2358, build 2383, verify 2308, audit 2384, land 2370; this repository's profile (`stage.agents` survey,build,verify) land 2399. **No rule may be added to `ALWAYS`, `ALWAYS_WHEN` or any `STAGES[].rules`.** `LIST_RULE` (`lib/stages.js:681-682`) is the precedent for a rule printed once at stage entry instead.
- `blockSizes()` (`lib/render.js:706-714`) renders with no `serve`; it must keep doing so, so the station lines never enter the measured block.
- Handoff files: `handoffPath(root, data, stage, lap, group)` (`lib/handoff.js:95`) → `<base>/.fankeel/build/task-<YYYYMMDDTHHMMSS>/<stage>[-<lap>].md`, lap counted from `data.moves` (`lib/handoff.js:58-66`), and `registry.stampEntry(d, name)` appends the new move (`scripts/task.js:973`).
- A gate block is a fence opened by three backticks and `json gate` (`lib/gatereport.js:17` `GATE_BLOCK`, `lib/handoff.js` `readGate`). In test code, write the fence as `'`'.repeat(3)` — the existing tests do (`tests/gate.test.js:134`, `tests/gate-patrol.test.js:19`).
- `isGate(mine, questions)` (`hooks/gate.js:244-256`) tells a stage gate from a mid-stage question by option one naming the next stage on the route, or `down`/`收工` at the route's end.
- serve.json: `<configDir>/fankeel/serve.json`, `{ pid, port, url, started }` with `url` ending in `/`, plus `remote: { url: 'https://<dnsName>/' }` when Tailscale answered or `remote: { warning }` when not (`lib/serve.js:5-6`, `:156-165`; written at `scripts/station.js:1356-1360`). `readServeRecord(configDir)` (`lib/serve.js:28`) never throws. `configDirOf()` is `lib/profile.js:162`.
- Desktop gate page `<url>f/<id>/gate` is the form `scripts/await.js:211` already prints; the phone route `/m#/s/<id>/gate` is `assets/station/mobile.js:176` (`PANES` has `gate`) and `:1960`.
- `FANKEEL_SERVE=off` is how tests keep a hook from asking about a station (`tests/inject.test.js:63`).
- Records bucket: `recordsRel(projectRoot)` (`scripts/record.js:126-130`), `docs/90-agent/records` where `docs.json` declares none. Masking: `sensitive.readList(root)` → `{ words, error }` (`lib/sensitive.js:24`), `sensitive.redact(value, words, counts)` → the masked string with `[REDACTED:<kind>]` (`lib/sensitive.js:65`), the pair `record.js session` uses (`scripts/record.js:190-197`). A list that exists and cannot be read stops the write (`scripts/record.js:191`).
- Commit subject `type: what changed` under 60 characters, one bullet per change `- <what changed> — <module>` (`lib/stages.js:218` `COMMIT`).
- Indentation: 4 spaces in `lib/`, `hooks/`, `scripts/` and this plan's new test files; `tests/gate.test.js` and `tests/gate-patrol.test.js` use 2 — follow the file being edited. `'use strict';` heads every file. CJK written directly.
- `READ_CAP` 1500 lines across a task's `Modify:` files, `FILE_CAP` 3 (`lib/plantasks.js:387-388`); `scripts/task.js` is 1841 lines, so it is named by range.
- An implementer runs only its own test command; the parent runs `npm run test:fast` before committing a group (`package.json` `scripts.test:fast`).
- Version numbers move only through `scripts/version.js` (`CONTRIBUTING.md`, Version numbers row) — land's job, not a task's.

## Risks

- Existing tests ask a gate-shaped question with no report on disk; Task 1's refusal breaks them. Prototyped against c8c6656a in a scratch copy: 13 failures — 12 in `tests/gate.test.js` (the six `an uncontrolled stage: …` tests at :785-870, `gate.away ask` at :918, :931, :946, and the controlled ones at :299, :890, :929, which spec §6's "受控與否都一樣" makes refusals) and 1 in `tests/gate-patrol.test.js:91`; Task 1 step 4 gives the edit for each, and runs every test file that spawns `hooks/gate.js`.
- Any new `execFileSync` in `lib/` or `scripts/` must pass `windowsHide: true`, or `tests/windows-hide.test.js:234` fails — the scratch run caught Task 3's git call without it; the plan's code carries it.
- The rule in `gateReportRule` is printed once at stage entry, not every prompt (the cap); after a compaction only `hooks/gate.js`'s refusal still says it — Task 1 makes the refusal message carry the whole instruction.
- With a station serving, an in-session stage's block grows by the two url lines and the rule (about 250 characters), past 2400 for `land` under this repository's profile (2399 today). The cap measures the block with no station (`blockSizes`), as it already leaves out `touched:` and `also in progress:` — Task 2 asserts the measured block is unchanged and does not try to fit the lines under the cap.
- `serve.json` is read, not probed (a prompt hook has no time for one): a station killed hard leaves a record whose links are dead until the next serve rewrites it — Task 2 accepts this; `lib/render.js` `stationLine` makes the same trade.
- A controlled stage's gate is the stage agent's, copied verbatim by the controller (`hooks/gate.js` `gateMatches`), so Task 2 gives no links there; `scripts/await.js` already prints the desktop `page:` line, and the phone link for a stage agent's gate is not covered by this plan — Task 2 checks the controlled stage gets no lines.
- `task.js stage` commits into whatever branch the project root has checked out, mid-build included, and a parallel session in the same checkout may have staged work (memory: parallel sessions share one checkout). `git commit -o -- <rel>` commits only that path and leaves the rest staged — Task 3's first test stages a neighbour's file and asserts it stays staged and out of the commit.
- A copied report may hold relative markdown links that are dead from `<records>/<slug>/`, which `docs-check` would report — not handled here; verify reads `docs-check` after build.
- Task 1 and Task 3 both modify `scripts/task.js`, in disjoint ranges (`:806-819` and `:946-1044`); `ledger.js groups` runs the three tasks one after another, so Task 3 opens a file Task 1 grew by six lines — it finds its anchors by `function cmdStage` and the quoted lines, not by the line numbers alone.

## Task 1: In-session stage gates write their report first

**Files:**
- Modify: `lib/stages.js` — add `GATE_REPORT_RULE` and `gateReportRule(stage, values, file)` after `rulesFor`, export it.
- Modify: `hooks/gate.js` — `reportMissing(file)` and the refusal of a stage gate whose handoff report is missing or has no `json gate` block, controlled or not; the header comment's list of decisions.
- Modify: `scripts/task.js:806-819` — `openingLines` prints `gate report: <rule>` on entering an in-session stage.
- Read: `lib/handoff.js` — `handoffPath`, `baseFor`.
- Test: `tests/gate-report.test.js` (new)
- Test: `tests/gate.test.js` — report fixtures for the gates the refusal now catches.
- Test: `tests/gate-patrol.test.js` — the in-session patrol report gains its gate block.

**Interfaces:**
- Consumes: `handoffPath(root, data, stage)` and `baseFor(root, data)` from `lib/handoff.js` (already imported by `scripts/task.js:43`); `controlling(stage, values)` from `lib/stages.js:736`; `isGate(mine, questions)` and `refuse(message)` inside `hooks/gate.js`.
- Produces: `gateReportRule(stage: string, values: object|undefined, file: string|null) → string|null` exported from `lib/stages.js` — the rule with `file` in place of `{{HANDOFF}}`, or `null` when `file` is falsy or `controlling(stage, values)`. The refusal text begins `fankeel: this gate cannot go out — <file> does not exist` or `— <file> holds no \`json gate\` block`. `task.js start|stage|task` print a line beginning `gate report: Before the gate, Write this stage's report to \`<base-relative path>\``.

**Dispatch:** implementer, opus — the floor for this architectural task.

1. Write the failing test file, then measure what the refusal will break. Create `tests/gate-report.test.js`:

   In `tests/gate-report.test.js`, the whole file:

   ```js
   'use strict';

   // docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §6: a stage the
   // session runs itself writes its report where a stage agent's goes, before
   // its gate, so the station's gate page has something to draw.

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const tmp = require('./tmp.js');
   const { gateReportRule } = require('../lib/stages.js');

   const ROOT = path.join(__dirname, '..');
   const GATE = path.join(ROOT, 'hooks', 'gate.js');
   const TASK = path.join(ROOT, 'scripts', 'task.js');
   const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
   const TICKS = '`'.repeat(3);

   const GATE_Q = [{ question: 'Design -> Plan | fankeel : t　照這個做法？', header: 'Design→Plan', multiSelect: false, options: [
       { label: 'Go to Plan (Recommended)', description: 'a' }, { label: 'Stay in Design', description: 'b' }, { label: '暫停', description: 'c' }] }];

   function seed(agents) {
       const root = tmp('fankeel-gate-report-');
       const dir = path.join(root, '.fankeel', 'sessions');
       fs.mkdirSync(dir, { recursive: true });
       fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify({
           task: 't', stage: 'design', active: true, started: '2026-09-19T09:30:12.345Z', updated: new Date().toISOString(), configDir: tmp('fankeel-cfg-'),
       }) + '\n');
       fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': agents }));
       return root;
   }

   const report = (root) => path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'design.md');

   function ask(root, questions) {
       const out = execFileSync(process.execPath, [GATE], {
           input: JSON.stringify({ session_id: MINE, cwd: root, tool_name: 'AskUserQuestion', tool_input: { questions } }),
           encoding: 'utf8',
           env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
       }).trim();
       return out ? JSON.parse(out) : {};
   }

   test('an in-session gate with no report at the handoff path is denied, naming the path', () => {
       const out = ask(seed('survey'), GATE_Q);
       assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
       assert.match(out.hookSpecificOutput.permissionDecisionReason, /design\.md does not exist/);
       assert.match(out.hookSpecificOutput.permissionDecisionReason, /Write this stage's report there, ending in a `json gate` block/);
   });

   test('a report with no json gate block is denied too: the gate page would still be blank', () => {
       const root = seed('survey');
       fs.mkdirSync(path.dirname(report(root)), { recursive: true });
       fs.writeFileSync(report(root), '# design\n\nthe approach\n');
       const out = ask(root, GATE_Q);
       assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
       assert.match(out.hookSpecificOutput.permissionDecisionReason, /holds no `json gate` block/);
   });

   test('a report ending in its json gate block lets the gate out', () => {
       const root = seed('survey');
       fs.mkdirSync(path.dirname(report(root)), { recursive: true });
       fs.writeFileSync(report(root), '# design\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions: GATE_Q, next: 'n' }) + '\n' + TICKS + '\n');
       assert.equal(ask(root, GATE_Q).hookSpecificOutput, undefined);
   });

   test('a question mid-stage owes no report', () => {
       const mid = JSON.parse(JSON.stringify(GATE_Q));
       mid[0].options[0].label = '用 Map';
       assert.equal(ask(seed('survey'), mid).hookSpecificOutput, undefined);
   });

   test('a controlled stage with no report is denied too, and told to wait for its stage agent', () => {
       const out = ask(seed('survey,design'), GATE_Q);
       assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
       assert.match(out.hookSpecificOutput.permissionDecisionReason, /design\.md does not exist\. Wait for the stage agent to return that path/);
   });

   test('gateReportRule names the path for an in-session stage and nothing for a controlled one', () => {
       const rule = gateReportRule('design', { 'stage.agents': ['survey'] }, '.fankeel/build/task-x/design.md');
       assert.match(rule, /^Before the gate, Write this stage's report to `\.fankeel\/build\/task-x\/design\.md`, ending in a `json gate` block/);
       assert.equal(gateReportRule('design', { 'stage.agents': ['survey', 'design'] }, '.fankeel/build/task-x/design.md'), null);
       assert.equal(gateReportRule('design', { 'stage.agents': [] }, null), null);
   });

   function task(dir, args) {
       const cfg = path.join(dir, 'cfg');
       return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
           { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
   }

   test('task.js stage prints the report rule on entering an in-session stage, and not a controlled one', () => {
       const dir = tmp('fankeel-gate-report-');
       task(dir, ['start', '--session', MINE, '--task', 'x']);
       fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build' }));
       assert.match(task(dir, ['stage', 'design', '--session', MINE]), /^gate report: Before the gate, Write this stage's report to `\.fankeel\/build\/task-\d{8}T\d{6}\/design\.md`/m);
       assert.doesNotMatch(task(dir, ['stage', 'build', '--session', MINE]), /^gate report:/m);
   });
   ```

2. Run it and watch it fail: `node --test tests/gate-report.test.js` — `gateReportRule is not a function`, and every gate case lets the question out.

3. Write the implementation.

   In `lib/stages.js`, directly after the closing `}` of `rulesFor` (line 610) and before `function initRules`, add:

   ```js
   // docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §6. A stage the
   // session runs itself left nothing at its handoff path, so the station's gate
   // page (lib/gatereport.js reads that file) drew nothing and the phone had no
   // report to show. Printed once at stage entry (scripts/task.js openingLines),
   // never in `rules`: every stage's block sits within 50 characters of the 2400
   // cap (tests/render.test.js). hooks/gate.js refuses the gate while the file is
   // missing, which is what still holds after a compaction drops this line.
   const GATE_REPORT_RULE = 'Before the gate, Write this stage\'s report to `{{HANDOFF}}`, ending in a `json gate` block holding the exact questions you then ask; the station\'s gate page reads it, and hooks/gate.js refuses a gate with no report there.';
   function gateReportRule(stage, values, file) {
       if (!file || controlling(stage, values)) return null;
       return GATE_REPORT_RULE.split('{{HANDOFF}}').join(file);
   }
   ```

   In `lib/stages.js`, the last line becomes:

   ```js
   module.exports = { gateReportRule, LIST_RULE, ALWAYS, ALWAYS_WHEN, holds, INIT, INIT_TEMPLATE, initRules, STAGES, NAMES, TOKENS, SCRIPT_TOKENS, RENDER_TOKENS, FULL_ROUTE, CLASSES, byName, nextStage, normaliseRoute, positionIn, routeForClass, classForRoute, rulesFor, templateFor, controlFor, controlling, linked, agentsFor };
   ```

   In `hooks/gate.js`, directly above `function main(raw) {` (line 258), add:

   ```js
   // docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §6: why a stage
   // gate has no report for the station's gate page, or null. lib/gatereport.js
   // draws that page from the handoff file and its last `json gate` block, so a
   // file with no block is as blank there as no file.
   function reportMissing(file) {
       let text;
       try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return file + ' does not exist'; }
       return /`{3}json gate/.test(text) ? null : file + ' holds no `json gate` block';
   }
   ```

   In `hooks/gate.js`, inside `if (!gate) {`, between the patrol `if (owed) { … }` block (ends line 341) and the `// gate-19:` comment (line 342), add:

   ```js
           // §6: the report first, so the station's gate page has what the user
           // is about to be asked — controlled or not. Only on the stage's gate
           // (`isGate`): a question mid-stage owes no report.
           try {
               const why = values && file && isGate(mine, payload.tool_input && payload.tool_input.questions) ? reportMissing(file) : null;
               if (why) {
                   refuse('fankeel: this gate cannot go out — ' + why + '. ' + (controlled
                       ? 'Wait for the stage agent to return that path, then copy its `json gate` block word for word.'
                       : 'Write this stage\'s report there, ending in a `json gate` block holding these questions (the station\'s gate page reads it), then ask again.'));
                   return;
               }
           } catch (e) { /* housekeeping */ }
   ```

   In `hooks/gate.js`, the header comment's lines 14-18, replace `It writes a permission decision in two` … `pointing the controller back at the file.` with:

   ```js
   // session that is not in the mode. It writes a permission decision in three
   // cases only: a stage agent's gate that AskUserQuestion would reject is
   // denied, naming the field; a stage gate whose report is not at its handoff
   // path with a `json gate` block is denied, so the station's gate page is never
   // blank; and a question that looks like an attempted copy
   // of that gate (headed with the stage's name or the file gate's own first header) but does not match it word for
   // word is denied too, pointing the controller back at the file. Otherwise
   ```

   In `scripts/task.js`, in `openingLines` (line 806), directly after `const lines = (controller || rulesLines(data, { values }, { root, sessionId: id })).slice();`, add:

   ```js
       // §6: the report a stage run in this session owes the station's gate
       // page (lib/stages.js gateReportRule), said once here because the
       // per-prompt block has no room for it.
       const report = handoffPath(root, data, data.stage);
       const owed = require('../lib/stages.js').gateReportRule(data.stage, values, report ? posix(path.relative(baseFor(root, data), report)) : null);
       if (owed) lines.push('', 'gate report: ' + owed);
   ```

4. Fix the tests the refusal catches. Run `node --test tests/gate.test.js tests/gate-patrol.test.js tests/gate-askhuman.test.js tests/gate-cjk.test.js tests/gate-write.test.js tests/away-hold.test.js tests/await.test.js tests/handoff.test.js tests/init-entry.test.js tests/notify-gone-hooks.test.js tests/stages.test.js tests/station-answer.test.js tests/station-focus-pending.test.js tests/station-mobile-route.test.js` (every test file that spawns `hooks/gate.js`) and fix every failure as below.

   In `tests/gate.test.js`, directly after the `const agentsAt = …` line (line 783), add:

   ```js
   // §6 (docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md): a stage
   // gate owes its report at the handoff path first.
   function reportFor(root) {
     const { handoffPath } = require('../lib/handoff.js');
     const data = readEntry(root, MINE);
     const file = handoffPath(root, data, data.stage);
     fs.mkdirSync(path.dirname(file), { recursive: true });
     const TICKS = '`'.repeat(3);
     fs.writeFileSync(file, '# report\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions: QUESTIONS, next: 'n' }) + '\n' + TICKS + '\n');
   }
   ```

   In `tests/gate.test.js`, in each of the six tests named `an uncontrolled stage: …` (lines 785-870), add `reportFor(root);` on the line after `agentsAt(root, 'survey');`, and in `an uncontrolled stage: the next stage is matched whatever its case, …` also `reportFor(last);` after `agentsAt(last, 'survey');`.

   In `tests/gate.test.js`, directly after `const parsed = (out) => (out ? JSON.parse(out) : {});` (line 894), add:

   ```js
   const awayAsk = (questions) => {
     const away = awayRun('ask', 250000);
     reportFor(away.root);
     return parsed(away.ask(questions));
   };
   ```

   and in `gate.away ask at 250k returns updatedInput …` replace `parsed(awayRun('ask', 250000).ask(PLAN_Q))` with `awayAsk(PLAN_Q)`; in `gate.away ask leaves a gate of four questions alone, …` replace `parsed(awayRun('ask', 250000).ask(four))` with `awayAsk(four)`; in `gate.away ask skips the question when the station already answered` add `reportFor(root);` after its `profile.json` write.

   In `tests/gate-patrol.test.js`, test `an in-session patrol gate over a report naming every entry goes out` (line 91), its first line becomes:

   ```js
     const { out } = inSession(([first, second]) => '- ' + first.id + ' — do now\n- ' + second.id + ' — keep\n\n'
       + TICKS + 'json gate\n' + JSON.stringify({ questions: QUESTIONS, next: 'plan' }) + '\n' + TICKS + '\n');
   ```

   Three controlled tests in `tests/gate.test.js` asserted that a gate with no file goes out with `gate not confirmed — … does not exist yet`. In `tests/gate.test.js`, directly above `function reportFor(root) {`, add the helper two of them now use:

   ```js
   // A report whose gate block does not parse: on a controlled stage the gate
   // is then not confirmed, said in a message, rather than refused.
   function brokenReport(root) {
     const { handoffPath } = require('../lib/handoff.js');
     const data = readEntry(root, MINE);
     const file = handoffPath(root, data, data.stage);
     fs.mkdirSync(path.dirname(file), { recursive: true });
     const TICKS = '`'.repeat(3);
     fs.writeFileSync(file, '# report\n\n' + TICKS + 'json gate\nnot json\n' + TICKS + '\n');
   }
   ```

   In `tests/gate.test.js`, the test at line 299 becomes:

   ```js
   test('stage.agents at survey with no handoff yet: the gate is refused until the stage agent returns its path', () => {
     const root = tmp('fankeel-gate-');
     seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
     agentsOn(root);
     const out = JSON.parse(run(GATE, root, { tool_input: askOf(QUESTIONS) }));
     assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
     assert.match(out.hookSpecificOutput.permissionDecisionReason, /survey\.md does not exist\. Wait for the stage agent to return that path/);
   });
   ```

   In `tests/gate.test.js`, `a controlled stage: the option count is not this check's to say` (line 890): add `brokenReport(root);` after `agentsAt(root, 'survey,build');`, and its first assertion becomes `` assert.match(out.systemMessage, /^fankeel: gate not confirmed — .*build\.md holds no readable `json gate` block .*\.$/); ``. In `gate.away hint merges into an existing systemMessage without overwriting it` (line 929): add `brokenReport(root);` after its `profile.json` write, and its assertion becomes `` assert.match(out.systemMessage, /^fankeel: gate not confirmed — .*survey\.md holds no readable `json gate` block.* \/compact/); ``.

   Prototyped against c8c6656a: with these edits `tests/gate.test.js` and `tests/gate-report.test.js` pass 77 of 77. Any other failure the step-4 run lists is fixed the same way: write the report the gate now requires (`reportFor`), or, where the test is about a controlled gate's message, a report whose block does not parse (`brokenReport`).

5. Run and watch it pass: `node --test tests/gate-report.test.js tests/gate.test.js tests/gate-patrol.test.js`, then the list in step 4 once more.

6. Commit: `git add tests/gate-report.test.js` first, then commit `lib/stages.js hooks/gate.js scripts/task.js tests/gate-report.test.js tests/gate.test.js tests/gate-patrol.test.js` as `feat: a stage gate needs its report on disk` with bullets `- gateReportRule, printed at stage entry — lib/stages.js, scripts/task.js` and `- refuse a stage gate with no report at its handoff path — hooks/gate.js`.

## Task 2: Gate page and phone links in the injected block

**Files:**
- Modify: `lib/render.js` — `GATE_LINKS_RULE`, `gateLinks(serve, sessionId)`, a `serve` field on `render()`'s argument, and the lines for a stage `stage.agents` does not name.
- Modify: `hooks/inject.js` — read `serve.json` on a task prompt and pass it to `render`.
- Read: `lib/serve.js` — `readServeRecord(configDir)`.
- Read: `lib/profile.js` — `configDirOf()`.
- Test: `tests/gate-links.test.js` (new)

**Interfaces:**
- Consumes: `readServeRecord(configDir) → object|null` (`lib/serve.js:28`); `configDirOf() → string|null` (`lib/profile.js:162`); `controlling(stage, values)` (already imported by `lib/render.js:19`).
- Produces: `gateLinks(serve: object|null, sessionId: string) → string[]` exported from `lib/render.js` — `[]` without a serve record holding an `http://…/` url or without an id; else `gate page: <url>f/<id>/gate`, then `phone: <remote.url>m#/s/<id>/gate` when `remote.url` is `https://<host>/`, then the rule `Option one's description copies the gate page: and phone: lines word for word: the question box is all that shows when it pops up.` `render({ …, serve })` takes it; omitted, nothing changes.

**Dispatch:** implementer, opus — the floor for this architectural task.

1. Write the failing test. Create `tests/gate-links.test.js`:

   In `tests/gate-links.test.js`, the whole file:

   ```js
   'use strict';

   // docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §6: the block a
   // stage run in the session gets names its gate page on this machine and on
   // the phone, and says option one's description copies them.

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const tmp = require('./tmp.js');
   const { render, gateLinks } = require('../lib/render.js');

   const ID = 'aaaaaaaa-0000-4000-8000-000000000001';
   const SERVE = { pid: 1, port: 28888, url: 'http://127.0.0.1:28888/', started: '2026-11-02T00:00:00.000Z', remote: { url: 'https://box.tail1.ts.net/' } };
   const entry = (stage) => ({ sessionId: ID, data: { task: 't', stage, route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], active: true,
       started: '2026-11-02T00:00:00.000Z', updated: '2026-11-02T00:00:00.000Z' } });
   const profileWith = (agents) => ({ values: { 'stage.agents': agents }, sources: {}, unreadable: [] });

   test('gateLinks names the desktop and phone gate pages, then the rule', () => {
       assert.deepEqual(gateLinks(SERVE, ID), [
           'gate page: http://127.0.0.1:28888/f/' + ID + '/gate',
           'phone: https://box.tail1.ts.net/m#/s/' + ID + '/gate',
           "Option one's description copies the gate page: and phone: lines word for word: the question box is all that shows when it pops up.",
       ]);
   });

   test('no tailnet url: the desktop line alone, with the rule', () => {
       const lines = gateLinks(Object.assign({}, SERVE, { remote: { warning: 'tailscale is not running' } }), ID);
       assert.equal(lines.length, 2);
       assert.match(lines[0], /^gate page: http:\/\/127\.0\.0\.1:28888\/f\//);
       assert.doesNotMatch(lines.join('\n'), /^phone:/m);
   });

   test('no station record, or one with no url: no lines at all', () => {
       assert.deepEqual(gateLinks(null, ID), []);
       assert.deepEqual(gateLinks({ pid: 1 }, ID), []);
       assert.deepEqual(gateLinks(SERVE, null), []);
   });

   test('an in-session stage carries the lines; a controlled one, or a render with no serve, does not', () => {
       const own = render({ mine: entry('design'), others: [], now: Date.now(), profile: profileWith(['survey']), serve: SERVE });
       assert.match(own, /^gate page: http:\/\/127\.0\.0\.1:28888\/f\/aaaaaaaa-0000-4000-8000-000000000001\/gate$/m);
       assert.match(own, /^phone: https:\/\/box\.tail1\.ts\.net\/m#\/s\/aaaaaaaa-0000-4000-8000-000000000001\/gate$/m);
       const controlled = render({ mine: entry('survey'), others: [], now: Date.now(), profile: profileWith(['survey']), serve: SERVE });
       assert.doesNotMatch(controlled, /^gate page:/m);
       const none = render({ mine: entry('design'), others: [], now: Date.now(), profile: profileWith(['survey']) });
       assert.doesNotMatch(none, /^gate page:/m, 'blockSizes renders this way, so the capped block does not move');
   });

   test('inject.js reads serve.json from the config dir and puts the lines in the block', () => {
       const root = tmp('fankeel-gate-links-');
       const cfg = tmp('fankeel-gate-links-cfg-');
       fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
       fs.writeFileSync(path.join(root, '.fankeel', 'sessions', ID + '.json'), JSON.stringify(entry('design').data));
       fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
       fs.writeFileSync(path.join(cfg, 'fankeel', 'serve.json'), JSON.stringify(SERVE));
       const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'inject.js')], {
           input: JSON.stringify({ session_id: ID, cwd: root, prompt: 'go on', hook_event_name: 'UserPromptSubmit' }),
           encoding: 'utf8',
           env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg, CLAUDE_PROJECT_DIR: root, FANKEEL_SERVE: '' }),
       });
       const block = JSON.parse(out).hookSpecificOutput.additionalContext;
       assert.match(block, /^gate page: http:\/\/127\.0\.0\.1:28888\/f\/aaaaaaaa-0000-4000-8000-000000000001\/gate$/m);
       assert.match(block, /^phone: https:\/\/box\.tail1\.ts\.net\/m#\/s\/aaaaaaaa-0000-4000-8000-000000000001\/gate$/m);
   });
   ```

2. Run it and watch it fail: `node --test tests/gate-links.test.js` — `gateLinks is not a function`, and the inject block has no `gate page:` line.

3. Write the implementation.

   In `lib/render.js`, replace the line `function render({ mine, others, now, root, launch, transcript, unclaimed, profile }) {` (line 234) with:

   ```js
   // docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §6: where the
   // station draws this session's gate, on this machine and on the phone, for a
   // stage the session runs itself. `serve` is serve.json as hooks/inject.js read
   // it — no probe, a prompt has no time for one — so a record a hard kill left
   // behind still names its urls. The phone line only where serve.json carries
   // the tailnet url `station.js serve` got from lib/tailscale.js. The rule
   // rides these lines rather than the stage rules: it costs nothing while no
   // station serves, and the rules sit at the 2400 cap (tests/render.test.js).
   const GATE_LINKS_RULE = 'Option one\'s description copies the gate page: and phone: lines word for word: the question box is all that shows when it pops up.';
   function gateLinks(serve, sessionId) {
       const s = serve && typeof serve === 'object' ? serve : null;
       if (!s || typeof s.url !== 'string' || !/^http:\/\/[^\s/]+\/$/.test(s.url) || !sessionId) return [];
       const lines = ['gate page: ' + s.url + 'f/' + sessionId + '/gate'];
       const r = s.remote;
       if (r && typeof r.url === 'string' && /^https:\/\/[^/\s]+\/$/.test(r.url)) lines.push('phone: ' + r.url + 'm#/s/' + sessionId + '/gate');
       lines.push(GATE_LINKS_RULE);
       return lines;
   }

   function render({ mine, others, now, root, launch, transcript, unclaimed, profile, serve }) {
   ```

   In `lib/render.js`, in `render`, directly above `for (const line of rulesLines(data, profile, { root, sessionId: mine && mine.sessionId })) lines.push(line);` (line 316), add:

   ```js
       // A controlled stage's gate is its stage agent's, copied verbatim: the
       // links are not the controller's to add, and await.js prints `page:`.
       if (data && !controlling(data.stage, profile && profile.values)) {
           const links = gateLinks(serve, mine && mine.sessionId);
           if (links.length) lines.push('', ...links);
       }
   ```

   In `lib/render.js`, the `module.exports` line (line 860) gains `gateLinks` as its first name:

   ```js
   module.exports = { gateLinks, INPUT_WARN_TOKENS, render, renderInit, renderResume, renderCarry, renderHandoff, renderBrief, rulesLines, controlRulesFor, RETURN_RULES, RETURN_CAP, SCRIPTS, PLUGIN_ROOT, PLUGIN_MARK, newestPlan, planDir, REFERENCE_ROOT, BLOCK_CAP, ANSWERED_MAX, BRIEF_MAX, sizeAtReference, blockSizes };
   ```

   In `hooks/inject.js`, directly above the comment `// Output first, side effects after. A failure while refreshing a timestamp or` (line 275), add:

   ```js
       // §6: the station's serve.json, for the gate page and phone lines. A file
       // read, never a probe; `FANKEEL_SERVE=off` (the tests) reads none.
       let serve = null;
       try {
           const cfgDir = process.env.FANKEEL_SERVE === 'off' ? null : profileLib.configDirOf();
           if (cfgDir) serve = require('../lib/serve.js').readServeRecord(cfgDir);
       } catch (e) { /* housekeeping: no links */ }
   ```

   and in `hooks/inject.js` the `render({ … unclaimed, profile })` call on line 282 becomes `render({ mine: { sessionId, data: mine }, others: alive, now, root, launch, transcript: payload.transcript_path, unclaimed, profile, serve })`.

4. Run and watch it pass: `node --test tests/gate-links.test.js`.

5. Commit: `git add tests/gate-links.test.js` first, then commit `lib/render.js hooks/inject.js tests/gate-links.test.js` as `feat: gate page and phone links in the block` with bullets `- gateLinks and its copy-into-option-one rule — lib/render.js` and `- serve.json read on every task prompt — hooks/inject.js`.

## Task 3: Each stage's conclusion committed at the stage change

**Files:**
- Modify: `scripts/record.js` — `fileStageReport({ projectRoot, report, slug, stage })`, exported.
- Modify: `scripts/task.js:946-1044` — `cmdStage` names the left stage's report before `stampEntry` and files it after the move.
- Read: `lib/sensitive.js` — `readList`, `redact`.
- Read: `lib/handoff.js` — `handoffPath`.
- Read: `lib/docs.js` — `projectRootsFor`.
- Test: `tests/stage-record.test.js` (new)

**Interfaces:**
- Consumes: `sensitive.readList(root) → { words: string[], error: string|null }` and `sensitive.redact(value, words, counts) → masked` (`lib/sensitive.js:24`, `:65`, already required by `scripts/record.js:18`); `recordsRel(projectRoot) → string` (`scripts/record.js:126`); `handoffPath(root, data, stage)`; `docs.projectRootsFor(root, projects) → string[]` (already used at `scripts/task.js:829`). `scripts/task.js` requires `lib/stages.js` (line 38) and `lib/render.js` (line 44) for what it used before this plan; it uses nothing Task 1 or Task 2 adds to them.
- Produces: `fileStageReport({ projectRoot: string, report: string, slug: string, stage: string }) → string|null` exported from `scripts/record.js` — `null` when `report` cannot be read; else one line: `record: <rel> committed`, `record: <rel> written, not committed — <git's first line>.`, or `record: not copied — …`. `<rel>` is `<recordsRel>/<slug>/<basename of report>`. `task.js stage <next>` prints that line under its move line, with `slug` the handoff directory's name (`task-<YYYYMMDDTHHMMSS>`).

**Dispatch:** implementer, opus — the floor for this architectural task.

1. Write the failing test. Create `tests/stage-record.test.js`:

   In `tests/stage-record.test.js`, the whole file:

   ```js
   'use strict';

   // docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §7: at a stage
   // change the stage just left files its report, masked, in the records bucket
   // as <task>/<stage>.md and commits that file alone.

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const tmp = require('./tmp.js');
   const registry = require('../lib/registry.js');
   const { handoffPath } = require('../lib/handoff.js');
   const { fileStageReport } = require('../scripts/record.js');

   const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
   const A = 'aaaaaaaa-1111-2222-3333-444444444444';
   const TICKS = '`'.repeat(3);
   const REPORT = '一句話：做法\n\nsecret-host-01 在這裡\n\n' + TICKS + 'json gate\n{"questions":[],"next":"n"}\n' + TICKS + '\n';

   const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

   function repo() {
       const dir = tmp('fankeel-stage-record-');
       git(dir, 'init', '-q');
       git(dir, 'config', 'user.email', 't@example.com');
       git(dir, 'config', 'user.name', 't');
       fs.writeFileSync(path.join(dir, 'README.md'), '# r\n');
       git(dir, 'add', 'README.md');
       git(dir, 'commit', '-q', '-m', 'init');
       return dir;
   }

   function task(dir, args) {
       const cfg = path.join(dir, 'cfg');
       return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
           { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
   }

   function designReport(dir) {
       const file = handoffPath(dir, registry.readSession(dir, A), 'design');
       fs.mkdirSync(path.dirname(file), { recursive: true });
       fs.writeFileSync(file, REPORT);
       return file;
   }

   test('stage <next> commits the report the stage left, masked, and only that file', () => {
       const dir = repo();
       fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
       fs.writeFileSync(path.join(dir, '.fankeel', 'sensitive.txt'), 'secret-host-01\n');
       task(dir, ['start', '--session', A, '--task', 'x']);
       task(dir, ['stage', 'design', '--session', A]);
       const report = designReport(dir);
       fs.writeFileSync(path.join(dir, 'staged.txt'), 'someone else\'s\n');
       git(dir, 'add', 'staged.txt');
       const out = task(dir, ['stage', 'plan', '--session', A]);
       const rel = 'docs/90-agent/records/' + path.basename(path.dirname(report)) + '/design.md';
       assert.match(out, new RegExp('^record: ' + rel.replace(/[.]/g, '\\.') + ' committed$', 'm'));
       assert.deepEqual(git(dir, 'show', '--name-only', '--format=', 'HEAD').split('\n'), [rel]);
       assert.match(git(dir, 'log', '-1', '--format=%s'), /^docs: task-\d{8}T\d{6} design conclusion$/);
       const filed = fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
       assert.doesNotMatch(filed, /secret-host-01/);
       assert.match(filed, /\[REDACTED:word\]/);
       assert.match(git(dir, 'diff', '--cached', '--name-only'), /^staged\.txt$/m, 'what was staged stays staged');
       assert.equal(registry.readSession(dir, A).stage, 'plan');
   });

   test('no git repository: the stage still changes and the line says it was not committed', () => {
       const dir = tmp('fankeel-stage-record-');
       task(dir, ['start', '--session', A, '--task', 'x']);
       task(dir, ['stage', 'design', '--session', A]);
       designReport(dir);
       const out = task(dir, ['stage', 'plan', '--session', A]);
       assert.match(out, /^record: docs\/90-agent\/records\/task-\d{8}T\d{6}\/design\.md written, not committed — /m);
       assert.equal(registry.readSession(dir, A).stage, 'plan');
   });

   test('a stage that left no report files nothing and says nothing', () => {
       const dir = repo();
       task(dir, ['start', '--session', A, '--task', 'x']);
       task(dir, ['stage', 'design', '--session', A]);
       const out = task(dir, ['stage', 'plan', '--session', A]);
       assert.doesNotMatch(out, /^record:/m);
       assert.equal(fs.existsSync(path.join(dir, 'docs', '90-agent', 'records')), false);
   });

   test('a sensitive list that cannot be read stops the copy, so nothing unmasked lands', () => {
       const dir = tmp('fankeel-stage-record-');
       fs.mkdirSync(path.join(dir, '.fankeel', 'sensitive.txt'), { recursive: true });
       const report = path.join(dir, 'design.md');
       fs.writeFileSync(report, REPORT);
       const line = fileStageReport({ projectRoot: dir, report, slug: 'task-20261102T000000', stage: 'design' });
       assert.match(line, /^record: not copied — \.fankeel\/sensitive\.txt could not be read/);
       assert.equal(fs.existsSync(path.join(dir, 'docs')), false);
   });
   ```

2. Run it and watch it fail: `node --test tests/stage-record.test.js` — `fileStageReport is not a function`, and `stage plan` prints no `record:` line.

3. Write the implementation.

   In `scripts/record.js`, after `const { parseArgs: parseArgv } = require('node:util');` (line 11), add:

   ```js
   const { execFileSync } = require('node:child_process');
   ```

   In `scripts/record.js`, directly above `function main(argv) {` (line 313), add:

   ```js
   // docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md §7, after the
   // 2026-11-01 shared-session-state judgement (option A): the state of a stage in
   // progress stays on this machine, but its conclusion goes into version control
   // at the stage change rather than at land. `report` is the handoff file the
   // stage left; it is copied, masked the way a session bundle is, to
   // `<records>/<slug>/<its name>` and committed alone with `git commit -o`, so
   // whatever else is staged stays staged. Never throws: a stage change must not
   // fail over a record. Returns the line `task.js stage` prints, or null when
   // the stage left no report.
   function fileStageReport({ projectRoot, report, slug, stage }) {
       let text;
       try { text = fs.readFileSync(report, 'utf8'); } catch (e) { return null; }
       const list = sensitive.readList(projectRoot);
       if (list.error) return 'record: not copied — .fankeel/sensitive.txt could not be read (' + list.error + '), so nothing could be masked against it.';
       const rel = recordsRel(projectRoot) + '/' + slug + '/' + path.basename(report);
       try {
           const file = path.join(projectRoot, ...rel.split('/'));
           fs.mkdirSync(path.dirname(file), { recursive: true });
           fs.writeFileSync(file, sensitive.redact(text, list.words, {}));
       } catch (e) {
           return 'record: not copied — ' + ((e && e.code) || 'write failed') + '.';
       }
       const git = (args) => execFileSync('git', ['-C', projectRoot, ...args], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 15000, windowsHide: true });
       try {
           git(['add', '--', rel]);
           git(['commit', '-o', '-m', 'docs: ' + slug + ' ' + stage + ' conclusion\n\n- ' + stage + '\'s report, masked — ' + rel, '--', rel]);
           return 'record: ' + rel + ' committed';
       } catch (e) {
           const why = String((e && (e.stderr || e.message)) || e).trim().split(/\r?\n/)[0];
           return 'record: ' + rel + ' written, not committed — ' + (why || 'git failed') + '.';
       }
   }
   ```

   In `scripts/record.js`, the last line becomes:

   ```js
   module.exports = { parse, problems, appendUnder, fileStageReport };
   ```

   In `scripts/task.js`, in `cmdStage`, after `let route = null;` (line 949), add `let leaving = null;`, and directly above `registry.stampEntry(d, name);` (line 973) add:

   ```js
           // The report the stage being left wrote, named before the stamp:
           // its lap is counted from `moves`, which the stamp extends.
           if (d.stage && d.stage !== name) leaving = handoffPath(root, d, d.stage);
   ```

   In `scripts/task.js`, in `cmdStage`, directly above `line += NL + effortHint(data.class || classForRoute(route), name);` (line 1036), add:

   ```js
       // §7: the stage just left files its conclusion in the records bucket and
       // commits it alone (scripts/record.js fileStageReport). Said, never
       // blocking: no git, no repo, a hook that refuses — the stage still changes.
       if (leaving) {
           try {
               const projectRoot = docs.projectRootsFor(root, data.project ? [data.project] : [])[0] || root;
               const filed = require('./record.js').fileStageReport({ projectRoot, report: leaving, slug: path.basename(path.dirname(leaving)), stage: from });
               if (filed) line += NL + filed;
           } catch (e) { /* housekeeping: the stage has changed */ }
       }
   ```

4. Run and watch it pass: `node --test tests/stage-record.test.js`, then `node --test tests/task.test.js tests/record.test.js` for the files whose behaviour this touches.

5. Commit: `git add tests/stage-record.test.js` first, then commit `scripts/record.js scripts/task.js tests/stage-record.test.js` as `feat: commit each stage's report at the stage change` with bullets `- fileStageReport: mask, copy, git commit -o — scripts/record.js` and `- stage <next> files the left stage's report — scripts/task.js`.

## Coverage

| promise | task |
|---|---|
| `lib/stages.js`：不在 `stage.agents` 的階段，規則要求問關卡前把報告（含 `json gate` 區塊）寫到 `handoffPath`，與 stage agent 同一格式。 | Task 1 — `gateReportRule`, printed at stage entry by `openingLines`; not in the per-prompt rules, which sit at the 2400 cap |
| `hooks/gate.js`：受控與否都一樣，沒有 handoff 檔的關卡拒絕。 | Task 1 — `reportMissing`, refused for an in-session and a controlled stage gate alike |
| 注入區塊給出兩個網址：電腦 `http://127.0.0.1:<port>/f/<id>/gate`、手機 `https://<tailnet>/m#/s/<id>/gate`（`lib/tailscale.js` 已知 dnsName）；選項一的說明照抄，因為那是問題框裡唯一看得到的地方。 | Task 2 — `gateLinks`, from serve.json's `url` and the tailnet `remote.url` `station.js serve` got from `lib/tailscale.js`; in-session stages only (see Risks) |
| §7 依判官 2026-11-01-shared-session-state（選 A）：`task.js stage` 換站時，把上一站的 handoff 報告遮罩 sensitive.txt 後複製進 records bucket 的 `<task>/<stage>.md`，單獨 commit | Task 3 — `fileStageReport`, called from `cmdStage` |
| §7 集中歸檔另記為 TODO「session 與 build 集中歸檔」（c8c6656a），不在此。 | struck — out of scope by the spec's own words |
