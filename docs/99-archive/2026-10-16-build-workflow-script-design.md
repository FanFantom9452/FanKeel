---
status: current
---

# Build workflow written by a script — Design

A stage agent has no `Workflow` tool, so a build stage run by a `fankeel-brain` cannot send a group of three or more disjoint tasks as one Workflow: `scripts/ledger.js groups` downgrades such a group to `agents` (`groupsReport`, `brainBuild`), and the brain sends Agents one round at a time. The TODO entry `docs/90-agent/todo/stage-agents-16.md` asks for a function that writes a plan's `workflow` group as a Workflow script file, and for `scripts/ledger.js` to print its path so the session holding the Workflow tool opens it with `scriptPath`. Its trigger (a stage agent's own context past 400k) was met on 2026-10-16. It is done when a real plan's generated script runs to completion, the function's tests are shown red then green, and the evidence is written back to the entry before `todo.js done`.

Class: architectural. The script is a new surface between the plan and the host's Workflow runtime, and the hand-off adds one line to a brain's report and one line to what `scripts/await.js` prints.

## 1. The script comes from the plan

- `workflowScript(tasks, group, opts)` in `lib/plantasks.js` returns the text of one Workflow script for one group, or `null` when the group holds fewer than three tasks whose Dispatch line is `implementer`.
- Its first line is `export const meta = ` followed by a JSON literal, so the meta object is a pure literal: `name` `fankeel-build-<plan stem>-g<N>`, a one-line `description` naming the plan and the task numbers, and two phases, `Implement` and `Review`.
- Every task becomes one pipeline item that runs implement then review, with no barrier between the two stages; the script returns one `{ n, implementer, review }` per task, in plan order, and an implementer that returned nothing gets no reviewer.
- The implementer goes out as `fankeel:fankeel-implementer` on the model its Dispatch line names, with `effort` only when that line carries a third field; a task with no model on its line is refused by name.
- The reviewer goes out as `fankeel:fankeel-reviewer` on `REVIEWER_MODEL`, the model `agents/fankeel-reviewer.md` pins, with the implementer's effort; its range is pinned by path, `git -C <root> diff HEAD -- <the task's Modify and Test paths>` plus those paths' untracked files, because nothing commits while the run is going.
- The script holds the working tree's absolute root and tells both agents to work under it, so a script written against a second worktree runs there and leaves the main tree alone.
- The script never calls `Date.now`, `Math.random` or an argless `new Date`, and a ranged `Modify:` entry reaches the diff as its bare path.

## 2. The ledger writes it and prints its path

- `node scripts/ledger.js --plan <f> workflow --group <N>` writes each implementer task's brief, writes the script to `.fankeel/build/<plan stem>/workflow-g<N>.js`, and prints that path on its first line.
- It refuses a group that is not `workflow` from its tasks alone (`surfaces`, and a require-edge diagnostic holding it off), a group number outside the plan, and a group sending fewer than three implementers, each in one line with exit 1.
- A brain build does not change what it writes: the profile's `stage.agents` decides what `groups` prints, not whether the script can be written. `groups` keeps printing `agents` under a brain build, so `tests/ledger.test.js:260` does not change.
- The script it writes is `workflowScript`'s output for that group, byte for byte, and each brief it writes is the one `brief <n>` writes.

## 3. A build brain hands the script to its controller

- A build brain whose tasks sit in a `groups` row of three or more runs `ledger.js --plan <f> workflow --group <that row's number>`; a printed path means the row goes as one Workflow and the brain sends no implementer for it, and a refusal line means it sends Agents as before.
- It writes its group report with one line `workflow: <the path it printed>`, the same `label: value` line shape its report already carries for `reads:` and `hands:`, and returns the report path.
- `workflowOf(file)` in `lib/handoff.js` reads that line, the last one in the file, the way `readsOf` reads the last `reads:` block, and `scripts/await.js` prints `workflow <path> — …` for a report that carries it, in place of the handoff line.
- The controller's own block does not grow: `scripts/await.js` prints the whole instruction — open the path with `Workflow({ scriptPath })`, then SendMessage the agent, by id, `Workflow returned:` and the result, exactly — and the controller already does what that line says. The controlled build block measures up to 2352 of 2400 characters on `blockSizes()` and stays where it is.
- A `workflow:` report keeps the brain's in-flight mark, since the brain is still waiting, so the await after the SendMessage reads that group's `build-g<N>.md` and not `build.md`. The mark is re-set through `registry.markInflight` when await hands the script over, and a group mark's `at` is a floor on what await counts as new, so the same report is never handed over twice.
- The brain's brief (`renderBrainBrief` in `lib/render.js`) gains one 147-character line pointing at its agent file, which names the command and says what to do when the result arrives: save each implementer return to `review-<n>.txt`, ask for the commit with no `worktree` line, record each `complete <n>`, rewrite the report without the `workflow:` line, and return its path again. The brain brief stays under `BRIEF_MAX`.

## 4. The build skill and the reference say how it is opened

- Step 4 of `skills/fankeel-build/SKILL.md` names the verb, `Workflow({ scriptPath })`, what the parent does with the returned list, and the brain's hand-off. The paragraph that now ends in a dangling `—` ends in a full stop.
- `docs/90-agent/reference/subagents.md`, under the size threshold, says the script is generated, which file the generator lives in, and how a brain hands it over.

## 5. A real plan's script runs to completion

- The script generated from `docs/90-agent/plans/2026-10-16-todo-patrol-probes.md` group 1, in a detached worktree at `0d1bc90a`, is opened with `scriptPath` and finishes with four entries, none of them null.
- The run's id, its status and the four implementer status lines are written into `docs/90-agent/todo/stage-agents-16.md`'s body, and the entry is closed with `todo.js done`.

## What proves it done

| test | proves |
|---|---|
| the generated script run under stub `agent` and `pipeline` dispatches one implementer and one reviewer per task, with the agent types, models and effort above | `tests/plantasks-workflow.test.js` |
| the meta line parses as JSON and names the two phases | `tests/plantasks-workflow.test.js` |
| `ledger.js workflow --group 1` writes what `workflowScript` returns for that group and refuses a group that is not `workflow` | `tests/ledger-workflow.test.js` |
| `await.js` prints `workflow <path>` for a group report carrying a `workflow:` line | `tests/await.test.js` |
| the brain brief names the `workflow --group` command and the agent file says what follows the result | `tests/brief.test.js` |
| a `workflow:` report keeps the in-flight mark, so the next await reads that group's report | `tests/await.test.js` |
| the build skill's step 4 names `workflow --group` and `scriptPath` | `tests/skills.test.js` |
| a Workflow run over a real plan's group returns four non-null entries | the run id in `docs/90-agent/todo/stage-agents-16.md` |

## Files

| file | change | dispatch |
|---|---|---|
| `lib/plantasks.js` | `workflowScript`, `REVIEWER_MODEL`, `buildRun` | implementer, opus |
| `tests/plantasks-workflow.test.js` | new | implementer, opus |
| `scripts/ledger.js` | `workflow` verb, `writeBrief`, `taskSurfaces` | implementer, opus |
| `tests/ledger-workflow.test.js` | new | implementer, opus |
| `lib/handoff.js` | `workflowOf` | implementer, opus |
| `scripts/await.js` | the `workflow` line; the mark kept | implementer, opus |
| `tests/await.test.js` | one test | implementer, opus |
| `lib/render.js` | the brain brief's `workflow script:` line | implementer, opus |
| `agents/fankeel-brain.md` | the workflow group bullet | implementer, opus |
| `tests/brief.test.js` | one test | implementer, opus |
| `skills/fankeel-build/SKILL.md` | step 4 | implementer, opus |
| `docs/90-agent/reference/subagents.md` | the size threshold | implementer, opus |
| `tests/skills.test.js` | one test | implementer, opus |
| `docs/90-agent/todo/stage-agents-16.md` | the run's evidence | user |
