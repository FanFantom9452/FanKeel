---
status: current
date: 2026-09-29
task: TODO 改成一筆一檔的任務系統：TODO.md 由單筆檔產生，station 看得到完成條目與其 session
---

# TODO as one file per entry

Each TODO entry becomes a file under `docs/90-agent/todo/`, with its label,
title, description and state in frontmatter and its background in the body.
`TODO.md` stays, generated from those files, so every reader of it keeps
working. A closed entry is not deleted: it turns `state: done` and records the
commit that closed it, plus the session that did it where one is known. The
station's project page lists a project's open and done entries.

Decided at survey's gate (2026-09-29): one file per entry; done entries in the
same folder; the station shows them per project. Decided at design: a project
with no entry folder keeps its hand-written `TODO.md` under today's rules.

Mockup: `.fankeel/build/2026-09-29-todo-files/mockup.html`, blocks
`todo-head`, `todo-open`, `todo-done` — approved as 方向 (2026-09-29): the
render reviewer holds build to it; no block-by-block tuning on the live page.

## Why

- A closed entry disappears today. Its only trace is one record on
  `docs/90-agent/reference/todo-completions.md` and `git log`, with no link to
  the session that did the work, so the station cannot show history.
- The detail behind a bullet lives on a reference page about the system
  (`station.md`, `collisions.md`), not on a page about the work. The work's
  own background, what was tried, and what it waits on have nowhere to go.

## 1. The entry file

- One file per entry: `docs/90-agent/todo/<id>.md`, `<id>` a lowercase kebab
  slug, unique in the folder, never reused.
- Frontmatter fields: `label` (the word that used to sit in `〔〕`),
  `title` (at most 28 columns, a CJK character counting two), `description`
  (at most 200 characters, the line the index prints), `state` (`ready`,
  `decision`, `blocked`, `watch` or `done`), and `link` (optional, a detail
  page elsewhere in the repository).
- `blocked` and `watch` entries also carry `timing` (one of `on: MM-DD`,
  `after: <work>`, `upstream: <release>` for `blocked`; `if: <event>` for
  `watch`) and `stamp` (`YYYY-MM-DD`, the day someone last agreed it holds).
  Entries that shared one `### <timing>` today each carry the same `timing`
  value; the index groups them back under one heading.
- A `done` entry carries `done: {at, sha, disposition, session?}`.
  `disposition` is today's completions vocabulary. `session` is optional,
  because `.fankeel/sessions/` is gitignored and per machine: `sha` is the
  durable link, and the session id only resolves on the machine that ran it.
- The body is free markdown: background, what was tried, what it waits on.
- `.fankeel/docs.json` gets a bucket `{ "path": "docs/90-agent/todo",
  "role": "todo", "audience": "agent" }`. Role `todo` is new in `lib/docs.js`:
  links and `path:line` are checked, as for `fixture`; symbols and
  `last_verified` are not, because `stamp` is the entry's date and todo-check
  reads it.

## 2. The index and the writer

- New `scripts/todo.js`, the only writer of entry files:
  - `index` regenerates `TODO.md`: a fixed preamble naming the folder and
    `todo.js`, then `## Ready`, `## Needs a decision`, `## Blocked`,
    `## Watch` from `state`, with timings as `### <title>` groups. Done
    entries are not listed.
  - `new --label --title --description --state [...]` writes a file and
    regenerates the index.
  - `done <id> --sha <sha> [--session <id>] [--disposition done]` closes an
    entry and regenerates the index.
  - `migrate` converts a hand-written `TODO.md` and
    `todo-completions.md` into entry files, once, and regenerates the index.
- `todo-check` fails when `TODO.md` differs from what `todo.js index` would
  write: the index is generated, and a hand edit to it is drift.

## 3. The readers, in two modes

- `todo-check`'s `entries()` and `timings()` (`scripts/todo-check.js:294`)
  read the entry folder when the project's `docs.json` declares a `todo`
  bucket and it exists, and `TODO.md` exactly as today otherwise. Both modes
  return the same shapes, so `scripts/orient.js:510 todoBlock` and the `INIT`
  rule in `lib/stages.js` do not change what they compute.
- The rules carry over into frontmatter checks: the 200-character
  description, the 28-column title, a `timing` that matches `state`, a stamp
  on every `blocked`/`watch` entry, links that resolve and do not land on a
  plan, decision, report or archive, due at 7 days and stale at 60.
- In folder mode an entry file is never deleted. todo-check refuses a
  deleted entry file the way it refuses an unrecorded deletion today.
- `lib/blame.js` orders "newest by last edit" by each file's last commit
  date in folder mode, and by line blame in `TODO.md` mode.
- `lib/plantasks.js:215 INDEX_FILES` keeps `TODO.md` exempt from the file
  conflict check; entry files are ordinary files.

## 4. Linking a session to an entry

- `task.js start --todo <id>` (repeatable) writes `todo: [<id>, ...]` on the
  session's registry entry. `/fankeel` passes it when the option picked was a
  single entry; `## Ready` taken whole passes every ready id.
- At `land`, each id on the entry that the work finished is closed with
  `todo.js done <id> --sha <landed sha> --session <this session>`. The `land`
  rule text in `lib/stages.js` names that command in folder mode.

## 5. The station

- `serialize()` (`lib/station.js`) adds per project `todos: { open, done }`,
  read through todo-check's `entries()` so both modes feed it. A project in
  `TODO.md` mode has `open` only.
- `projectPage()` (`assets/station/station.js:2761`) gets a TODO panel: open
  entries grouped by state; done entries newest first, each linking to its
  session page when this machine's registry has that session and showing
  the short sha otherwise.
- `POST /todo` (`scripts/station.js:511`) writes an entry file through
  `todo.js new` in folder mode and appends a line as today otherwise.

## 6. This repository's migration

- Run `todo.js migrate` here: the open entries and the 69 records on
  `todo-completions.md` become entry files; `todo-completions.md` moves to
  `docs/99-archive/`.
- The contract in `TODO.md`'s preamble moves to a reference page,
  `docs/90-agent/reference/todo.md`; the generated preamble points at it.
- Pages this makes false are updated in the same work:
  `docs/01-guide/development.md:74`, the `POST /todo` section of
  `docs/90-agent/reference/station.md`, and the TODO table in
  `skills/fankeel/SKILL.md`.

## Proves it done

- A new `tests/todo-files.test.js`, failing today because `scripts/todo.js`
  does not exist: on a fixture folder, `entries()` returns the same shape as
  on the equivalent `TODO.md`; `todo.js index` reproduces the committed
  `TODO.md` byte for byte; `todo.js done` moves an entry out of the index and
  into `todos.done` with its `sha` and `session`.
- On the rendered station, the project page's open count equals the number
  of non-`done` files in the folder, and its done count equals the `done`
  files.
- The existing `tests/todo-check.test.js` and `tests/station-todo.test.js`
  stay green in `TODO.md` mode.

## Not verified

Whether Trovara's `TODO.md` parses cleanly through `todo.js migrate`: only
this repository's was read.
