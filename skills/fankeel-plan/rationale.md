---
status: current
last_verified: 2026-09-05
source_of_truth: lib/stages.js, scripts/map.js, skills/fankeel-plan/SKILL.md
---

# fankeel-plan — why

The reasons behind the rules in [SKILL.md](SKILL.md), under the same headings.
Read the skill for what to do; read this when a rule looks wrong and you want
to know what it cost to learn it.

## Global Constraints is generated, not remembered

Every task's requirements implicitly include this section, which is why a
constraint missing from it never reaches the work.

The failure this replaces: a person copying what they remembered out of a spec,
so anything true of the project but absent from the spec never arrives.

## Task right-sizing

`lib/plantasks.js` matches that line and nothing else — the number, then a
colon. A dash or an em dash in place of the colon parses as prose, so the task
is not in the plan at all as far as every tool downstream is concerned. `init`
says so, naming the file and showing a conforming heading, and it is the only
one that says so early: `show` reads the ledger and never the plan, so over a
plan holding no tasks it still answers `complete: nothing yet` and tells you to
resume at the first task not listed. `groups` is what is left for whoever did
not read what `init` printed.

This block is what decides whether two tasks may be implemented at the same
time, and it is what the parent stages when the task lands. A path missing from
it is a file nobody may write.

So a `**Files:**` block left off does not merely fail this stage's own rule — it
serialises that task against every other, because a task declaring no files
conflicts with all of them. And a `Consumes:` written as prose rather than as a
backticked identifier declares nothing for another task's `Produces:` to match,
which downgrades its whole group from `workflow` to `agents`: `conflict()` fails
open by design, and a group it could not confirm is not one to spend a Workflow
on. Both are silent from inside this stage. `groups` names them, and it is the
last place before the work goes out that anyone sees them.

An `in-session` task announces nothing: nothing goes out, so there is no spend
to disclose.
