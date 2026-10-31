---
name: fankeel-weekly
description: The weekly report for the professors — pick a date range and the repositories, collect fankeel's records, session records and git history for it, write what was done as a list the user confirms, then render one self-contained HTML page archived under the config dir. Use for /fankeel-weekly, "週報", "寫這週的週報", or after the station's 週報 page copied the command.
version: 0.145.0
status: current
last_verified: 2026-10-30
source_of_truth: scripts/weekly.js, lib/weekly-collect.js, lib/weekly-render.js, lib/weekly-store.js, lib/weekly-reply.js, lib/session-cost.js
---

# fankeel-weekly

A report for two professors: what was done in a date range, across the
repositories the user picks, as one HTML page that can be mailed on its own.
The script reads and draws; the one thing it cannot do is say, in plain
Traditional Chinese, what each piece of work was and why — that is this
session's part, and the user confirms it before anything is drawn.

`<plugin>` is two directories up from this file; every command below runs
`<plugin>/scripts/weekly.js` and no other copy.

**Scratch files never go in a repository.** `data.json` and `events.json`
live in a new directory under the OS temp dir — `%TEMP%\fankeel-weekly-<until>`
on Windows, `$TMPDIR/fankeel-weekly-<until>` elsewhere. The work they describe
must not be committed into fankeel or any project. The report itself is
archived by `render` under `<configDir>/fankeel/weekly/<until>.json` and
`<until>.html`, where the station's 週報 page lists it.

## 1. Ask — one AskUserQuestion, three questions

    node <plugin>/scripts/weekly.js scan

prints JSON: the default range — the day after the newest archived report,
or last Friday when there is none, through today — and every repository
under the `weekly.roots` profile key with its commit count in that range.
A repository whose git failed is in `failed` (with git's message), not in
`repos`: tell the user, never read it as "no work".

Then one AskUserQuestion holding three questions:

- **區間**: `<since> 到 <until>（預設）`, `近兩週`, and Other for a custom
  `YYYY-MM-DD..YYYY-MM-DD`.
- **Repo**: multiSelect, one option per repository with commits, labelled
  `<name> — <n> 個 commit`, all of them the recommendation. Over four, offer
  the four with the most commits and say in the question that Other takes
  more names.
- **顯示**: multiSelect, `每天的工作量` and `製作成本` — the per-day commit
  grid and the dates on each card, and what producing this report cost, at
  the page's foot; neither is the recommendation — when the work happened is
  not the professors' to see unless the user says so.

A range other than the default: run `scan --since A --until B` with it, and
say which picked repositories have no commit there — they are still
collected, because a fankeel record can exist without a commit.

## 2. Collect

    node <plugin>/scripts/weekly.js collect --since A --until B --repos p1,p2 --out <scratch>/data.json

`p1,p2` are the picked repositories' paths from the scan. Read `data.json`
whole before writing anything: `repos[].records` (fankeel's completion
records, one per finished piece of work), `repos[].sessions` (work still
open, with the files it claimed), `repos[].scopes` (commit groups for a
repository with no records), `repos[].modules.mods` (the architecture
modules and their change size), `previous` (the last report's range and
its `next` list, or `null`), and `facets` (the facet vocabulary, each
`{ name, audience }` — the profile's `weekly.facets`, or six defaults).

## 3. Write events.json, then Gate 1

Write `<scratch>/events.json` — every key below; `labels`, `taglines`,
`times`, `count` and `tech` may be left out:

    {
      "show": { "daily": false, "cost": false },
      "projects": { "<repo>": "…" },
      "taglines": { "<repo>": "…" },
      "summary": [{ "repo": "<repo>", "title": "…", "text": "…" }],
      "events": [{ "title": "…", "repo": "<repo>", "status": "done", "point": "…",
                   "did": "…", "why": "…", "next": "…", "evidence": "…",
                   "times": "10/17 至 10/21", "modules": ["n-src-api"], "count": 2,
                   "facets": ["後端／資料"], "tech": "…" }],
      "architecture": { "<repo>": "…" },
      "labels": { "<repo>": { "n-src-api": "…" } },
      "carry": [{ "repo": "<repo>", "said": "…", "verdict": "done", "now": "…" }],
      "next": [{ "repo": "<repo>", "text": "…" }],
      "questions": [{ "id": "q1", "repo": "<repo>", "text": "…" }]
    }

`<repo>` is always a repository's `name` from `data.json`.

How each field is written:

- **`show`** — `daily` is `true` only when `每天的工作量` was picked, `cost`
  only when `製作成本` was; a missing key is `false`.
- **`projects`** — for each picked repository, one line on what the project
  is, for a reader who has never seen it; it shows in three places, so keep
  it short.
- **`taglines`** — optional: at most 14 characters per repository, printed
  after its name in the header chip.
- **One event per record**; records sharing a title (a weekly 盤點, say)
  become one event with `count` set to how many. A repository with no
  records gives one event per scope group. An open session is one event
  with `status: "ongoing"`; every other event is `"done"`.
- **`point`** — the event's one-sentence conclusion, what it changed for
  the people using it; it sits under the title. May be `""`.
- **`times`** — optional, and only with `show.daily`: the dates the work ran,
  `10/17 至 10/21`. Without it `render` prints no date on any card.
- **`did`, `why`, `next`** — one or two sentences each, Traditional Chinese,
  said the way someone outside the project reads it. An English commit
  subject is retold, never quoted. `title` is the conclusion, not the topic.
- **`facets`** — one or more `name`s from `data.json` `facets`, picked from
  what the card is about; `render` refuses a name outside that list, and a
  card with none.
- **`tech`** — optional: one to three sentences for the 技術 view — the files
  and how it was done. Every rule below still holds for it.
- **No internal words.** session, gate, station, brain, TODO, subagent, a
  dollar amount, an id that looks like a UUID — `render` refuses every one
  of them, and every word in the project's `.fankeel/sensitive.txt`.
- **`modules`** — module **ids** exactly as they appear in that
  repository's `modules.mods[].id` (`n-src-api`), never a name: names
  repeat — every frame has a `其他` — and a name resolves to nothing. Start
  from the record's, session's or scope group's own `modules` list in
  `data.json`, which already holds those ids: for fankeel's work, the
  modules its own session's claimed files fall in; for a git-only
  repository, the modules its scope group's files fall in. The card's chips
  and the architecture diagram's boxes share these ids and colours.
- **`labels`** — optional: per repository, a plain-Chinese name for a
  module id whose directory name means nothing to an outside reader
  (`"n-src-api": "查詢介面"`). It renames the box on the diagram and the
  chip on every card.
- **`architecture`** — per repository, one paragraph on where this
  period's change concentrated and why, read beside its diagram.
- **`evidence`** — the record dates (`紀錄 10-21、10-24`) or the commit range
  (`a1b2c3d..e4f5a6b`).
- **`summary`** — two or three threads of the period, each with its `repo`,
  a one-line `title` and a one-sentence `text`.
- **`carry`** — only when `previous` is not `null`, else `[]`: one item per
  entry of `previous.next`, with that entry's `repo`, `said` its `text`,
  `verdict` `done`, `partial` or `not` judged against this period's events,
  and `now` one sentence on where it stands.
- **`next`** — what is still open and planned for next week, one
  `{ repo, text }` each, from the ongoing events and each event's `next`.
  The next report's `carry` is read from it.
- **`questions`** — what the user wants the professors to answer, `[]` for
  none (no block is drawn). `id` is `q1`, `q2`…, unique. Draft them from the
  period's TODO `## Blocked` and `## Needs a decision` if there are any, but
  write only what the user kept or typed at Gate 1.

**Gate 1.** Show the events as a table — 事、專案、狀態、面向、一句結論 — with
the carry verdicts under it, then the questions one line each (or
「本週沒有要請教的問題」), then AskUserQuestion: 「照這份出頁？」 with
`照這份出頁` and `要改`, the question saying Other takes questions to add. On
`要改`, change exactly what the user said — a card, a facet, a question — show
the table again and ask again. Nothing is drawn before this is answered.

## 4. Render, then Gate 2

    node <plugin>/scripts/weekly.js render --events <scratch>/events.json --data <scratch>/data.json

Exit 1 means the guard hit: each stderr line is `<where>: <word>`, and
nothing was written. Rewrite those fields without the word — or, for
`詞表外：<name>`, with a facet from the list — and run it again; a hit on a
word from `.fankeel/sensitive.txt` is said to the user, since that list is
theirs.

With `show.cost` on, `render` prices the session it runs in: the one this
shell's environment names. The `/fankeel-weekly` prompt shows no session id,
so there is none on screen to copy. Exit 2 saying `pass --session <id>` means
the shell named none: run it again with `--session <id>`, the id from the
`FANKEEL ACTIVE` block or the one the user gives.

Otherwise it prints `wrote: <path>` and `open: <url-or-path>` — the station's
`/station/weekly/<until>.html` when a station is running, which carries the
bar back to the station's list, else the archived file. Open it:
`start "" "<open>"` on Windows, `open` on macOS, `xdg-open` elsewhere.

**Gate 2.** AskUserQuestion 「頁面可以嗎？」 with `可以` and `要改`, Other
naming the block. A change edits `events.json` and runs `render` again; the
same end date overwrites its own archive and keeps the replies saved to it.

## 5. Replies

Opened from the station, each question takes a reply, and 儲存 writes it into
`<until>.json` and redraws that report's questions; the mailed file and a file
opened directly are read-only. To find a question again:

    node <plugin>/scripts/weekly.js questions [--repo R] [--near YYYY-MM-DD] [--grep 詞] [--answered]

One line a question: end date, project, question, reply.

## Not in this skill

No version for the user's own eyes.
Cost appears only at the page's foot, and only when `製作成本` was picked.
The station lists and opens reports and
saves a reply to a question it already has; it writes nothing else.
