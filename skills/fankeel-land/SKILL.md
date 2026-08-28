---
name: fankeel-land
description: The land stage — a green suite, the documents closed, the map rewritten, and the integration decision left to the user. Use for the land stage of a fankeel task, finishing a development branch, deciding between merge and PR, or cleaning up a worktree when work is complete.
version: 0.33.0
status: current
last_verified: 2026-08-27
source_of_truth: lib/stages.js, scripts/todo-check.js, scripts/map.js
---

# fankeel-land

Produces a repository no dirtier than you found it.

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
| work deliberately deferred | `TODO.md`, one line, under the heading for what it is short of |

Commit the reason, not the diff — it is already in the commit. The subject is
why; the body is the same `shipped:` list the report ends on, one bullet each:

```
<why this was done, one line>

- <what someone can now do that they could not>
- <another>

<anything the bullets cannot hold: a measurement, a cap, a ruling>
```

The report and the commit are the same material, and a commit that argues in
paragraphs makes its reader reconstruct a list that was written twenty lines
earlier. Prose is for what a bullet cannot hold — a number, a cap, a decision
that went the other way.

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
