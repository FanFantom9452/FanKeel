---
status: current
last_verified: 2026-10-02
source_of_truth: lib/todo.js, scripts/todo.js, scripts/todo-check.js
---

# TODO entries

A deferred thing is one file under the project's `todo` bucket — in this
repository `docs/90-agent/todo/` — and nothing is generated from those files:
there is no `TODO.md` beside them. A project whose `.fankeel/docs.json`
declares no `todo` bucket keeps a hand-written `TODO.md` under the same four
headings; `load()` in `lib/todo.js` reads either and returns the same shapes,
so `orient`, todo-check and the station do not care which.

`fankeel-init` asks a project that already has a `TODO.md` which it wants:
move it into docs (declare the bucket, run `todo.js migrate`) or keep the
hand-written file. Kept, it can be moved in any later day with the same
command.

## The entry file

One file per entry, named `<id>.md`, the id a lowercase kebab slug that is
never reused. Its frontmatter:

| field | what |
|---|---|
| `label` | the area — the word a `TODO.md` bullet opens with in `〔〕`; it groups nothing |
| `title` | at most 28 columns, a CJK character counting two |
| `description` | the one line `orient`, `todo.js list` and the station show; with the label and the link, at most 200 characters |
| `state` | `ready`, `decision`, `blocked`, `watch` or `done` |
| `link` | optional: the detail page, relative to the repository root |
| `group` | `blocked` and `watch` only: the `### <title>` its timing is listed under, at most 28 columns |
| `timing` | `blocked` and `watch` only: `on: MM-DD`, `after: <work>` or `upstream: <release>` for `blocked`; `if: <event>` for `watch` |
| `stamp` | `blocked` and `watch` only: `YYYY-MM-DD`, the day somebody last read the timing and agreed it still holds |
| `done` | a closed entry only: `at`, `sha`, `disposition` — `done`, `measured-no-change` or `abandoned` — and, where known, `session` |

## The body

Every entry that is not `done` carries a body of at least 200 characters, in
three parts, so that a reader weeks later need not go to git for the reason:

1. where it came from — the incident, the session or the sha that raised it;
2. what it should become — the change, in a sentence or two;
3. what counts as done — the check that says it is finished.

A `done` entry needs none. The station's project page opens a row's body
under it on click. A reference page about the system is not where the work's
own detail goes.

## The four states

The state answers one question: what is this still waiting for? Not what it is
about — the label answers that. In a hand-written `TODO.md` each state is a
heading.

| state | heading | waiting for | what `/fankeel` does with it |
|---|---|---|---|
| `ready` | `## Ready` | someone's hands; the entry is the specification | never an option of its own; the patrol builds it |
| `decision` | `## Needs a decision` | a person, to settle what the change should be | the newest few `orient` lists, one option each |
| `blocked` | `## Blocked` | something a session can check: a date, other work, an upstream release | every timing listed; the patrol, always the last option, walks them |
| `watch` | `## Watch` | an event only whoever meets it will know of | every timing listed; the patrol asks keep-or-drop of a stale one |

Entries sharing a `group` and a `timing` are listed under one `### <group>`,
with the timing and the oldest of their stamps as `MM-DD`. A `blocked` timing
with `on:` is due that day; `after:` and `upstream:` are due once the stamp is
seven days old, and the patrol's survey goes and checks them. A `watch` timing
is never due: at sixty days it is stale, and the patrol asks only whether to
keep it — kept, the stamp moves forward. Whoever meets the event an `if:`
names moves the entry to `ready` or `decision` and drops its `group`,
`timing` and `stamp`.

## Opening, listing and closing one

- `node scripts/todo.js new --label <word> --title <title> --description <line> --state <state> --body <text>`,
  with `--link`, and `--group`, `--timing` and `--stamp` for a timed one,
  writes the file. It refuses an entry with no `--body` or one under 200
  characters.
- `node scripts/todo.js list` prints `<state> <id> — <title>` for each open
  entry and the total on its last line; the patrol's count of entries is that
  total.
- `task.js start --todo <id>`, once per entry, links a session to the entries
  it means to close; `orient`'s `todo:` block prints the ids it offers.
- `task.js stage land` prints `todo.js done <id> --sha <sha> --session <id>`
  for each; run it with the sha that landed the work. The entry turns
  `state: done` with a `done:` record, and the file stays.
- `node scripts/todo.js migrate` converts a hand-written `TODO.md` and its
  completions page into entry files, once, into an empty folder: each body is
  the original line and `從 TODO.md 遷移，<date>，<sha>`, and `TODO.md` is
  removed — its text stays in git history. The completions page
  (`todo-completions.md`) is the record in hand-written mode only, and this
  repo's was archived to `docs/99-archive/2026-09-29-todo-completions.md`.

`sha` is the durable link: `.fankeel/sessions/` is per machine and
gitignored, so a `session` id resolves only where it ran. The station's
project page lists done entries newest first, linking the session where this
machine has it and showing the short sha where it does not.

## What todo-check refuses

`node scripts/todo-check.js` reads the folder and fails on: a `TODO.md` at the
root beside a todo folder, which nothing reads; an open entry whose body is
under 200 characters; a committed entry file that is gone; an id that is not a
kebab slug; a state outside the five; a missing title or one over 28 columns;
a missing description; a line over 200 characters; a `blocked` or `watch`
entry with no `stamp`, no `group`, or a timing of the other state's kind; an
`on:` with no `MM-DD`; a `done` entry with no `sha`; a link that does not
resolve or lands on a plan, decision, report or archive. It prints, without
failing, the due and stale timings and the `decision` entries whose file
nobody has committed in seven days. A hand-written `TODO.md` is checked by the
same rules that apply to a line.
