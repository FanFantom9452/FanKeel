---
status: current
last_verified: 2026-08-29
source_of_truth: hooks/brief.js, lib/render.js, hooks/carry.js
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
| **dispatch** | by default. Anything that would leave files, output or dead ends in the parent's context, where they are re-read on every later turn |
| **do not** | only two cases — a pipe already removes the residue, or it is a single tool call. `npm test` is tens of thousands of characters and the two lines that decide it are 24; `grep` does that for nothing |

Measured on 2026-08-26, one fan-out of four readers with a lens each: 240,881
tokens spent inside them, about 4,000 characters returned, and 121 seconds rather
than 352 because all four went out in one response. A second fan-out, measured the
same day during this branch's own verify stage, sent four readers out in one
response for 614 seconds of combined agent time against 235 seconds of wall-clock
— the slowest one.

Five things that fail silently when missed: several dispatches must be in **one
response** to run concurrently; the **model must be passed explicitly**, since an
omitted one inherits the parent's; the **count and the model must be said out
loud**, in the response that sends them, because a fan-out nobody announced is
spend the user is paying for and could not see coming; the returns must be
**compared against each other**, because agents dispatched from one prompt style
make correlated mistakes that per-agent reading will not catch; and the **return
contract must state why it costs**, because naming the shape without the reason
is a preference, not a contract, and a subagent told the reason returns the
shape.

## Split it by lens, not by slice

Once you have decided to fan out, there are two ways to divide the work and they
are not equivalent.

| | |
|---|---|
| **by slice** | reader one gets `lib/`, reader two gets `scripts/`, reader three gets `hooks/`. Each sees a third of the tree |
| **by lens** | every reader gets the whole tree and one question. One looks for dead code, one for reinvented standard library, one for duplication |

**Slicing loses exactly the findings a fan-out is for.** "Nothing calls this" and
"this abstraction has one implementation" are answers no reader holding a third
of the tree can give: the caller it is looking for is in somebody else's slice,
so every reader reports a maybe and the parent has to redo the join. Measured on
this repository: `lib/plugins.js` has zero production callers, and that is only
visible to something holding `lib/`, `scripts/` and `hooks/` at once.

A lens costs more per reader — each reads the whole tree — and it buys an answer
that does not need reassembling. The reading is thrown away either way; what
survives is the answer, and a narrow answer from a wide read is the trade the
whole mechanism is making.

Slice only where the question is genuinely local. "Does this file's own logic
agree with itself" is per-file and splits cleanly; "is this used" never does.

## Say the denominator

A fan-out reads part of something. **Say what the part is out of.** Four readers
over four pages of forty-three is four readers over 9% of the documents, and a
report that says "four readers found nothing" without the forty-three reads as a
clean sweep of the whole thing.

This is the rule `lib/map.js` states for its own caps — the count of what was
dropped is still printed, because a silent cap reads as "that is all there is".
A fan-out is a cap somebody chose, and it fails the same way.

`PostToolUse` fires inside a subagent under the **parent's** session id — measured,
not assumed — so a dispatched implementer's edits are claimed for the task that
dispatched it and the collision warning keeps covering them.

# Telling a subagent apart, when a hook has to

`hooks/carry.js` has to, because a subagent owns no task and must never be
offered one. The field for it is **`agent_id`**, and Claude Code says so itself:

> Subagent identifier. Present only when the hook fires from within a subagent
> (e.g., a tool called by an AgentTool worker). Absent for the main thread, even
> in `--agent` sessions. **Use this field (not `agent_type`) to distinguish
> subagent calls from main-thread calls.**

`agent_type` is the trap. It is set inside a subagent *and* on the main thread of
a session started with `--agent` — and that second one is a real session, which
does own tasks and does get the offer. A hook filtering on the type would refuse
the person it was written for.

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
