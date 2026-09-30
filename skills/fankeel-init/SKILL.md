---
name: fankeel-init
description: First-use onboarding for a project fankeel has not organised — its docs tree, raw data, TODO, directory tree, CLAUDE.md, memory and a sensitive-word list — one question at a time until the onboarding checks pass. Use when `task.js start` prints an `onboard:` line, or for /fankeel-init.
version: 0.87.0
status: current
last_verified: 2026-09-30
source_of_truth: scripts/onboard.js, lib/onboard.js, agents/fankeel-init-scout.md
---

# fankeel-init

Puts a project's documents in a state the stages can read as true. A page
nobody filed, a tree row nobody described and a page nobody re-read are what a
survey reads as the present and repeats as fact.

**Done when** `node <plugin>/scripts/onboard.js --full --root <project>` exits
0. Short of that, the checks that failed are named and left at their step.

- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script against that root and nowhere else.
- **`<project>` is the task's project**, the path the `onboard:` line names —
  never the workspace root above it unless that root is the project.
  `docs.json`, the TODO, the tree and the profile belong to `<project>`;
  `CLAUDE.md` and memory belong to the directory Claude Code was opened in,
  `<open>`. `--project <name>` below is the one `task.js start` was given; with
  none, leave it off.
- **One question at a time**, each an `AskUserQuestion`. A step the scout
  reports `done` is skipped with one sentence saying so. A rerun picks up where
  the last one stopped, because the state is read again, never stored.

## 0. The scout and the first gate

Dispatch one `subagent_type: fankeel:fankeel-init-scout` — its file pins
`sonnet` — with `<project>` and `<open>`, and say how many, and on which model:
one, `fankeel-init-scout`, on `sonnet`.
Its `status:` and `drafts:` are what every step below starts from.

The first gate lists the open steps, and its last option is **先跳過**. Chosen,
ask a second gate that says what skipping costs — every later survey reads the
unfiled pages and the undescribed tree as the present — and recommends
organising first. Only a confirmed second answer runs
`node <plugin>/scripts/task.js profile set init.skip true --project <name>`;
after it, `task.js start` prints no `onboard:` line for this project.

## 1. Visibility and the word list

First, because everything this skill writes is committed afterwards.

- `gh repo view --json visibility` answers `public` or `private`; no remote is
  `local`; no `gh`, or no answer, is `unknown`. Visibility only sets how hard to
  ask: on `public`, recommend a word list and `block`.
- The list is `.fankeel/sensitive.txt`, one word per line. Add `sensitive.txt`
  to `.fankeel/.gitignore` before writing it: the list is itself sensitive, and
  it is per machine — a new machine sets it again.
- Ask for `sensitive.mode` — `warn`, the default, or `block` — and
  `sensitive.review` — `false`, the default, or `true`, recommended on
  `public` — and set each with
  `node <plugin>/scripts/task.js profile set <key> <value> --project <name>`.
- Specs and plans are committed as they always are: the list decides what a
  commit is warned about, not whether a plan lands.

## 2. docs.json, raw data first

- Take the scout's `data` drafts to the user one directory at a time. Each one
  approved becomes a bucket `{ "path": "<dir>", "role": "data" }` — a path and a
  role, nothing more. A `data` bucket is not a document: docs-check and
  docs-audit skip it and it is never counted unfiled.
- No `docs.json`: offer the three shapes, `audience` as option one, and write
  the chosen one with `lib/docs.js`'s `write(root, PRESETS[<shape>])` —
  `node -e "const d=require('<plugin>/lib/docs.js');d.write('<project>',d.PRESETS['<shape>'])"` —
  then add the approved `data` buckets to it.
- Pages already on disk:
  `node <plugin>/scripts/docs-move.js plan --to <shape> --out <project>/.fankeel/build/moves.tsv --root <project>`,
  show the table, and only after approval
  `node <plugin>/scripts/docs-move.js apply --to <shape> --table <project>/.fankeel/build/moves.tsv --root <project>`.
- The scout's `file` drafts settle what is still unfiled: a bucket for its
  directory, or a move.

## 3. TODO

- A `TODO.md` already there: declare a `role: todo` bucket —
  `docs/90-agent/todo` under `audience` — then
  `node <plugin>/scripts/todo.js migrate --root <project>`.
- None: declare the same bucket and create its empty folder.

## 4. The directory tree

`node <plugin>/scripts/layout.js --root <project>` prints the half a listing
can derive. Fill each row with the scout's `tree` draft, show the result as a
diff, and take the user's approval row by row before writing it into the file
`onboard.js` found the tree in — `README.md` where there was none.

## 5. CLAUDE.md

- `node <plugin>/scripts/input-check.js --root <open>` lists every `CLAUDE.md`
  loaded at `<open>` — global, above, at `<open>` and under it — and each
  `MEMORY.md`, with sizes.
- Put the scout's `scope:`, `contradiction:` and `duplicate:` lines to the user
  as diffs: a repository's own rule moves into that repository's `CLAUDE.md`, a
  duplicate loses one side, and a contradiction is the user's to settle. Each
  file is written only after its own approval.
- Cuts for size go to one `subagent_type: fankeel:fankeel-slimmer`, never here.

## 6. Memory

`node <plugin>/scripts/memory-check.js --root <open>`, and name every other
open location under this workspace that keeps a memory of its own. Report only:
nothing is merged, and no entry is written in advance.

## 7. Profile

`node <plugin>/scripts/task.js profile show --project <name>`; the keys no
earlier step settled are asked one at a time, the way `/fankeel` asks them.

## 8. Close

- Drift: `node <plugin>/scripts/docs-audit.js --batches --root <project>` lists
  one batch per bucket. Each batch goes to one `subagent_type:
  fankeel:fankeel-reader`, at most four at once, with its pages and the
  question *which of these no longer describe the code*. A page it names is
  settled only when the user picks one of three: update the page, move its
  `last_verified`, or move it into the archive.
- Then `node <plugin>/scripts/onboard.js --full --root <project>`. Exit 0 is
  done: run `node <plugin>/scripts/task.js profile set init.skip false --project <name>`
  so a later start checks again, and say so. Anything else: name each failing
  line and go back to its step.
