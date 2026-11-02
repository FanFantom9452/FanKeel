---
name: fankeel-retro-all
description: Review every exported session bundle for problems that recur across tasks — this machine's and other users' — and propose skill, agent or stage-rule edits only for what recurs. Use for /fankeel-retro-all, "跑全部 retro", "回顧所有 session", or after importing a retro ZIP another user sent back.
version: 0.149.0
status: current
last_verified: 2026-11-02
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
it as its own section of the month's records file; keep the `#x-<date>` anchor
it prints. Then ask with `AskUserQuestion`: approve the hunks, which go to one
`fankeel:fankeel-fixer` per file; turn the `backlog:` lines into TODO entries
with `todo.js new --state decision`; 匯出 ZIP 回傳; or neither. Nothing is
applied before the answer.

On 匯出 ZIP 回傳, one more `AskUserQuestion` with `multiSelect: true` and
neither box preselected: 記錄全域 Node 套件 adds `--global-packages`;
保留原路徑（不換 [HOME]） adds `--keep-home`. Then run
`node <plugin>/scripts/record.js export --cross <anchor> --bundles <id8,...>`
with the bundles step 1 picked, and give the user its `export:` path and its
last line. Nothing is pushed.

## 5. 收到 ZIP

`node <plugin>/scripts/record.js import <zip>` checks every entry against its
CRC and the manifest's sha256, puts the bundles in `.fankeel/bundles/` (a name
already there is skipped) and the report in `.fankeel/imports/`. Then step 1.
