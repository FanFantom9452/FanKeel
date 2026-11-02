---
name: fankeel-init
description: First-use onboarding for a project fankeel has not organised — its docs tree, raw data, TODO, directory tree, CLAUDE.md, memory and a sensitive-word list — one question at a time until the onboarding checks pass. Use when `task.js start` prints an `onboard:` line, or for /fankeel-init.
version: 0.153.0
status: current
last_verified: 2026-10-15
source_of_truth: scripts/onboard.js, lib/onboard.js, agents/fankeel-init-scout.md, scripts/compact-window.js, hooks/compact.ts
---

# fankeel-init

Puts a project's documents in a state the stages can read as true: an unfiled
page, an undescribed tree row and a page nobody re-read are what a survey reads
as the present and repeats as fact.

**Done when** step 1 has written the habits and step 2 was answered
先不要 or 下次再說, or `node <plugin>/scripts/onboard.js --full --root <project>`
exits 0. Short of that, name the failed checks.

- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script this skill names against that root and nowhere
  else. One exception, and it is a different root rather than a search for
  one: where the registry root's own `package.json` names `fankeel`, the
  scripts to run are the working tree's, because the installed copy lags it
  by a release.
- **`<project>` is the task's project**, the path the `onboard:` line names —
  never the workspace root above it unless that is the project.
  `docs.json`, the TODO, the tree and the profile belong to `<project>`;
  `CLAUDE.md` and memory to the directory Claude Code was opened in, `<open>`. `--project <name>` below is the one `task.js start` was given; with
  none, leave it off.
- **One question at a time**, each an `AskUserQuestion`. A step the scout
  reports `done` is skipped with one sentence. A rerun picks up where
  the last stopped: state is read again, never stored.


## 0. The scout

Dispatch one `subagent_type: fankeel:fankeel-init-scout` (its file pins
`sonnet`) with `<project>` and `<open>`, and say how many and on which model:
one, `fankeel-init-scout`, `sonnet`.
Its `status:` and `drafts:` start every step below. Nothing is
asked before step 1.

## 1. Habits

`node <plugin>/scripts/task.js profile show --project <name>` first. A
`profile.json` already there is read as it is, nothing migrated; only what an
answer below writes changes.

- First, one `AskUserQuestion`, four options in order:
  **建議值** (`balanced`, recommended), **省 context** (`lean`), **每關都問**
  (`manual`), **逐項設定**. Each description says what its preset writes —
  `PRESETS` in `<plugin>/lib/profile.js` — and 建議值's says that
  `land.integration` and `land.push` come from this repository's history
  where `profile suggest` reads one.
- 建議值, 省 context and 每關都問 run one command and are done:
  `node <plugin>/scripts/task.js profile preset <balanced|lean|manual> --project <name>`,
  which writes a value as `profile set` does and clears a `null` as `profile unset`. Show its lines; one ending `(from history)` is a value history chose over the preset's.
- 逐項設定 asks one `AskUserQuestion` per card, in the station wizard's order:
  收尾, 任務大小, 前端, context, 撞檔, 模型, 監控站, 答 gate; an answer runs `node <plugin>/scripts/task.js profile set <key> <value> --project <name>`
  per key it sets and `node <plugin>/scripts/task.js profile unset <key> --project <name>`
  per key it clears.

Then, whichever answer, two keys that carry this repository's evidence:

- `worktree` — `false` (the builtin), `true` (every task opens its own
  checkout), `bounded` (bounded and architectural tasks do) or `architectural`.
- `commit.format` — `node <plugin>/scripts/task.js profile suggest --project <name>`
  prints one when four in five of the last fifty non-merge subjects read
  `type(scope): `, built from the types the log used and no others. Offer it
  as recommended with its evidence line, and say that
  `land.js merge` writes `merge: <task>`, so a pattern without `merge` refuses
  `land.js merge` until the user adds it. Write nothing the user did not pick.

Where the scout drafted `land pr`, and `task.js profile show` does not already
read `land.integration` `pr` with `land.push` `true`, one `AskUserQuestion`:
**推送並開 PR** (recommended) or **照現在的設定**. The first runs
`node <plugin>/scripts/task.js profile set land.integration pr --project <name>` and `node <plugin>/scripts/task.js profile set land.push true --project <name>`;
the second writes nothing. A rerun finding both set does not ask again.

Where the scout drafted `suite` lines, show its `.fankeel/suite.json` draft and
write `<project>/.fankeel/suite.json` only after the user approves it, as approved. For a `nightly` tier, name
`<plugin>/assets/ci/nightly.yml`, a Gitea Actions schedule the user may copy
into `.gitea/workflows/` — fankeel never writes it into a project.

Two more questions belong to the machine, not the profile, asked on their own
after the preset, whatever the scout's `profile` row says:

- The auto-compact window — asked when
  `node <plugin>/scripts/task.js profile show` gives `compact.at` the
  source `builtin`; a row sourced `project` or a machine
  default is not asked again (`balanced`, `lean`: `350000`). First run
  `node <plugin>/scripts/compact-window.js show`: when it prints `set <n>`,
  the descriptions say the machine has a machine-wide
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW` of `<n>` that the next `task.js start` replaces. One `AskUserQuestion`, four options in order:
  `350000`, recommended (the default) — fewest tokens; `1000000` — for
  document work and long files, spends the most, needs a 1M-context model;
  `600000` — loose, more context, more spend; 不設 (`off`) —
  fankeel's mod `hooks/compact.ts` never compacts (the host's auto-compact or a
  machine-wide `CLAUDE_CODE_AUTO_COMPACT_WINDOW` still can); the description
  says it burns tokens heavily. `450000` — a
  little more context, a little more spend — is reachable through **Other**;
  the key takes only these five. The descriptions say it
  only applies in a session that is running a fankeel task —
  `hooks/compact.ts` compacts the main conversation once its context reaches
  that many tokens, in an interactive session with the mod loaded, never
  `claude -p`. It is not written to `settings.json` now;
  `task.js start` syncs `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` to `compact.at`
  each time a task starts, once chosen (what it writes and leaves alone, the
  `compact window: not synced` line and its restart: [profile.md](../../docs/01-guide/profile.md)). The descriptions say
  350000, 600000 and 1000000 are unmeasured; that on Claude Desktop and VS
  Code, Claude Code 2.1.314 compacts an idle 200K+ conversation on its own once
  the prompt cache expires, so 350000 and above only act while the user stays;
  that an account without a 1M window never reaches 350000 and above first; and
  that `/config` → Idle compaction turns the host's one off. No answer turns
  Idle compaction on or off. The answer runs
  `node <plugin>/scripts/task.js profile set compact.at <value> --default`.
  No answer writes nothing; `task.js start` leaves the machine's window alone.

- `/auto-mode-setup` (Claude Code 2.1.304) — teaches auto mode this
  environment from the project and recent sessions. Asked last in step 1 whatever the scout's rows say. One `AskUserQuestion`,
  two options: **現在跑** — the user types `/auto-mode-setup` in this
  session and says when done (no subagent can run a slash command); the description says why: a build's writes under `.fankeel/build/**` rest on an allow rule in
  `.claude/settings.local.json`, and auto mode has still answered `no verdict`
  to them (`docs/90-agent/todo/stage-agents-10.md`); **下次再說** — writes
  nothing. Nothing goes into the profile and the skill never runs the command
  itself; that TODO's re-test records whether it helped.

## 2. The gate

One `AskUserQuestion` after the habits, three options in order:

- **整理** — organise the docs (`docs.json`, TODO, directory tree, `CLAUDE.md`,
  memory, word list): steps 3 to 9 run.
- **先不要** — runs
  `node <plugin>/scripts/task.js profile set init.skip true --project <name>`;
  `task.js start` then prints no `onboard:` line for this project. Its
  description says what skipping costs — every later survey reads the unfiled
  pages and the undescribed tree as the present — and that `/fankeel-init`
  still runs the docs steps on any later day.
- **下次再說** — writes nothing; the `onboard:` line comes back at the next
  `task.js start`.

先不要 and 下次再說 end the skill here, with the habits already written.

## 3. Visibility and the word list

First of the docs half; all it writes is committed afterwards.

Under a controlled survey, steps 3–9 write through a `fankeel:fankeel-implementer`.

- `gh repo view --json visibility` answers `public` or `private`; no remote is
  `local`; no `gh` or no answer is `unknown`. Visibility only sets how hard to
  ask: on `public`, recommend a word list and `block`.
- The list is `.fankeel/sensitive.txt`, a word per line. Add `sensitive.txt`
  to `.fankeel/.gitignore` before writing it: the list is itself sensitive and
  per machine.
- Ask for `sensitive.mode` — `warn`, the default, or `block` — and
  `sensitive.review` — `false`, the default, or `true`, recommended on
  `public` — and set each with
  `node <plugin>/scripts/task.js profile set <key> <value> --project <name>`.
- Specs and plans commit as always; the list only decides what a commit is warned about.

## 4. docs.json, raw data first

- Take the scout's `data` drafts to the user per directory. Each one
  approved becomes a bucket `{ "path": "<dir>", "role": "data" }`, nothing more. A `data` bucket is no document: docs-check and
  docs-audit skip it, never counting it unfiled.
- No `docs.json`: offer the three shapes, `audience` first, and write the chosen one with `lib/docs.js`'s `write(root, PRESETS[<shape>])` —
  `node -e "const d=require('<plugin>/lib/docs.js');d.write('<project>',d.PRESETS['<shape>'])"` —
  then add the approved `data` buckets.
- Pages already on disk:
  `node <plugin>/scripts/docs-move.js plan --to <shape> --out <project>/.fankeel/build/moves.tsv --root <project>`,
  show the table, then after approval
  `node <plugin>/scripts/docs-move.js apply --to <shape> --table <project>/.fankeel/build/moves.tsv --root <project>`.
- The scout's `file` drafts settle what is still unfiled: a bucket or a move.

## 5. TODO

- A `TODO.md` already there: ask one question first, two options.
  **Move it into docs**: declare a `role: todo` bucket — `docs/90-agent/todo`
  under `audience` — run `node <plugin>/scripts/todo.js migrate --root <project>`
  (each line becomes an entry file whose body is that line and a source line;
  `TODO.md` is removed, its text stays in git), then
  `node <plugin>/scripts/todo-check.js --root <project>`. Every open entry it
  names `thin body` gets its body written from that line's history (`git log`
  on the old `TODO.md` finds the commit that brought it in) in three parts: where it came from, what it should become, what counts as done, at
  least 200 characters together. An entry it names `no reason` (text outside the
  migration template and its own description under 200 characters) needs a reason
  written by hand: a `## 為什麼還開著` section naming the
  incident, session or sha and what done looks like. **Keep the hand-written `TODO.md`**: declare
  no bucket; `orient`, todo-check and the station keep reading it, and
  `todo.js migrate` can move it later.
- None: declare the same bucket and create its empty folder.

## 6. The directory tree

`node <plugin>/scripts/layout.js --root <project>` prints the half a listing
can derive. Fill each row from the scout's `tree` draft, show a diff, and write it, after
row-by-row approval, into the file `onboard.js` found the tree in — `README.md` where there was none.

## 7. CLAUDE.md

- `node <plugin>/scripts/input-check.js --root <open>` lists every `CLAUDE.md`
  loaded at `<open>` (global, above, at and under it) and each `MEMORY.md`, with sizes.
- Put the scout's `scope:`, `contradiction:` and `duplicate:` lines as diffs: a repository's rule moves into its `CLAUDE.md`, a duplicate
  loses one side, a contradiction is the user's to settle. Each file waits for its own approval.
- Cuts for size go to one `subagent_type: fankeel:fankeel-slimmer`, never here.

## 8. Memory

`node <plugin>/scripts/memory-check.js --root <open>`, and name every other
open location under this workspace that keeps a memory of its own. Report only:
nothing is merged or written in advance.
A `MEMORY.md` line that carries more than its title, link and a short hook is a slimmer cut, not a step-8 finding: it goes with step 7's dispatch.

## 9. Close

- Residue: the scout's `worktrees` row says whether `.gitignore` holds
  `.claude/worktrees/` and what worktrees and spent `worktree-agent-*`
  branches `residue.js` lists. Name each and ask; nothing is deleted unasked.
- Drift: `node <plugin>/scripts/docs-audit.js --batches --root <project>` lists
  one batch per bucket. Each batch goes to one `subagent_type:
  fankeel:fankeel-reader`, `dispatch.inflight` at once (eight by default), with its pages and the
  question *which of these no longer describe the code*. A page it names is
  settled only when the user picks one: update the page, move its
  `last_verified`, or move it into the archive.
- Then `node <plugin>/scripts/onboard.js --full --root <project>`. Exit 0 is done: run `node <plugin>/scripts/task.js profile set init.skip false --project <name>`
  so a later start checks again, and say so. Anything else: name each failing line and go back to its step.
