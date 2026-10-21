---
name: fankeel-retro-all
description: Review every exported session bundle for problems that recur across tasks — this machine's and other users' — and propose skill, agent or stage-rule edits only for what recurs. Use for /fankeel-retro-all, "跑全部 retro", "回顧所有 session", or after pulling bundles another user committed.
version: 0.111.58
status: current
last_verified: 2026-10-20
source_of_truth: scripts/record.js, agents/fankeel-retro.md
---

# fankeel-retro-all

**Done when** every bundle the user picked has a retro, filed or fresh, the
recurring problems are ranked with their evidence, the report is filed with
`record.js retro --cross`, and the gate has asked about the edits.

- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script this skill names against that root and nowhere
  else. One exception, and it is a different root rather than a search for
  one: where the registry root's own `package.json` names `fankeel`, the
  scripts to run are the working tree's, because the installed copy lags it
  by a release.
- **A missing script stops this, named.**

## 1. List

`node <plugin>/scripts/record.js sessions --list` prints one row per bundle:
its path, size, `local` or `committed`, and `retro: filed` or `retro: none`.
Ask which to read — all, or a date range — with `AskUserQuestion`.

## 2. Read

A `retro: filed` bundle costs nothing: read its `<details>` block from
the month file under `docs/90-agent/records/`, found by `<summary>retro <id8>`.

A `retro: none` bundle gets one `subagent_type: fankeel:fankeel-retro`,
on the opus its file pins, prompt `session <id8>`, `bundle <path>` and
`<plugin>`. Send at most `dispatch.inflight` in one response (eight by
default), saying how many and on which model. Only the
returns reach this context. Pipe each to
`node <plugin>/scripts/record.js retro --bundle <id8>`: the next list shows `filed`.

## 3. Rank

A problem is **recurring** when two or more bundles carry evidence for it.
Only a recurring problem gets a hunk — five at most, by bundles —
touching `skills/`, `agents/`, `lib/stages.js` or
`CLAUDE.md`. A problem seen once is a `once:` line, no hunk: one session is no evidence. A fix that needs code is a `backlog:`
line.

The report, in this order:

    recurring: <problem> — <k>/<n> bundles — evidence: <id8> turn <t>, <id8> turn <t>
    <unified diff for it>
    once: <problem> — <id8> turn <t>
    backlog: <what code would make it impossible> — <path>

Nothing recurring: just `clean`.

## 4. File, then the gate

Pipe the report to `node <plugin>/scripts/record.js retro --cross`, which files
it as its own section of the month's records file. Then ask with
`AskUserQuestion`: approve the hunks, which go to one
`fankeel:fankeel-fixer` per file; turn the `backlog:` lines into TODO entries
with `todo.js new --state decision`; or neither. Nothing is applied before
the answer.
