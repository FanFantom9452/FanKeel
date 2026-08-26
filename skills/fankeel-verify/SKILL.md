---
name: fankeel-verify
description: The verify stage — evidence before claims, requirements checked line by line, and the documents this change just made false. Use for the verify stage of a fankeel task, before claiming work is complete or passing, before a commit or PR, or when checking whether a change broke the documentation describing it.
version: 0.31.0
status: current
last_verified: 2026-08-26
source_of_truth: lib/stages.js, scripts/docs-check.js
---

# fankeel-verify

Produces evidence, not confidence.

## The iron law

```
NO COMPLETION CLAIM WITHOUT FRESH VERIFICATION EVIDENCE
```

**If you have not run the verification command in this message, you cannot claim
it passes.** Violating the letter of this is violating the spirit of it.

Before any claim:

1. **Identify** the command that proves it.
2. **Run** it in full — fresh, complete, not a subset.
3. **Read** the whole output, the exit code, the failure count.
4. **Check** the output actually confirms the claim.
5. **Only then** say so, with the evidence.

Skipping any step is not verifying.

## What each claim requires

| Claim | Requires | Not sufficient |
|---|---|---|
| Tests pass | the test command's output, 0 failures | a previous run, "should pass" |
| Linter clean | the linter's output, 0 errors | a partial check, extrapolation |
| Build succeeds | the build command, exit 0 | the linter passing, logs looking fine |
| Bug fixed | the original symptom retested | the code changed |
| Regression test works | red-green verified: revert the fix, watch it fail, restore | it passes once |
| An agent finished | the VCS diff | the agent's report |
| Requirements met | line by line against the plan | tests passing |

## Red flags — stop

"should", "probably", "seems to". Any expression of satisfaction before the
command has run — "Great", "Perfect", "Done". Committing or opening a PR without
verifying. Trusting an agent's success report. "Just this once." Being tired and
wanting the work over.

Rewording does not exempt you. Any phrasing that implies success without a run is
the same violation.

## Documentation verification

The step with no counterpart anywhere else, and the reason half-verified changes
ship:

```
node <plugin>/scripts/docs-check.js [--root <dir>]
```

That catches references that no longer resolve. Then ask the question no scanner
can: **which page does this change make false?**

A renamed export, a changed default, a removed flag, a moved file — each has a
page somewhere that still says the old thing, and every reference in it still
resolves. Name the page and the line.

A change that is correct and leaves three pages describing the old behaviour has
been half verified.

**This stage is where both halves of the delegation rule are visible at once.**

The suite is the case *against* dispatching. Its output is machine-shaped: 50,434
characters — measured 2026-08-26, 640 tests — where two lines decide it, and `| grep -E '^ℹ (pass|fail)'` removes the
rest for nothing. A subagent there would read all of it in a context that gets
thrown away and charge a system prompt for the privilege.

The question above it is the case *for*. "Which page does this change make false"
is judgement over pages nothing can grep — wide reading, narrow answer. Dispatch
it: one reader per page the change plausibly touched, several in one response so
they run at once — four is the ceiling, and the fankeel skill's *Delegate the
reading, never the filtering* says why — each given the **path** to a diff file
and asked only what is now false and where. Never a pasted diff: it lands the
whole change in this context, which is the cost dispatching exists to avoid.
Pass the model explicitly; `sonnet` is the floor.

What you do not dispatch is this stage. The evidence table, the red-green
discipline and the gate stay here — a subagent has none of these rules.

## Half-built sends it back

Verify is not where the bar gets lowered. Anything unfinished returns to `build`.

## Output

```
$ <command>
<the line that decided it>
```

```
- <what you claimed> — held / did not hold
- docs: <page:line that is now false, or "none">
then AskUserQuestion
```

Filter the run. Never paste 50,434 characters to report 24 — measured 2026-08-26,
640 tests. Re-measure it rather than carrying it forward; a growing suite moves it
every release.
