---
status: superseded-by docs/plans/2026-08-24-observed-scope-design.md
last_verified: 2026-08-23
source_of_truth: lib/registry.js, lib/render.js, scripts/task.js, hooks/touch.js
---

# The registry goes stale, and nothing is watching

The registry describes a world: which sessions are live, and which files each one
has claimed. It is written when somebody says so, and from then on the world is
free to move without it. Two ways it does, with opposite symptoms and one cause.

**The work moves and the claim does not**, so a warning that should fire stays
silent. **The session dies and the claim does not**, so a warning that should stop
keeps firing. Neither is noticed by anything; both are cleared only by a person who
remembers a command. This designs for both.

## What is broken, first way: the work moves

A task is declared against a part of a project, and then the work moves. The bug
in the frontend turns out to be in the backend, or in a config file that belongs
to neither. Somebody asks for one more thing halfway through. On a codebase with
shared components — one file serving several areas, one source of truth per
concern — this is not the exception. It is most days.

The registry has an answer for it already: `task.js scope "<path>" --add`. What it
does not have is any way of noticing that the moment has arrived. Nothing watches,
so the widening depends on a session remembering a line in a skill file, and the
entry goes on describing a task that has moved on.

That is not only a bookkeeping problem. It is the collision warning failing in the
one case it exists for.

### Why the silence matters

Two sessions collide when their declared scopes overlap. `hooks/inject.js` computes
it fresh every prompt, per session, against the registry — there is no shared clash
state anywhere, and the per-session flag under `~/.claude/modes/<session_id>/` is
derived, never stored. That part is sound and this design does not touch it.

The failure is upstream of it. Consider two live sessions:

| session | declared scope | actually editing |
|---|---|---|
| A | `LevelMark/web` | `LevelMark/web`, then `LevelMark/api/routes.js` |
| B | `LevelMark/api` | `LevelMark/api` |

A and B are now writing the same directory. Neither is warned, because
`overlapPaths` compares `LevelMark/web` against `LevelMark/api` and they do not
overlap. The warning is silent precisely because the work moved somewhere nobody
declared — which is the only condition under which two sessions collide by
surprise rather than by choice.

`skills/fankeel/SKILL.md` already says this in prose: *an out-of-date scope is the
one thing that makes the collision warning useless*. Saying it is all that happens.

### What already knows

`lib/guard.js` computes exactly the missing predicate:

```js
const mineHolds = covers(mine && mine.scope, rel);
```

It is thrown away. `blockers()` uses it only to decide precedence when somebody
else also holds the file, and `decide()` returns `null` before reaching any of it
unless the session opted into `guard`:

```js
const mode = guardMode(mine);
if (!mode) return null;
```

So on a default session — every session, since `guard` is off by default and meant
to stay that way — nothing ever asks whether an edit landed inside the scope its
own task declared.

## What is broken, second way: the session dies

`lib/registry.js` opens by stating the rule:

> **Nothing here deactivates anything.** `active` goes false only when the entry
> skill is told to stand a task down; a session ending, a timer expiring and a
> terminal dying all leave the entry exactly as it was. Staleness below is an
> observation about age, offered to whoever is reading, and never a state change.

The rule is right and this design does not touch it. A terminal that dies at
midnight and comes back at nine has to find its task where it left it, and a
registry that expires claims on a timer is a registry that quietly loses work.
`hooks/inject.js` says the same thing from the other side: *staleness softens a
claim rather than withdrawing it, so a stale entry in the same files is still a
clash. The other session may be gone, or may be back in a minute.*

The consequence is a claim nobody will ever withdraw. Close the window without
standing down and the entry stays `active: true` for good — nothing prunes
`.fankeel/sessions/*.json`, and `STALE_MS` only adds an age note after twelve
hours. Every other session overlapping that scope keeps showing `clash`, forever,
against a terminal that no longer exists.

### The information is already there; the remedy is not

`lib/render.js` earns credit here. `otherLine` already annotates a cold claim:

```
  - rework the colour ramp @ build  (scope: web)  (last seen 3 days ago)  << overlaps: web
```

So a reader of the injected block can already tell a live collision from a dead
one. What no one can do is act on it, because **the command to clear a ghost does
not exist**:

| Route | Why it does not serve |
|---|---|
| `task.js adopt <id>` | Takes the task over as well, and refuses outright if this session already owns an active one. Wanting a stale badge gone is not wanting somebody else's task. |
| `task.js down --session <their-id>` | Works, but only because `requireSession` takes whatever id it is handed. It then prints `stood down: <task>` and lists notes under *These die with the task* — text addressed to the owner, about somebody else's notes. Undocumented, and wrong in the mouth. |
| `/fankeel` | The skill offers adopt-or-clear, and `lib/guard.js` points at it. Underneath, clear has no implementation of its own. |

## The change

Three parts. One is copy, one is a hook, one is a command.

### Part A — the scope question stops implying the choice is permanent

`skills/fankeel/SKILL.md`, the `Which part of it?` row of the opening
`AskUserQuestion`, currently reads:

> The directories from `inside it`, biggest first. The whole project is a
> legitimate option; say what it costs — a scope of everything collides with every
> other session in that repository.

Two things are wrong with it. It presents the choice as final, when scope is
editable at any time and the intended shape is to start narrow and widen on
contact. And it names the cost as *collision* without saying what a collision
does, which leaves the reader to supply a consequence — and what people supply is
lost work. A collision blocks nothing by default. It replaces one word on a
statusline.

It is replaced with copy that offers the narrow options first, states that scope
grows, and prices the whole-project option honestly.

### Part B — a hook that notices

A new `PostToolUse` hook on `Edit|Write|NotebookEdit` — the same matcher
`hooks/guard.js` already uses — records the paths edited under this entry that fall
outside the scope the task declared. `lib/render.js` surfaces the list on the next
prompt, with the command that resolves it. Nothing is blocked, and nothing is
guessed.

The hook writes to disk only when the edit is out of scope. On a session working
inside its declared scope — the common case — it reads one small JSON file and
exits.

### Part C — a ghost can be cleared without inheriting it

A new subcommand, `task.js clear <session-id>`, sets another entry's `active` to
`false` and takes its badge down. That is all it does, and everything it does not
do is deliberate.

**It does not delete the file.** `cmdAdopt` reads the source entry without
requiring it to be active, so a task cleared by mistake can still be adopted back,
with its notes and its `next` intact. Clearing is a statement that nobody is
sitting behind this claim, not a statement that the work never happened.

**It refuses a claim that is not stale, unless forced.** Twelve hours of silence is
the only evidence available that a terminal is gone; below that the entry may
belong to somebody who stepped away for lunch. The refusal names what it is
protecting — the task, its stage, and how long since it was last seen — and
`--force` is there for the case the reader can see and the registry cannot, which
is a terminal that died four minutes ago. This follows `guard`'s own instinct: ask
before deny, and never let the first act be taking something away.

**It refuses this session's own entry**, and says to use `down`, which is the
command that exists for it and which prints the notes that are about to die.

`lib/render.js` gains the remedy line to match, and only in the case that warrants
it — every session overlapping this scope is stale:

```
every session overlapping your scope is cold. nothing here is being worked on but you:
  rework the colour ramp @ build — last seen 3 days ago
  node <abs>/scripts/task.js clear <their-id> --session <id>
```

The condition is deliberately all-or-nothing. One cold claim beside two live ones
is not a ghost problem, and the age already sits on its own line.

## Why it is a hook and not a rule

The rule already exists and is already ignored, because a pointer is only as
strong as the salience of what it points at. That sentence is this plugin's own
founding argument and it applies to itself here: the instruction lives in the
collision section of a skill file, several hundred lines from the moment it
matters, and the moment it matters is an edit — which is not a moment the model is
reading skills.

## Why not `hooks/guard.js`, which is already on that event

Its own header states the discipline it keeps:

> silence everywhere except a live collision on a session that asked to be guarded

A `PreToolUse` hook that answers on edits it has no opinion about is overriding
the user's own permission rules for tools it knows nothing about. Drift is not a
permission question and must never gate an edit, so it does not belong on
`PreToolUse` at all. `PostToolUse` observes something that already happened, which
is what this is.

## Data

One new field on the session entry, mirroring `notes` in shape and in caps:

```json
"drift": ["LevelMark/api/routes.js", "LevelMark/config/flags.json"]
```

| Constant | Value | Why |
|---|---|---|
| `MAX_DRIFT` | 5 | `notes` is five. A sixth path does not tell you anything the first five did not: that the task has moved. |
| `MAX_DRIFT_LEN` | 200 | A path is recorded whole or not at all. `trim()` truncates, and a truncated path cannot be pasted into `scope --add` — an entry nobody can act on is worse than an absent one. |

Paths are registry-relative, the same frame `scope` uses, so a recorded entry is
already in the form `scope --add` accepts.

`addDrift` mirrors `addNote` exactly, which means copying two behaviours that are
easy to describe wrongly. A path already in the list is a no-op — `addNote` returns
before pushing, so a repeat does **not** move the entry to the end and does not
refresh its recency. And the cap is `slice(-MAX_DRIFT)`, which keeps the **tail**:
the list is oldest-first, and it is the oldest entry that falls off when a sixth
arrives. Both are the right behaviours here — a path you drifted into first is the
one you have been ignoring longest — but the mirror is only correct if it is
copied rather than reinvented.

`drift` is never version-controlled: it lives in `.fankeel/sessions/<id>.json`,
which `.fankeel/.gitignore` already excludes.

## How it clears

`driftOf(data)` filters the stored list against the entry's *current* scope at
read time, dropping anything now covered. Running `scope --add` therefore clears
the line for free — no second code path, no bookkeeping that can disagree with
itself, and no way for a cleared entry to come back. Stored entries that no longer
render stay on disk, and nothing prunes them: `addDrift` filters only for the
value being a string. Nothing needs to. `driftOf` hides anything the current scope
covers, and `slice(-MAX_DRIFT)` evicts the oldest as new paths arrive, so a
covered entry is invisible until it falls off the end.

This also means widening scope by any route clears it, including replacing the
scope wholesale, which is correct: the question `drift` answers is "is the entry
still describing where the work is", and after a rewrite it is.

**Stand-down** needs no rule. `drift` is a field on the entry, the entry goes
inactive, and the field dies with the task the way `notes` does. It is never
version-controlled and never outlives what it described.

**Adopt does need a decision, and the decision is to carry it.** `cmdAdopt`
(`scripts/task.js`) rebuilds the entry field by field and carries exactly three
optional fields today — `notes`, `next`, `guard` — so a new field is dropped by
default rather than by choice. Dropping it is defensible on one reading: drift
records what a *session* edited, and the adopting session edited nothing. But that
is not the question the field answers. It answers whether the scope still describes
where the work is, which is a property of the **task**, and adopt is precisely the
moment a task moves to a session that has no other way of knowing. A fresh session
inheriting a too-narrow scope with the evidence deleted is the failure this design
exists to prevent, arriving through the one door left open.

The rendered wording follows from that: *files this task edited*, not *you*.

## What it looks like

Nothing, on a session that has not drifted — the block is absent and costs zero
characters. When it has:

```
scope drift — 2 files this task edited outside its declared scope:
  LevelMark/api/routes.js, LevelMark/config/flags.json
  node <abs>/scripts/task.js scope "<path>" --add --session <id>
```

**The command has to run exactly as printed, and getting there takes two
substitutions the block does not make today.**

`<abs>` is the absolute path to `scripts/task.js`, resolved from `__dirname` the
way `lib/render.js` already resolves `SURVEY_SCRIPT`, `MAP_SCRIPT`, `LEDGER_SCRIPT`
and the two doc scanners — for the reason that file gives: *so the rules name paths
that work from whatever directory the session happens to be in*. `<plugin>` is a
placeholder that belongs to `skills/fankeel/SKILL.md`, which explains alongside it
how to resolve it. Injected text has no such explanation and must not use it. This
adds a seventh constant, `TASK_SCRIPT`, beside the six already there.

`<id>` is the session id, and `scripts/task.js:154` refuses without it:
`--session <id> is required. Read it from the transcript path; never guess it.`
`render()` already receives it — `hooks/inject.js` passes
`mine: { sessionId, data: mine }` — and currently never emits it. It is substituted
here rather than left to the reader.

That second point is worth stating separately, because it is a defect this design
did not create. `skills/fankeel/SKILL.md:107` says *the current session id is in the
`FANKEEL ACTIVE` block when the mode is on*. It is not: `sessionId` does not appear
anywhere in `lib/render.js`. Every `task.js` call the model makes has been falling
through to the transcript-path fallback. It is out of scope here and listed under
**Open**.

Once it runs, `scripts/task.js` already prints the collisions a new scope creates
at the moment it is written, so `--add` answers the second question — who this now
puts you next to — without being asked.

## What this does not do

- **It never edits `scope`.** Invariant 3 stands: a guessed scope produces false
  collision warnings, and a false warning is worse than a missing one. The hook
  records; a person decides.
- **It never blocks an edit.** Drift is an observation. The only thing in this
  plugin that blocks is `guard`, opted into per session, and this design does not
  touch it.
- **It never deactivates an entry on its own, and adds no timer that does.**
  `clear` is a command a person runs. `lib/registry.js`'s rule — *staleness is an
  observation about age, offered to whoever is reading, and never a state change* —
  survives this design intact. A registry that expires claims on a timer is a
  registry that loses the work of anyone who takes a long lunch.
- **It does not change what `clash` means, or the badge word it takes.** A session
  that deliberately declares the whole project still shows `clash` permanently and
  still loses the stage word from its statusline. That is a real cost and a
  separate decision; it is out of scope here.
- **It does not touch the map.** Whole-project understanding comes from
  `.fankeel/map.md`, which `scripts/map.js` builds from `--root` with no scope
  argument at all. A narrow scope has never limited what a session can read, and
  the narrow-first guidance in Part A depends on that staying true.

## Success criteria

Each fails now and passes after.

1. A session scoped `web` edits `api/routes.js`. The next injected block names that
   path and the command that adopts it. **Fails now:** nothing is recorded.
2. That session runs `scope "api/routes.js" --add`. The line is gone on the
   following prompt, and a second live session scoped `api` now sees the collision.
   **Fails now:** the second session never sees it.
3. A session working entirely inside its scope produces no drift block and no write
   to its entry. **Fails now:** vacuously true; must stay true after.
4. A session with no active entry, and a session whose entry is stood down, produce
   no output and no file. The same rule the other four hooks keep.
5. The hook exits 0 on a malformed payload, an unreadable registry, and a path
   outside the registry root.
6. A session whose only overlapping neighbour was last seen three days ago is told
   so, and given a command that clears it. **Fails now:** the age is shown, the
   remedy is not, and no command exists to run.
7. `clear` on that neighbour drops the `clash` from this session's next prompt, and
   leaves the entry adoptable with its notes and `next` intact. **Fails now:**
   `clear` does not exist; `adopt` would take the task, and `down --session` would
   address the owner about notes that are not the caller's.
8. `clear` refuses an entry seen four minutes ago, names the task and the age in the
   refusal, and proceeds under `--force`. It refuses this session's own entry and
   says to use `down`.

## Files

| File | Change |
|---|---|
| `hooks/touch.js` | New. `PostToolUse`, records out-of-scope edits. |
| `lib/registry.js` | `addDrift`, `driftOf`, `MAX_DRIFT`, `MAX_DRIFT_LEN`. |
| `lib/render.js` | The drift block, when non-empty, and the all-cold block, when it applies. A seventh `TASK_SCRIPT` constant, and the session id emitted into both commands. |
| `scripts/task.js` | `cmdAdopt` carries `drift` — a fourth optional field beside `notes`, `next` and `guard`. New `cmdClear` (Part C), and `--force`. |
| `skills/fankeel/SKILL.md` | Part A copy; the drift line in the scope section; `clear` in the command list, and in the adopt-or-clear text that currently promises it. |
| `.claude-plugin/plugin.json` | The fifth hook; version. **A second `PostToolUse` entry** — see below. |
| `README.md` | `all four hooks` and `The other two are not load-bearing` are both counts a fifth hook falsifies. |
| `docs/registry.md` | The new field and the new file-writer row. |
| `docs/collisions.md` | Why an out-of-date scope is now noticed rather than only warned about, and how a claim outlives its terminal. Its *stale entries* section answers why a dead claim does not block; it does not yet answer how to be rid of one. |
| `lib/guard.js` | Its refusal text points at `/fankeel` for adopt-or-clear. Name `clear` now that it exists. |
| `tests/resume.test.js` | The manifest assertion — see below. |
| `tests/` | The hook driven as a subprocess, the way `tests/guard.test.js` drives its own. |

Two of those rows are traps rather than edits.

**`tests/resume.test.js` goes red the moment the manifest gains a second
`PostToolUse` entry**, because it asserts `post.length === 1` and then indexes
`post[0]`. Its own comment says why that assertion exists: *the matcher is the whole
cost control. Widened to every tool, this would append the stage rules after each
Read and each Bash, which is a bill rather than a fix — so the manifest is asserted
rather than trusted.* So the repair is to re-express it against resume's **own**
entry, found by matcher, and keep every assertion it makes about that entry.
Loosening it to `post.length >= 1`, or indexing `post[0]` and hoping the order
holds, drops a deliberate guard while leaving the test green — which is worse than
the red it replaces. `touch.js` gets an assertion of the same shape.

**`README.md` will not be caught by either scanner.** It sits in no
`.fankeel/docs.json` bucket — those cover `docs/*`, `skills` and `output-styles` —
and `scripts/docs-check.js` says outright that a README beside code is not reported
as misfiled. The count on the plugin's own front page is therefore only correct if
somebody remembers it, which is what this row is for.

## Open

Raised, verified, and deliberately not bundled. None of these is decided.

- **The badge word under permanent clash** — `clash` versus `build-clash`. A
  session that declares the whole project loses its stage from the statusline for
  as long as it runs.
- **`skills/fankeel/SKILL.md:107` is already false.** It says the current session
  id is in the `FANKEEL ACTIVE` block; `sessionId` appears nowhere in
  `lib/render.js`. Part B works around it by substituting the id into its own
  command, which fixes the drift line and nothing else. The sentence is still
  wrong, and every other `task.js` call the model makes still falls through to the
  transcript-path fallback.
- **`STALE_MS` is twelve hours, and `clear` inherits that number without arguing
  with it.** It is the right threshold for softening a warning and an awkward one
  for gating a command: a terminal that died four minutes ago is unmistakably dead
  to a person and fresh to the registry. `--force` covers it, which is a working
  answer rather than a good one. Whether liveness deserves a better signal than
  age — the mode flag under `~/.claude/modes/<session_id>/` is written every prompt
  and is one — is a separate question, and a bigger one.
