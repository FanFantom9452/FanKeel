---
name: fankeel-retro-all
description: Review every exported session bundle for problems that recur across tasks — this machine's and other users' — and propose skill, agent or stage-rule edits only for what recurs. Use for /fankeel-retro-all, "跑全部 retro", "回顧所有 session", or after pulling bundles another user committed.
version: 0.111.46
status: current
last_verified: 2026-10-20
source_of_truth: scripts/record.js, agents/fankeel-retro.md
---

# fankeel-retro-all

Produces a ranked list of problems that recur across bundles, filed, and at
most five edits for the user to approve.

**Done when** every bundle the user picked has a retro, filed or fresh, the
recurring problems are ranked with their evidence, the report is filed with
`record.js retro --cross`, and the gate has asked about the edits.

- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script against that root. Where the registry root's own
  `package.json` names `fankeel`, run the working tree's scripts.
- **A missing script stops this, named.**

## 1. List

`node <plugin>/scripts/record.js sessions --list` prints one row per bundle:
its path, size, `local` or `committed`, and `retro: filed` or `retro: none`.
Ask the user which to read — all, or a range by date — with `AskUserQuestion`.

## 2. Read

A bundle with `retro: filed` costs nothing: read its `<details>` block from
the month file under `docs/90-agent/records/`, found by `<summary>retro <id8>`.

A bundle with `retro: none` gets one `subagent_type: fankeel:fankeel-retro`,
on the opus its file pins, prompt `session <id8>`, `bundle <path>` and
`<plugin>`. Send at most `dispatch.inflight` in one response (eight by
default), and say how many and on which model in that response. A bundle
never passes through this context whole: only the retros' returns do.

## 3. Rank

A problem is **recurring** when two or more bundles carry evidence for it.
Only a recurring problem gets a hunk — at most five, the most bundles first —
and those hunks may touch `skills/`, `agents/`, `lib/stages.js` or
`CLAUDE.md`. A problem seen once is listed as `once:` with no hunk, because
one session is not evidence for a rule. A fix that needs code is a `backlog:`
line.

The report, in this order:

    recurring: <problem> — <k>/<n> bundles — evidence: <id8> turn <t>, <id8> turn <t>
    <unified diff for it>
    once: <problem> — <id8> turn <t>
    backlog: <what code would make it impossible> — <path>

Nothing recurring: the single line `clean`.

## 4. File, then the gate

Pipe the report to `node <plugin>/scripts/record.js retro --cross`, which files
it as its own section of the month's records file. Then ask with
`AskUserQuestion`: approve the hunks, which go to one
`fankeel:fankeel-fixer` per file; turn the `backlog:` lines into TODO entries
with `todo.js new --state decision`; or neither. Nothing is applied before
the answer.
