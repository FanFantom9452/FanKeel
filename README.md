# fankeel

A keel is the one structural member a hull cannot lose.

Long-running projects rot in ways that are invisible from inside any one session.
Components get rebuilt because nobody knew an equivalent existed. Design documents
pile up after the work they described has shipped. Conventions hold for a month
and then quietly stop. And two terminals open on the same repository will happily
edit the same file, because neither knows the other is there.

fankeel is a Claude Code plugin that carries a development discipline and states
it on every prompt. This first release is the shell and the registry: the mode, the
task, and who else is in your files. The discipline itself is being designed —
see [TODO.md](TODO.md).

## Install

```
claude plugin marketplace add FanFantom9452/fankeel
claude plugin install fankeel@fankeel
```

Restart Claude Code afterwards. Nothing else is installed: no dependencies, and
the tests run on `node --test`, which is built in.

## Use

```
/fankeel
```

It lists what every live session in this repository is working on and asks what
you want to do — carry on, start a task, adopt one, stand it down, or clear out
entries whose terminal is long gone.

Starting a task puts this session in fankeel mode. From then on every prompt
carries the task, the stage rules, and the other live sessions:

```
FANKEEL ACTIVE — rework the 7d deviation colour ramp @ implement
scope: statusline.ps1, statusline.sh, preview.ps1

also in progress:
  - rewrite the installer @ design  (scope: install.ps1, install.sh)
  - retune the 5h ramp @ implement  (scope: statusline.ps1)  << overlaps: statusline.ps1
  - triage the colour issues @ investigate  (scope: README.md)  (last seen 14h ago)

stage rules:
  - Finish the step you are on. Do not stop where the happy path works and the rest is "later".
  - When a step completes, ask the next question instead of wrapping up. Always offer a pause option.
  - Put a question’s background inside the question itself, not in the message above it.
  - Give every option its trade-off, recommended one first.
```

The rules are restated in full every turn rather than pointed at. A pointer is
only as strong as the salience of what it points at, and what it points at recedes
by thousands of tokens a turn.

## The mode never switches itself off

A session is in fankeel mode exactly when it owns an active task. There is no
separate flag to disagree with, and no way to be in the mode without having said
what you are working on.

Nothing turns it off on a timer or at the end of a session. Claude Code sessions
resume — a resumed or compacted session is the same session — so a hook clearing
the flag at session end would drop you out of the mode behind your back and the
mode would appear to switch itself off at random. Only standing a task down ends
it.

## Collisions are about files, not names

Two sessions collide when their declared **scopes** overlap. One person writes
"colour ramp" and the other writes "fix 7d"; a check on the name sees two
unrelated tasks, while the file is what actually gets overwritten.

Scope entries are globs. `src/**` and `src/a.ts` overlap whichever was declared
first, `src/*.ts` stops at one path segment, and a bare directory name covers what
is under it.

An overlap is **reported, not blocked**. Blocking every edit that lands in another
session's scope is the obvious next step and is deliberately not here yet: its
value rests entirely on scope being declared accurately, and nobody knows yet how
accurately people declare it. Shipping the block first would mean spending the
early weeks unlocking yourself instead of working.

## Stale entries

A terminal killed outright leaves an entry claiming to be in progress. Rather than
expire it — which would mean the mode switching itself off — fankeel annotates it:

```
  - retune the 5h ramp @ implement  (last seen 19d ago)
```

That is the whole mechanism. Being stale writes nothing, deactivates nothing and
hides nothing. If the owning session comes back, its next prompt refreshes the
timestamp and it stops being stale. `/fankeel` offers to clear genuinely dead
entries, and only ever on your say-so.

## Statusline

fankeel writes one word to `~/.claude/modes/<session_id>/fankeel`.
[TokenBar](https://github.com/FanFantom9452/ClaudeCodeCLI-TokenBar) renders any
flag it finds there, so no change is needed on that side:

```
[FANKEEL:DESIGN]      [FANKEEL:IMPLEMENT]      [FANKEEL:CLASH]
```

The word is the stage, not an intensity. An intensity is a constant you set once
and then stop noticing; a statusline earns its space by showing what changes.
`clash` takes the slot when another live session is in your files, because at that
moment the collision matters more than the stage — and the stage is still in the
injected text.

## Files it writes

| Path | In version control | Written by |
|---|---|---|
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `/fankeel`, and the hook for `updated` |
| `.fankeel/.gitignore` | Yes | Created with the directory |
| `~/.claude/modes/{session_id}/fankeel` | n/a | The hook, every prompt |

State lives in the project rather than under `~/.claude/` so that project memory —
the next piece — travels with the repository instead of being lost on the next
machine. Only the volatile half is excluded, so anything added under `.fankeel/`
later is versioned by default.

The hook writes exactly one registry file: this session's own. It never writes
another session's, and never deletes one.

## Uninstall

```
claude plugin uninstall fankeel@fankeel
claude plugin marketplace remove fankeel
```

`.fankeel/` is left in place — it is the project's, not the plugin's. Delete it by
hand if you want it gone. Stale `~/.claude/modes/<session_id>/fankeel` flags are
pruned after 30 days while the plugin is installed; after uninstalling, remove any
that remain.

## Development

```
npm test
claude plugin validate .
```

`lib/` is pure logic, tested directly. `hooks/inject.js` is the only file that
touches stdin, stdout and process exit, and is tested as a subprocess with real
payloads.

The hook exits 0 on every path, including every error path. A `UserPromptSubmit`
hook that throws blocks the prompt it was called for, and a plugin that can wedge
your terminal is worse than no plugin.
