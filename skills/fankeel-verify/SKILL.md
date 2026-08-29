---
name: fankeel-verify
description: The verify stage — evidence before claims, requirements checked line by line, and the documents this change just made false. Use for the verify stage of a fankeel task, before claiming work is complete or passing, before a commit or PR, or when checking whether a change broke the documentation describing it.
version: 0.39.0
status: current
last_verified: 2026-08-29
source_of_truth: lib/stages.js, scripts/docs-check.js
---

# fankeel-verify

Produces evidence, not confidence.

**Done when** every claim has a row with the evidence beside it, the adversary
has read that table, and `docs-check` has been run. A row that did not hold does
not reopen the stage —
it is a finding, and sending the work back to `build` is a route decision made
at the gate, not another lap around this one.

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

**A coverage claim states its denominator.** Nine pages read of the twenty-one
whose role says they must match the code is nine of twenty-one, not "the pages".
`survey` is already honest this way — it prints what the scanner skipped and why
— and this stage had no counterpart, which is how a documentation pass that read
nine of them reported as though it had read them all.

**This stage is where both halves of the delegation rule are visible at once.**

The suite is the case *against* dispatching. Its output is machine-shaped: about
fifty thousand characters — measured 2026-08-26, rounded because an exact figure
is false again by the next commit that adds a test — where two lines decide it,
and `| grep -E '^ℹ (pass|fail)'` removes the rest for nothing. A subagent there
would read all of it in a context that gets thrown away and charge a system
prompt for the privilege.

The question above it is the case *for*. "Which page does this change make false"
is judgement over pages nothing can grep — wide reading, narrow answer. Dispatch
it: one reader per page the change plausibly touched, several in one response so
they run at once — four is the ceiling, and the fankeel skill's *Dispatch by
default, never the filtering* says why — each given the **path** to a diff file
and asked only what is now false and where. Never a pasted diff: it lands the
whole change in this context, which is the cost dispatching exists to avoid.
Pass the model explicitly; `sonnet` is the floor. Say how many are going and
on which model as they go out — a fan-out the user did not see coming is spend
they were never given the chance to question.

What you do not dispatch is this stage. The evidence table, the red-green
discipline and the gate stay here — a subagent has none of these rules.

## The adversary

**Before the question, one read-only adversary over the evidence.** The reviewer
at `build` reads a diff; this one reads the table above, and it is aimed at the
link between a claim and the evidence beside it rather than at the conclusion.

- **Was it run?** Not read, not remembered, not carried over from an earlier run.
- **On what?** The thing the claim is about, not a smaller thing beside it.
- **Could it have failed?** A check with no path to a negative is not evidence.
- **Out of what?** The denominator above.

It gets **paths, never a paste**, and is asked only for the rows it defeats — say
why, because every line it returns lands here and is re-read on every later turn.

It **reads the method rather than probing it.** Red-green belongs to this session
and is already in the table above, and an adversary that mutates the tree cannot
run beside anything else. Where the method does not say whether a check could have
failed, that is itself the finding: say so rather than guess.

A defeated row is a **ruling, not an automatic return to `build`** — the same
standing the per-task reviewer's findings have.

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
- adversary: <the claim it defeated, or "nothing">
then AskUserQuestion
```

Filter the run. Never paste some fifty thousand characters to report twenty-four
— measured 2026-08-26, and stated rounded because a suite that grows falsifies an
exact figure with the next test anyone adds.
