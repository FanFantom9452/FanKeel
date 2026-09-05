---
status: current
last_verified: 2026-09-05
source_of_truth: lib/station.js, scripts/station.js, scripts/task.js, hooks/inject.js, hooks/leave.js, lib/registry.js, lib/render.js
---

# The station at hand: written when a task starts, kept where the user is, remembering every registry

**Goal:** the station page is current the moment `/fankeel` is typed and after
every change a task makes to its entry, a copy of it sits in the registry the
user is working in, and it lists every registry this machine has ever run a
task under — not only the ones a session happens to be running in right now.

## The ask

Three things, in the user's words on 2026-09-05, reading the 0.44.0 field
report ([reports/2026-09-05-field-report-0.44.0.md](../reports/2026-09-05-field-report-0.44.0.md)):

1. Sessions are left `active: true` after their terminal is gone, and nothing
   puts them down. **Not changed here** — invariant 2, and the reason a session
   that died at a gate can still be adopted. What changes is that they are
   visible.
2. The station was asked for so that every session's usage could be seen. It
   exists, and it shows usage, cost and agents per session; what it cannot do
   is find the sessions. On 2026-09-05 `discover()` returned 3 registries of at
   least 11.
3. Generate the page when the skill starts, and put the static HTML under
   `.fankeel/` so the user opens it from the tree in front of them, with no
   path to remember.

## What is already here

- `lib/station.js:40` — `discover()` unions four sources: the `root=` field of
  every lead under `modes/`, the `cwd` of every running session walked up, the
  caller's `--root`s, and the caller's `cwd` walked up. No filesystem walk and
  no memory.
- `lib/badge.js:119` — `readLeads()`. A lead is written with the badge and
  **cleared with it**: `hooks/inject.js:114` clears both when the entry is
  stood down, and `scripts/task.js:117` `hideBadge` does the same at `down`,
  `adopt` and `clear`. On 2026-09-05: 118 directories under `modes/`, 5
  readable leads, 2 carrying a root.
- [plans/2026-09-04-session-station-design.md](2026-09-04-session-station-design.md)
  §Rejected declined a registries index because "the lead already exists, is
  already per session, and is already pruned on a rule someone wrote down".
  The lead is pruned on that rule; it is also cleared the moment a task ends,
  which is what makes a stood-down registry invisible. The premise was wrong,
  and this design reverses that one ruling.
- `lib/station.js:263` — `write()` renders once to `<configDir>/fankeel/station.html`
  and returns the path. `hooks/leave.js:48` calls it at `SessionEnd`, and
  `scripts/station.js` on demand; nothing else does.
- `scripts/task.js:83` `showBadge` and `:117` `hideBadge` — the one place every
  entry-changing verb passes through (`start`, `stage`, `task`, `guard`,
  `route`, `adopt`, `down`, `clear`). `note` and `next` do not.
- `hooks/inject.js:61` — `startsFankeel` recognises the `/fankeel` prompt and
  `:83` answers it with `renderInit`, the block that names the session id.
- `scripts/map.js:29` `keepIgnored` — appends `sessions/`, `build/` and
  `map.md` to `.fankeel/.gitignore` without duplicating. `lib/registry.js:196`
  and `lib/docs.js:161` write a fresh `sessions/` only.
- `lib/station.js` measured 2026-09-05: `gather` 180 ms and `render` 3 ms for
  3 registries and 137 entries; 182 KB of HTML.
- `docs/station.md`, `skills/fankeel-station/SKILL.md`, `README.md:130` and
  `tests/station.test.js:99` all state the page's one location and the
  `SessionEnd`-only rewrite. All four become false here and are rewritten.

## The approach

Four pieces, all inside the station's existing seam: `write()` grows, and the
places that already change an entry call it.

### 1. A remembered roots file — `lib/station.js`

`<configDir>/fankeel/roots.json`: an object mapping an absolute registry root,
as `path.resolve` spells it, to the ISO time its `.fankeel/sessions/` was last
seen to exist.

```json
{ "F:/ymlab/fankeel": "2026-09-05T12:40:00.000Z", "F:/ymlab/sec-test": "2026-09-05T12:40:00.000Z" }
```

`discover()` reads it as a fifth source. `write()` rewrites it after every
render: every root that had a `sessions/` directory gets `now`; a root that has
gone keeps its old stamp; a root gone for more than thirty days — the badge
TTL, the one age rule this plugin already has — is dropped. The page lists a
gone root as gone, as it does today, for those thirty days.

A file that cannot be parsed reads as empty and is rewritten whole. It is
written to a sibling and renamed, the way `lib/registry.js:242` writes an
entry, because `task.js`, `inject.js` and `leave.js` can all write it in the
same second.

### 2. A one-off walk — `scripts/station.js --scan <dir>`

Repeatable. Walks `<dir>` for directories holding `.fankeel/sessions/`, at
most six levels down, skipping `node_modules`, `.git` and every dot-directory
except `.fankeel`. Found roots go into `discover()`'s union and therefore into
`roots.json`, so the walk is run once per drive and never again. The eight
registries the field report found by hand are this flag run over `F:/ymlab`
and `F:/MC_Server`.

Not a default and not a hook: a walk over a home directory is minutes, and
`%TEMP%` holds 297,088 test fixtures with a `.fankeel/sessions/` each. The
user names the directory.

### 3. Written on the way in, and beside the user — `write()` and its callers

`write(opts)` takes `root`, the registry the caller is in. It renders once and
writes twice: `<configDir>/fankeel/station.html`, the canonical copy, and
`<root>/.fankeel/station.html`, and appends `station.html` to
`<root>/.fankeel/.gitignore` through `registry.ensureIgnored`, which is
`keepIgnored` lifted out of `scripts/map.js` so there is one copy of the
append. It returns `{ file, copy, registries, live, stale, down }` instead of
a path.

Callers:

| caller | when | `root` |
|---|---|---|
| `hooks/inject.js` | the `/fankeel` prompt, in the branch that already writes the `init` lead | the registry the hook resolved |
| `scripts/task.js` | inside `showBadge` and `hideBadge`, so every verb that changes the badge regenerates the page and `note`/`next` do not | `root` |
| `hooks/leave.js` | as today | `registry.rootFor(payload)` |
| `scripts/station.js` | as today | `findStateRoot(cwd)`, or none |

The copy is written only into the caller's registry. Every other registry's
copy is refreshed when a session runs there, and the canonical copy is always
the newest; the page header already prints when it was generated, so an old
copy says so.

### 4. Told to the session — `lib/render.js`, `scripts/station.js`

`renderInit` takes the counts `write` returned and adds one line after the
session id:

```
station: C:/Users/you/.claude/fankeel/station.html — 11 registries · 2 live, 8 stale, 131 down
```

and `INIT_TEMPLATE` in `lib/stages.js` gains a slot for it, so the `/fankeel`
report can tell the user how many sessions are waiting to be put down and
where to look. `scripts/station.js` prints the same counts after the path it
already prints. That is the half of the `--text` TODO a session needs; `--json`
stays out of scope.

### Data flow

```
task.js verb ─┐
/fankeel ─────┼─▶ station.write({ configDir, root, roots, scan })
SessionEnd ───┤        │
station.js ───┘        ├─ discover: leads ∪ running cwds ∪ roots.json ∪ --root ∪ --scan ∪ cwd
                       ├─ gather → render, once
                       ├─ <configDir>/fankeel/station.html
                       ├─ <root>/.fankeel/station.html  (+ .gitignore line)
                       ├─ roots.json rewritten
                       └─ { file, copy, registries, live, stale, down }
```

### Error handling

- `roots.json` missing or unparseable: empty, then rewritten.
- The copy cannot be written (a read-only checkout): the canonical copy is
  still written and `copy` is `null`. Nothing fails a `task.js` verb over the
  page: the write is inside the same `try` that guards the badge.
- A scan hitting an unreadable directory skips it and keeps going; the walk's
  depth cap is the only ceiling.
- Every hook-side write stays silent on failure, as every hook here does.

### Testing

Each of these fails today:

1. `tests/station.test.js` — `discover` finds a root named only in `roots.json`;
   `write` stamps a present root `now`, keeps a gone root's stamp, drops one
   older than thirty days.
2. `tests/station.test.js` — `write` with `root` puts the same HTML under
   `<root>/.fankeel/station.html`, `.gitignore` gains `station.html` once, and
   the return carries the counts.
3. `tests/station-cli.test.js` — `--scan <dir>` finds a registry two levels
   down and prints the counts beside the path.
4. `tests/task.test.js` — after `start`, both files exist; after `note`, the
   canonical copy's mtime is unchanged.
5. `tests/inject.test.js` — the `/fankeel` prompt writes the page and the
   `additionalContext` carries a `station:` line.
6. `tests/registry.test.js` — `ensureIgnored` appends once and never
   duplicates; `tests/map.test.js` unchanged and green.
7. `tests/leave.test.js` — the copy lands under the ending session's root.

## Rejected

- **A copy in every discovered registry.** A hook in one project writing into
  ten others' trees is a surprise, and each copy would be refreshed from
  whichever session last ran anywhere. One copy where the user is, refreshed
  by their own sessions, and the canonical one for everything.
- **A per-registry page.** The ask is every session; a second page shape is a
  second thing to keep true.
- **Regenerating on every prompt.** 200–500 ms on every prompt for a page
  nobody opens per prompt. The verbs are where state changes.
- **Standing stale entries down automatically.** Invariant 2; the field
  report's eleven are what the station exists to show, not to hide.
- **`--json`.** The count line is what a session needs to say; a session
  wanting the rows has `task.js show --all` for its own registry.

## What deliberately does not change

- Leads: still written and cleared with the badge; TokenBar reads them as
  before. `roots.json` remembers what the lead forgets, and is a different file
  because it has a different lifetime.
- `serve`: still the only way to clear from the page; the static copies carry
  the `task.js clear` command on each `stale` row, as today.
- `active`: still written only by `down`, `clear` and `adopt`.
- `updated`, `burn`, `clock`: `inject.js` keeps writing them every prompt
  without touching the page.
- The six invariants.

## Unverified

Whether `write()` inside `inject.js` stays well under the hook's five-second
timeout once `roots.json` names all eleven registries. Measured at 180 ms for
three registries and 137 entries; the plan's first task re-measures after the
scan, before the hook depends on it.
