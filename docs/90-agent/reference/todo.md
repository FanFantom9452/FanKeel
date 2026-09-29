---
status: current
last_verified: 2026-09-29
source_of_truth: lib/todo.js, scripts/todo.js, scripts/todo-check.js, TODO.md
---

# TODO entries

A deferred thing is one file under the project's `todo` bucket — in this
repository `docs/90-agent/todo/` — and `TODO.md` is generated from those
files by `node scripts/todo.js index`. A project whose `.fankeel/docs.json`
declares no `todo` bucket keeps a hand-written `TODO.md` under the same four
headings; `load()` in `lib/todo.js` reads either and returns the same shapes,
so `orient`, todo-check and the station do not care which.

## The entry file

One file per entry, named `<id>.md`, the id a lowercase kebab slug that is
never reused. Its frontmatter:

| field | what |
|---|---|
| `label` | the area — the word a `TODO.md` bullet used to open with in `〔〕`; it groups nothing |
| `title` | at most 28 columns, a CJK character counting two |
| `description` | the line `TODO.md` prints; with the label and the link, at most 200 characters |
| `state` | `ready`, `decision`, `blocked`, `watch` or `done` |
| `link` | optional: the detail page, relative to the repository root |
| `group` | `blocked` and `watch` only: the `### <title>` the index groups it under, at most 28 columns |
| `timing` | `blocked` and `watch` only: `on: MM-DD`, `after: <work>` or `upstream: <release>` for `blocked`; `if: <event>` for `watch` |
| `stamp` | `blocked` and `watch` only: `YYYY-MM-DD`, the day somebody last read the timing and agreed it still holds |
| `done` | a closed entry only: `at`, `sha`, `disposition` — `done`, `measured-no-change` or `abandoned` — and, where known, `session` |

The body is free markdown: the background, what was tried, what it waits on.
A reference page about the system is not where the work's own detail goes.

## The four headings

The state is the heading `TODO.md` files the entry under, and it answers one
question: what is this still waiting for? Not what it is about — the label
answers that.

| state | heading | waiting for | what `/fankeel` does with it |
|---|---|---|---|
| `ready` | `## Ready` | someone's hands; the entry is the specification | the whole section is offered as one task |
| `decision` | `## Needs a decision` | a person, to settle what the change should be | the newest few `orient` lists, one option each |
| `blocked` | `## Blocked` | something a session can check: a date, other work, an upstream release | every timing listed; the patrol, always the last option, walks them |
| `watch` | `## Watch` | an event only whoever meets it will know of | every timing listed; the patrol asks keep-or-drop of a stale one |

Entries sharing a `group` and a `timing` print under one `### <group>`, whose
next line is the timing and the oldest of their stamps as `MM-DD`. A
`blocked` timing with `on:` is due that day; `after:` and `upstream:` are due
once the stamp is seven days old, and the patrol's survey goes and checks
them. A `watch` timing is never due: at sixty days it is stale, and the
patrol asks only whether to keep it — kept, the stamp moves forward. Whoever
meets the event an `if:` names moves the entry to `ready` or `decision` and
drops its `group`, `timing` and `stamp`.

## Opening and closing one

- `node scripts/todo.js new --label <word> --title <title> --description <line> --state <state>`,
  with `--link`, and `--group`, `--timing` and `--stamp` for a timed one,
  writes the file and regenerates `TODO.md`.
- `task.js start --todo <id>`, once per entry, links a session to the entries
  it means to close; `orient`'s `todo:` block prints the ids it offers.
- `task.js stage land` prints `todo.js done <id> --sha <sha> --session <id>`
  for each; run it with the sha that landed the work. The entry turns
  `state: done` with a `done:` record, `TODO.md` is regenerated without it,
  and the file stays.
- `node scripts/todo.js migrate` converts a hand-written `TODO.md` and its
  completions page into entry files, once.

`sha` is the durable link: `.fankeel/sessions/` is per machine and
gitignored, so a `session` id resolves only where it ran. The station's
project page lists done entries newest first, linking the session where this
machine has it and showing the short sha where it does not.

## What todo-check refuses

`node scripts/todo-check.js` reads the folder and fails on: a `TODO.md` that
differs from what `index` writes; a committed entry file that is gone; an id
that is not a kebab slug; a state outside the five; a missing title or one
over 28 columns; a missing description; a printed line over 200 characters; a
`blocked` or `watch` entry with no `stamp`, no `group`, or a timing of the
other state's kind; an `on:` with no `MM-DD`; a `done` entry with no `sha`; a
link that does not resolve or lands on a plan, decision, report or archive.
It prints, without failing, the due and stale timings and the `decision`
entries whose file nobody has committed in seven days.
