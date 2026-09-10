# FanKeel

A keel is the one structural member a hull cannot lose.

fankeel is a Claude Code plugin that carries a development discipline and states
it on every prompt — and again on every answer — rather than once at the top of a
session. It holds a task, moves it along a route it picked through seven stages,
keeps a capped note of what has been tried, and shows which other live sessions
are in the same files.

It exists because long-running projects rot in ways that are invisible from
inside any one session: components rebuilt because nobody knew an equivalent
existed, design documents piling up after the work they described has shipped,
conventions that hold for a month and then quietly stop, and two terminals
editing one file because neither knows the other is there.

## Install

```
claude plugin marketplace add FanFantom9452/FanKeel
claude plugin install fankeel@fankeel
```

Restart Claude Code afterwards. Nothing else is installed: no dependencies, and
the tests run on `node --test`, which is built in. Then, in any project:

```
/fankeel
```

It looks before it asks — what is under this directory, which of them is a
repository, which was touched today — and then asks at most two questions with
the options already on screen: which project, skipped when there is only one, and
what the task is, read from `TODO.md` where the root has one. It never asks which
files you will touch; those are recorded as the edits land.

> The repository is `FanKeel` and everything you type is `fankeel`. Plugin and
> marketplace ids have to be kebab-case — Claude Code accepts anything else, and
> the Claude.ai marketplace sync does not — so the id, the command, the badge
> word and the `.fankeel/` directory are all lowercase.

It is also one of the plugins [claude-kit](https://github.com/FanFantom9452/claude-kit)
installs, if you would rather take a whole machine's worth in one command — and
that kit wires up TokenBar, which is what draws the badge.

## Update

```
claude plugin marketplace update fankeel
claude plugin update fankeel@fankeel
```

Restart Claude Code afterwards, the same as installing. The marketplace line comes
first because `plugin update` compares against the listing already on disk — skip
it and there is nothing newer to find. Given no name, `marketplace update`
refreshes every marketplace at once. Re-running `claude plugin install` is not the
update path: the plugin is already installed, and what needs refreshing is the
marketplace listing behind it.

## Uninstall

```
claude plugin uninstall fankeel@fankeel
claude plugin marketplace remove fankeel
```

`.fankeel/` is left in place — it is the project's, not the plugin's. Delete it by
hand if you want it gone. Stale `~/.claude/modes/<session_id>/fankeel` flags are
pruned after 30 days while the plugin is installed; after uninstalling, remove any
that remain.

## The pipeline

Seven stages, each named for what it produces rather than how it feels:

```mermaid
flowchart LR
    S["<b>survey</b><br/>search the code, read the docs —<br/>does this already exist?"]
    D["<b>design</b><br/>one approach, its trade-offs,<br/>and the test that settles it"]
    P["<b>plan</b><br/>split into tasks you can test<br/>and review one at a time"]
    B["<b>build</b><br/>write it, test it, commit it —<br/>one review per task"]
    V["<b>verify</b><br/>run the tests, check that what<br/>you changed actually changed"]
    A["<b>audit</b><br/>find the pages that stopped<br/>being true"]
    L["<b>land</b><br/>close the TODOs, rewrite the map,<br/>then merge, PR, or keep"]

    S --> D --> P --> B --> V --> A --> L
```

**A route is the stages one task actually needs, in order.** Not every task is
seven. A class picks one when the task starts, and every prompt from then on
carries it with your position bracketed, so a two-stage task is never reported as
permanently unfinished at 2 of 7:

```
spike          route: [survey] → build                                          (1 of 2)
bounded        route: survey → design → [build] → verify → land                 (3 of 5)
architectural  route: survey → design → plan → [build] → verify → audit → land  (4 of 7)
```

Only the current stage's rules are sent, and they are sent again every turn — a
pointer is only as strong as the salience of what it points at. What each stage
produces, what happens inside one, and how a class picks a route are in
[docs/pipeline.md](docs/pipeline.md).

## Every stage ends at a gate

```mermaid
flowchart LR
    W["do the work"] --> R["report in this<br/>stage's shape"]
    R --> Q{"AskUserQuestion"}
    Q -- "1 · approve, move on" --> N["next stage<br/>on the route"]
    Q -- "1 · at the last stage" --> D["stand the task down"]
    Q -- "2 · stay here" --> W
    Q -- "3 · pause" --> P["next is written down;<br/>the task outlives the session"]
    N --> W
```

The gate is not conditional on there being something to decide: finishing a stage
is the moment the next decision exists, and the answer being predictable is not
the same as it having been given. Picking option one *is* the approval, so its
description says what is being approved — after `design`, that is the approach
itself. Each stage also ships the shape of its report, not only a description
of one — the shape `build` ships:

```
- path +12/-3 — what changed
- path (new) — what it is

done: <n> of <m> — ledger or file table
deferred: <heading> — <TODO.md line, or omit this line>
then AskUserQuestion
```

## The badge, and the station

fankeel writes one word to `~/.claude/modes/<session_id>/fankeel`, and
[TokenBar](https://github.com/FanFantom9452/ClaudeCodeCLI-TokenBar) renders any
flag it finds there — so the two work together with no wiring on either side:

```
[FANKEEL:BUILD] | Opus 5 | my-project | main ↑2 +42/-7 ?1
ctx ███▊░░░░░░  38%    ·    5h ██████▌░░░  66%   ↻ 1h 46m    ·    7d █████▊░░░░  58%
```

The word is the stage, not an intensity. `clash` takes the slot when another live
session is in your files, and `init` is the gap between `/fankeel` being submitted
and a task existing. The seven stage colours ship with TokenBar from v1.4.0 on;
the palette, both config formats and what each colour is doing are in
[docs/statusline.md](docs/statusline.md).

Every session this machine has run, live or abandoned or stood down, is one page:
the station. `node scripts/station.js --open` opens the newest, and `serve` in
place of that is the live form — [docs/station.md](docs/station.md).

## The three scanners

| | |
|---|---|
| `node scripts/docs-check.js` | Every reference still resolves. A second to run, and the `verify` and `audit` rules call for it. |
| `node scripts/residue.js` | What is in this tree that nobody decided about: untracked and unignored, a worktree whose branch is merged, an environment nothing can rebuild or run, the weight of what is ignored, directories holding no files. It never deletes. |
| `node scripts/docs-audit.js` | The fortnightly deep pass: which pages have stopped being true, and which two of them disagree. `/fankeel-audit` is the whole sweep — it runs all three, reads the shortlist they produce, then offers the cleanup. |

None of them decides that two documents contradict each other, because nothing
mechanical can. What the cap is, and why comparing two runs beats comparing two
headline counts, is in [docs/documents.md](docs/documents.md).

## Where to find things

| I want to know | Page |
|---|---|
| What `/fankeel` asks me, the seven stages, and how a route is chosen | [docs/pipeline.md](docs/pipeline.md) |
| What `.fankeel/map.md` holds, and why a page marked design-intent is not drift | [docs/pipeline.md](docs/pipeline.md) |
| What gets written to disk, what is committed, and what `notes` and `next` are for | [docs/registry.md](docs/registry.md) |
| What `[FANKEEL:CLASH]` means, and how to stop a collision raising a prompt | [docs/collisions.md](docs/collisions.md) |
| What `docs.json` declares, and why an archive naming deleted code is not a bug | [docs/documents.md](docs/documents.md) |
| What a subagent is told when it starts, and when `/fankeel-ask` is worth the money | [docs/subagents.md](docs/subagents.md) |
| The badge word, and how to colour each stage | [docs/statusline.md](docs/statusline.md) |
| Every session on this machine on one page, and how to put an abandoned one down | [docs/station.md](docs/station.md) |
| Which output style to use, and why a style rather than an injected ruleset | [docs/output-styles.md](docs/output-styles.md) |
| How the plugin is built and checked, and the four scripts that stop a claim drifting | [docs/development.md](docs/development.md) |
| How to run the behaviour eval, and what to do when `claude plugin eval` says early access | [docs/evals.md](docs/evals.md) |
| Why any of it was built this way | [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md) |

The full index, question by question, is [docs/README.md](docs/README.md).

## Development

```
npm test
claude plugin validate .
```

`lib/` is pure logic, tested directly; `hooks/` is where stdin, stdout and process
exit live, and every hook exits 0 on every path, because a hook that throws blocks
the thing it was called for and a plugin that can wedge your terminal is worse than
no plugin. The four scripts that keep a written claim from drifting away from what
it describes — `todo-check.js`, `version.js`, `skills-check.js` and
`stage-registry.js` — are in [docs/development.md](docs/development.md); the
behaviour eval and the six ways an operator's own machine can leak into a run are
in [docs/evals.md](docs/evals.md).
