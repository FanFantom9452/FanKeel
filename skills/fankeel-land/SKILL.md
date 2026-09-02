---
name: fankeel-land
description: The land stage — a green suite, the documents closed, the map rewritten, and the integration decision left to the user. Use for the land stage of a fankeel task, finishing a development branch, deciding between merge and PR, or cleaning up a worktree when work is complete.
version: 0.42.0
status: current
last_verified: 2026-09-03
source_of_truth: lib/stages.js, scripts/todo-check.js, scripts/map.js, hooks/carry.js
---

# fankeel-land

Produces a repository no dirtier than you found it.

**Done when** the suite is green, the documents are closed, the map is rewritten
and `todo-check` passes. The integration decision itself is the user's, so it is
what the gate asks — never something to settle first and report afterwards.

## 1. The full suite, on the tree you are about to integrate

`npm test` / `cargo test` / `pytest` / `go test ./...` — whatever this project
uses.

**Red stops everything.** Report the failures and stop; the menu comes after a
green run. A green run earlier in the session only proves the tree it ran on.

## 2. Close the documents

```
node <plugin>/scripts/todo-check.js [--root <dir>]
```

Close the `TODO.md` entries this work finished — whoever finishes the work removes
the entry in the same change. A plan that just moved is a link that just changed
address, so run this after anything moves.

Update `last_verified` on every page you re-read and found true. That date is the
difference between "somebody touched this file" and "somebody read it and it was
true"; a whitespace fix does the first and proves nothing.

A landed plan leaves a decision record behind — what was decided and why — and is
then archived, **after asking**. An unarchived plan gets read as current.

## 2a. The release number, when the work is one

```
node <plugin>/scripts/version.js              what the ten places say
node <plugin>/scripts/version.js 0.35.0       set them
node <plugin>/scripts/version.js --changes    what has landed since the last one
```

Ten files carry it: two manifests and one frontmatter line in each of the eight
skills. `npm test` fails when they disagree, so this is a fixer rather than a
check — and the fixer matters because a release used to be ten edits, where
missing one left a skill announcing a version the plugin is not. Wrong in the way
nobody catches: the number is right in nine places.

**Only when the user says this is a release.** Bumping a version is a claim about
what shipped, which is theirs to make. `--changes` is what to show them when
asking — the commits since the last `chore: <x.y.z>`, derived from the log rather
than from a changelog somebody has to remember to write.

## 3. Rewrite the map

```
node <plugin>/scripts/map.js [--root <dir>]
```

The project looks different now, and the next task starts from this file.

## 4. Land the notes

Task notes die with the task. If a note still matters after the work lands, it
was never a note:

| | |
|---|---|
| a project convention | `CLAUDE.md` |
| a durable fact about the user or repository | the memory directory |
| why a change was made | the commit message |
| work deliberately deferred | `TODO.md`, one line, under the heading for what it is short of — under `## Waiting`, ending with a `MM-DD` stamp, or `todo-check` fails the gate below |

The commit is the same three parts every time, and `build` commits one task at a
time with the same skeleton — injected here, and read from step 4 of its own
skill there, because its injection has no room for the rule:

```
type: what changed, under 60 characters with the type

- <what changed> — <module or path>
- <what changed> — <module or path>

<one paragraph, only for what a bullet cannot hold: a number, a control, a
decision that went the other way>
```

The bullets are the `shipped:` list rewritten for the next session's `init`,
which reads `git log` before it reads any code: a capability in the report, a
change and the module it landed in here. Asking for the reason instead came back
as five paragraphs of it under a 107-character subject, and the reader had to
reconstruct the list. The reason is the one paragraph, and only when a bullet
cannot hold it.

Standing the task down is the last thing, and `/clear` comes after it — never
before. A `/clear` keeps the process and takes a **new** session id, so a clear
first leaves the entry `active` with nothing reading it. `hooks/carry.js` offers
it back on the next session's first prompt, but the clean order costs nothing.

## 5. Detect the workspace, confirm the base

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

`GIT_DIR == GIT_COMMON` is a normal repository with no worktree to clean up.
Otherwise it is a worktree; a detached HEAD is externally managed, so leave it in
place and offer only the PR and keep-as-is options.

The base branch is whatever this work forked from. If it is not already known,
ask — merging into the wrong base is expensive to undo.

## 6. The menu

Present exactly these, and wait. Integration is the user's decision.

```
1. Merge back to <base> locally
2. Push and create a Pull Request
3. Keep the branch as-is
```

**Discarding is not on the menu.** It happens only when the user asks for it in
so many words, and then only against the typed word `discard`.

## 7. Execute

**Merge:** from the main repo root, checkout base, pull, merge, then **re-run the
suite on the merged result**. A failure there stops everything — nothing has been
pushed, so it is recoverable; leave the branch and worktree in place and
investigate. Green, then clean the worktree, then `git branch -d`.

**PR:** push, open it against the base, report the URL. **Keep the worktree** —
PR feedback gets fixed there.

**Keep:** say where the branch and worktree are.

Worktree removal refused for uncommitted files never gets `--force` on your own
initiative. Those files exist nowhere else. Show the user
`git status --porcelain -uall` and ask whether to commit them, move them, or
delete them.

Clean up only worktrees the project created under `.worktrees/` or `worktrees/`.
Anything else belongs to the host environment.

## Output

```
<sha> <subject>
shipped:
  - <what someone can now do that they could not>
cost: <what it took>
open: <what is still not done>
then AskUserQuestion
```

Three lines and the list. `shipped:` is one line per thing someone can now do
that they could not — from the ledger's completed entries where the task had a
plan, listed by hand where it did not. A commit subject already holds the change;
what it cannot hold is a task that shipped four of them. Not a tour of the diff.

`land` has no successor — what follows a finished route is a new task, which is a
decision rather than a transition.
