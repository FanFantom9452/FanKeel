---
name: fankeel-station
description: Every fankeel session on this machine on one page — live, abandoned and stood down, with what each cost — and a button to put an abandoned one down. Use for /fankeel-station, "show all sessions", "which sessions are still open", "clean up old sessions", or "監控站".
version: 0.48.0
status: current
last_verified: 2026-09-05
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js
---

# fankeel-station

The station is a page, not a process. It is rewritten at the `/fankeel`
prompt, by every `task.js` verb that moves an entry, and when a session ends,
so opening it is enough — from the registry you are in:

    .fankeel/station.html

or the copy that is always newest:

    node <plugin>/scripts/station.js --open

`<plugin>` is two directories up from this file. The page finds registries
through a roots file every write refreshes (`~/.claude/fankeel/roots.json`),
the leads under `~/.claude/modes/` of sessions running a task now, and the
working directory of every running session. A registry none of those has
seen yet is found once by `--scan <dir>` — one run per drive, and it is
remembered from then on — or named with `--root <dir>`.

## Clearing from the page

Clearing needs a process, so for that the page is served:

    node <plugin>/scripts/station.js serve --open

It binds `127.0.0.1` on a free port, prints the URL, and exits after ten idle
minutes or Ctrl+C. The page it serves is the same page with a `clear` button on
every `stale` row — `active: true` with no process behind it. The button calls
exactly what `task.js clear` calls: age is the rule, `force` is the override
for a terminal you know is gone, and a `live` row has no button at all. It
writes `active: false` and nothing else, so a session cleared by mistake can be
adopted back.

## What the page shows

Per registry: its root, how many entries could not be parsed, what is under
`.fankeel/build/`, and when `map.md` was last written. Per session: when it
started, its state, its stage on its route, the task, cost in USD at the price
table's date, the stage tokens and minutes fankeel measured itself, and the
model. A row opens to the session id, project, route, when it was last touched,
when and why it ended, what it touched, its notes and its `next`.

**Cost is at a dated price table.** `lib/prices.js` names the day its figures
were read, and the page prints it in the header. A model the table does not
know shows its output tokens instead of a dollar figure.

**The end of a session is recorded, not decided.** `ended` says when and why
(`clear`, `logout`, `prompt_input_exit`, `other`); `active` is only ever
changed by `down`, by `clear`, and by `adopt` on the entry it takes over.
