---
status: current
---

# TODO 全表盤點 10-19 第三輪 — design

The third patrol of 10-19. The user asked for wide coverage, so this round
builds every Ready entry, plus the two Needs-a-decision entries
the user settled in design. Decisions taken at the design stage, in the
user's words where they chose:

- suite lock: record the holder's last output time; staleness reads it.
- judge readers: foreground, in both `fankeel-judge` and `fankeel-brain`.
- two-candidate trial: run once, on the verification map's location — done
  at this design stage; the user agreed with the judge's pick (A).
- retro and rule table: both; the retro reviewer runs only when the user says so.
- memory comparison: every item it picks is built this round.

Blocked entries are restamped 2026-10-19; none of their conditions holds.

## 1. Test title — registry numbering

- `tests/registry.test.js:1129`'s title states the rule `lib/registry.js:875-889` now implements — numbering per stage and lap through `groupSeq` — and its assertions are untouched.

Proves it done: the title no longer says "group 1 is free again once lap 1's only mark clears"; `node --test tests/registry.test.js` green.

## 2. Skill slimming

- `skills/fankeel/SKILL.md` drops from 76,998 B to at most 65,448 B and `skills/fankeel-build/SKILL.md` from 47,557 B to at most 40,423 B, by moving reason-only paragraphs to the `docs/90-agent/reference/` page each section already points at as its long form. No rule is deleted.
- `tests/skill-size.test.js:12-13` CAPS drop to just above the new sizes in the same commit.

Proves it done: `node scripts/input-check.js --skills` shows both under target; the lowered CAPS fail against the old files and pass against the new ones; `skills-check` green.

## 3. History lens for survey

- `skills/fankeel-survey/SKILL.md` gains a history lens for the `architectural` class: a reader running `git log -S`, `git blame` and commit text over the files the scan named, returning per finding the commit, the `path:line`, and one of five tiers — Direct, Supported, Inferred, Speculative, Unknown — and a closing list of what git cannot show.
- The tiers live in the history-lens brief only; `agents/fankeel-reader.md`'s return shape (EXTRACTED / INFERRED) is unchanged, because it governs every dispatch.

Proves it done: a test over `skills/fankeel-survey/SKILL.md` finds the lens, its five tiers and the unknowns list; `skills-check` green.

## 4. Judge and brain readers in the foreground

- `agents/fankeel-judge.md:31` says every reader goes out with `run_in_background: false`, all in one response, so each result returns to the judge as a tool result rather than as a hand-back routed elsewhere.
- `agents/fankeel-brain.md`'s reader dispatch says the same.
- `docs/90-agent/reference/subagents.md` (the hand-back section near :614) records why: a background reader's hand-back reached the top session, not the judge, on 2026-10-19.

Proves it done: a test in `tests/judge.test.js` fails on today's judge file and passes after; the same for the brain file. Evidence so far: the design-stage judge sent six foreground readers and all six returned to it. Still to prove at verify: a background `/fankeel-ask` judge with foreground readers.

## 5. Suite lock records last output

- The lock record in `lib/suitelock.js` (:103) gains `out`, the time the holder's suite last printed, refreshed at most every 30 s.
- Staleness reads the newer of `at` and `out`, so a live suite past 60 min is not taken over and a suite asleep through a lid-close is judged by when it last printed.
- The waiter's line (`scripts/suite.js:36-40`) says how long ago the holder last printed.

Proves it done: tests in `tests/suitelock.test.js` — a lock with old `at` and fresh `out` is not stale; one with both old is; the waiter line carries the age — fail now, pass after. Unverified: whether `scripts/suite.js` already sees the child's output; if not, it pipes it through.

## 6. Rule-to-enforcement table

- A new reference page `docs/90-agent/reference/enforcement.md`, beside `registry.md`, lists every injected rule in `lib/stages.js` (`ALWAYS` and each stage's `rules`) with the hook or script that enforces it, or `none — prose only`.

Proves it done: a test reads `lib/stages.js` and fails when a rule has no row; `docs-check` green.

## 7. Retro reviewer at land

- A new agent `agents/fankeel-retro.md`, modelled on `agents/fankeel-slimmer.md`, reads this session's transcript through `scripts/conversation.js` and returns a diff proposing skill or `CLAUDE.md` edits. It writes nothing.
- `skills/fankeel-land/SKILL.md` step 4 offers it, and runs it only when the user says yes.
- `lib/stages.js:729` lists it among land's agents.

Proves it done: the stage-agent list test fails without the entry and passes with it; `skills-check` green.

## 8. Memory rules

- `docs/90-agent/reports/2026-10-19-memory-vs-pstack.md` sets the four recommendations of `judgements/2026-10-18-tencentdb-agent-memory.md` beside the pstack ones, marking overlap, conflict and priority.
- `agents/fankeel-slimmer.md` caps MEMORY.md at 20 entries, merge first, and refuses to remove more than one third of the memory files in one run.
- `skills/fankeel-land/SKILL.md`'s durable-facts step decides store, update, merge or skip, and names the four kinds never stored.
- `scripts/input-check.js` reports the MEMORY.md entry count against the cap.
- `scripts/memory-check.js` reports near-duplicate memory files and follows `[[name]]` links.

Proves it done: tests in `tests/input-check.test.js` and `tests/memory-check.test.js` — the count line, a near-duplicate pair, a `[[name]]` link — fail now and pass after.

## 9. Per-feature verification map, first slice

- `.fankeel/verify/README.md` states the format and `.fankeel/verify/station.md` is its first entry: frontmatter `kind: page | cli | hook`, `src`, and for a page `render:` naming render.json pages instead of re-declaring `src`; sections Sub-features, Reach, Drive, Gotchas, Doctor.
- `scripts/verify-map.js` lints the directory and only warns.
- `.fankeel/docs.json` gives `.fankeel/verify` a bucket.
- `skills/fankeel-verify/SKILL.md` has the verifier cite the feature file when one covers the changed `src`, matched through `pagesTouched` (`lib/shots.js:87`).
- `skills/fankeel-audit/SKILL.md` adds a reader reconciling each feature file against its source: clean, changed or blocked. The live pass is a TODO.

Proves it done: `tests/verify-map.test.js` — a well-formed file passes, a missing section warns — fails now and passes after; `docs-check` green with the new bucket.

## 10. The two-candidate trial, written up

- `docs/90-agent/reports/2026-10-19-two-candidate-trial.md` records the trial: two opus sketches (57k and 61k tokens), a fable judge (41k plus six readers), the pick (A), the user agreeing, and what B contributed.
- The two-candidate entry closes on that report; whether to make it a standing step for `architectural` is a new decision entry only if the report argues for it.

Proves it done: the report exists, `todo-check` green after the entry closes.
