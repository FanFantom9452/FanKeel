---
status: current
last_verified: 2026-08-26
source_of_truth: hooks/brief.js, lib/render.js
---

# Subagents

What a subagent is told when it starts, and why the return value is the expensive half.

A subagent starts with its own context and none of the parent's. The per-prompt
injection never reaches it — that rides on the user's prompt, and a subagent does
not have one. So a `SubagentStart` hook hands it a brief instead: the task,
the files that task has touched, and what its return value costs.
Background subagents get the same brief. One started with an isolated context
does not, which is Claude Code's decision rather than something to work around.

## Why this is the best-value text in the plugin

The arithmetic is lopsided in a way nothing else here is.

Everything a subagent **reads** costs input tokens in a context that is thrown
away the moment it finishes. What it **returns** costs output tokens — five times
the price — and then sits in the parent's context for the rest of the session,
competing for the window and pulling compaction forward.

So spending 280 tokens on a brief to take a thousand off a return value is worth
it every single time, and it is worth it even when nothing else about the
delegation changes.

## When to dispatch one

The section below says what a subagent is *not*. This is the other half.

| | |
|---|---|
| **dispatch** | when the reading is wide, the answer is narrow, and no filter can pick it out. The reading happens in a context that is thrown away and only the answer arrives here |
| **do not** | when a pipe already removes what you are avoiding. `npm test` was 50,434 characters over 640 tests on 2026-08-26 and the two lines that decide it are 24 — `grep` does that for nothing |

Measured on 2026-08-26, one fan-out of four readers with a lens each: 240,881
tokens spent inside them, about 4,000 characters returned, and 121 seconds rather
than 352 because all four went out in one response.

Three things that fail silently when missed: several dispatches must be in **one
response** to run concurrently; the **model must be passed explicitly**, since an
omitted one inherits the parent's; and the returns must be **compared against
each other**, because agents dispatched from one prompt style make correlated
mistakes that per-agent reading will not catch.

`PostToolUse` fires inside a subagent under the **parent's** session id — measured,
not assumed — so a dispatched implementer's edits are claimed for the task that
dispatched it and the collision warning keeps covering them.

## What it deliberately is not

- **Not the stage rules.** A subagent is not running the pipeline; it is doing one
  bounded job inside somebody else's stage. "Commit the reason, not the diff" is
  instructions for work it is not doing.
- **Not a registry entry.** A subagent is not a session and does not own a task.
  Giving it one would put a second claimant on its own parent's files.
- **Not a replacement for what compressing agents already do.** If a subagent
  already knows how to return little, this adds the thing it cannot know: which
  task it belongs to and which files are spoken for.

The scope guard reaches subagents on its own — `PreToolUse` fires inside them —
so a subagent editing a file another live session claimed hits the same block the
parent would. `PostToolUse` fires there too and looks the entry up by the parent's
session id, so what a subagent edits is claimed by the task that dispatched it.
That is why the brief carries the touched list and asks for nothing back about it:
a returned file list would be a slower, unparsed copy of a record already written.

[Back to the index](README.md) · [Back to the front page](../README.md)
