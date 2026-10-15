---
status: current
date: 2026-10-15
task: 快速設定重新設計
---

# init quick setup — habits first, then a gate, then docs

fankeel-init becomes the one entry for setting up a project, asked in chat with
AskUserQuestion: development habits first, written through one preset command;
then one gate asking whether to reorganise the docs; the docs steps only on yes.
The station wizard stays as the place to adjust afterwards, its values aligned
with the same `PRESETS`.

## 1. Habits first

- fankeel-init's first step after the scout is the habits step (today's step 7,
  moved up); the sensitive word list stays with the docs half.
- Its first question has four options: 建議值 (`balanced`, recommended), 省 context
  (`lean`), 每關都問 (`manual`), 逐項設定. The first three run one command and
  are done; 逐項 asks one card at a time in the station wizard's order.
- `compact.at` is still asked on its own after the preset, because it writes the
  machine-wide window; worktree and `commit.format` stay where step 7 has them.

## 2. One command applies a preset

- `task.js profile preset <manual|balanced|lean> [--project <dir>|--default]`
  writes `PRESETS[name].set` the way the station's wizApply does: a value as
  `profile set`, `null` as `unset`.
- For `balanced`, a `land.integration` or `land.push` that `profile suggest` reads
  off this repository's history replaces the preset's value, and the output says
  which came from history.

## 3. The gate between the halves

- After habits, one AskUserQuestion: 整理 docs (docs.json, TODO, tree, CLAUDE.md,
  memory, word list) / 先不要 — writes `init.skip true`, so `task.js start` stops
  printing `onboard:` / 下次再說 — writes nothing, `onboard:` comes back next start.

## 4. One set of presets

- The station wizard's 省 context option writes `stage.agents: all`, as
  `PRESETS.lean` does (the user's 2026-10-02 ruling); `survey,build,verify` keeps
  its 交三站 label. Existing profile.json files are read as they are.

## Proves it done

- `task.js profile preset balanced --project <tmp>` on a repo whose history
  says `pr` writes `land.integration: pr` and `stage.agents: survey,build,verify`
  — fails now (no such verb).
- tests/init-skill.test.js: the habits heading comes before the docs.json
  heading, and the gate's three answers are named — fails now.
- The wizard's 省 context option and `PRESETS.lean` carry the same
  `stage.agents` — fails now (`survey,build,verify` vs `all`).
