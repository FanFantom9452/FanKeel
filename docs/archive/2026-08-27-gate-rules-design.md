---
status: archived
last_verified: 2026-08-27
source_of_truth: lib/stages.js, lib/render.js, skills/fankeel/SKILL.md
---

# Option one is substituted, option two is stated

**Goal:** settle three contradictions the injected rules have carried across at
least two releases, by making the gate rule read the function that already
answers it.

The first version of this page was written before `init` landed and was never
built. This one replaces it: every anchor was re-verified on 2026-08-27 against
the tree as it stands, and the survey behind it found two things the first
version did not know — that `audit` has a gate of its own, and that the fix fits
under the existing cap rather than needing a fourth raise.

## The one sentence

**Option one varies with the route, so it is substituted. Option two does not,
so it is stated.**

`build`'s option one is `verify`; `land`'s is standing the task down; `audit` as
a stage on a route offers `land`, and `/fankeel-audit` standing alone offers
nothing, because there is no route. One fact decides all four: whether a next
stage exists.

Option two is the same everywhere. At `land` it is starting a new task, which
`skills/fankeel/SKILL.md:341-342` already calls "a decision rather than a
transition". At `audit` it is fixing only the defects. Both are decisions. What
option two is never is work the writer has not finished.

## The three, re-verified today

**(a) `step` carries two definitions.** `lib/stages.js:76` ALWAYS[0] says "Never
end a step silently or in prose", while `skills/fankeel-plan/SKILL.md:137` heads
a section "Steps are two to five minutes" — there a step is one plan task. Read
that way `build` owes a gate every two to five minutes, which is the one gate it
is defined not to have: `skills/fankeel-build/SKILL.md:12` says "This stage does
not stop at a question until it is done", and `lib/stages.js:210` lists the four
things that stop the loop, none of them the end of a step. `lib/stages.js:12-15`
has recorded the contradiction in a comment since `160f757` without resolving it,
and `lib/stages.js:222` — build's own output template — still ends
`then AskUserQuestion`.

**(b) The option-two rule is in the read-once layer.**
`skills/fankeel/SKILL.md:311` says option two's description "says what is still
open". Nothing in `lib/stages.js` says what option two must contain — ALWAYS[0]
specifies only option one. A stage skill is read once on entering the stage; the
injected rules ride every prompt and every answered question. Measured: a grep of
`tests/*.js` for `option 2`, `option two` and `still open` returns **nothing**.
The rule that actually governs is unwritten and unpinned.

**(c) "Still open" reads two ways.** Either an open decision the user must make,
or work the writer did not finish. The pipeline already instantiates both, in two
different output templates: `lib/stages.js:178` `unverified: <the one thing you
have not checked>` is a fact not yet read, and `lib/stages.js:292`
`open: <what is still not done>` is work not yet done. Nothing says which one the
gate's "still open" means. Observed live on 2026-08-27: an option two listing
three unread documents, none of which was a real gap, while the scanner's own
`skipped:` line was naming two that were.

## What the survey added

**`audit` has a gate the main table does not describe.**
`skills/fankeel-audit/SKILL.md:230-232` offers "do the cleanup / fix only the
defects / report only" — not "next stage / stay / pause". It arrived with
`33821fb`, whose message argues at length for the skill and says nothing about
the gate's shape, and no decision record covers it. Worse, that page never
distinguishes running as a stage on a route from running as `/fankeel-audit`
standing alone, so the stage case silently loses its advance option.

**`land`'s divergence is the opposite: argued, recorded, and structural.**
`docs/decisions/fankeel-shell.md:233` and commit `d00632d` both give the reason —
"Where the route ends there is no next stage to offer". It is not an exception to
be removed; it is the general rule showing through.

**The other five stages are clean.** A reader swept `survey`, `design`, `plan`,
`build` and `verify` — their skills, their injected `rules` and their `template`
strings — for any divergence from the main table. Only `build` diverges, and its
divergence is (a), not a fourth gate shape.

**`nextStage` already exists and nothing calls it.** `lib/stages.js:411`, exported
at `:451`, its own comment stating the rule: "The stage after this one along the
route, or null at the end. `land` has no successor by construction". It is pinned
by `tests/route.test.js:58` and `tests/stages.test.js:163`. A grep for callers
returns tests and nothing else — one of the 32 dead exports `TODO.md` records.
`lib/render.js:77` already computes the route when it builds the block.

**What decides advancement is not `nextStage` and must not become it.**
`scripts/task.js` `cmdStage` validates with `stageByName(name)` and
`route.includes(name)` — membership, not adjacency. From `survey`,
`task.js stage land` succeeds. That is deliberate: the main skill says "Short
tasks may skip forward — a one-line typo fix does not need a design stage". This
design changes what the gate **offers**, never what advancement is **legal**.

## The approach

Add a render-time token. ALWAYS[0] stops describing what option one is and says
what it is, for this stage on this route.

```
Never end a stage silently or in prose. Ask with AskUserQuestion — three at
least, never dropping the pause. Option one is the approval: {{NEXT}}. Option
two names the open decision, never unfinished work.
```

`{{NEXT}}` renders as the next stage's bare name — `verify`, not backticked and
not capitalised — or as the phrase `standing the task down` where `nextStage`
returns null. The measurements below assume the bare form; anything longer eats
the margin it buys.

| file | change |
|---|---|
| `lib/stages.js` `TOKENS` | split into script tokens and render-time tokens. `{{NEXT}}` is the first of the second kind: it is not a path, and its value differs per stage |
| `lib/stages.js` ALWAYS[0] | `step` becomes `stage`; option one becomes `{{NEXT}}`; the option-two sentence is appended |
| `lib/stages.js` ALWAYS[1] | gives up `beside the option it belongs to,` — it restates `in the option descriptions`, three words earlier in the same sentence. `Recommended option first.` stays: it restates nothing |
| `lib/stages.js:12-15` | the comment stops recording an open contradiction and records how it was settled |
| `lib/render.js` `rulesLines` | passes `next: nextStage(data.stage, data.route) \|\| 'standing the task down'` alongside `SCRIPTS`. `render` and `renderResume` both go through it, so `hooks/resume.js` needs no change |
| `skills/fankeel/SKILL.md:311` | option two's row: names the decision still open, never work you have not finished |
| `skills/fankeel/SKILL.md:341` | `land` is rewritten as an instance of the rule rather than an exception to it |
| `skills/fankeel-audit/SKILL.md:230-232` | its three are labelled the standalone shape; as a stage on a route, option one is the next stage |
| `skills/fankeel-build/SKILL.md:12` | gains "Its gate is the end of the stage, not the end of a task: the loop runs every task the ledger lists open, then asks once" |
| `output-styles/fankeel-pipeline.md:33` | "Every completed step ends by asking" becomes "Stopping means asking" — the last copy of the ambiguous word in the style layer |
| `docs/pipeline.md:121-124`, `:204-207` | the two verbatim copies of ALWAYS. Both blocks are deliberately identical — the second exists to show that `hooks/resume.js` restates the same rules — so both move together |
| `docs/pipeline.md:224-225` | the character figures, which this change moves |
| `README.md:96-104` | the gate mermaid gains the branch where there is no next stage |
| `tests/render.test.js:220` | the token-completeness test covers both kinds rather than asserting every token has a script |
| `tests/stages.test.js:206` | repinned to `/never end a stage silently or in prose/` |
| `tests/stages.test.js` (new) | option two pinned to the injected copy; `{{NEXT}}` never reaches the rendered block |
| `tests/render.test.js` (new) | ALWAYS appears verbatim in `docs/pipeline.md`, twice — modelled on `tests/docs-audit.test.js:267`, which pins a prose claim to the source that decides it |

## The cap, and why it does not move

`tests/render.test.js:345-357` states the repository's own rule: 2400 "should be
the last" raise, and "a stage now has to displace a rule to gain one". Measured
today at the 59-character reference root:

```
build 2391   audit 2385   plan 2381   survey 2380
design 2120  land 1899    verify 1893  init 1161      cap 2400
```

Nine characters of headroom on `build`. Three descriptive rewrites were measured
against it:

| candidate | ALWAYS[1] | `build` would be |
|---|---|---|
| spells out the rule in full | keep | 2483 |
| shorter, cuts one redundant clause | cut one | 2450 |
| shortest, cuts two | cut two | 2395 |

Only the last fits, and only by giving up `Recommended option first.` — a rule,
not a redundancy — and by rephrasing the pause clause in a way that breaks
`tests/stages.test.js:219`.

The token costs less than any of them, because a substituted stage name is
shorter than a sentence describing how to find it:

```
survey 2380 -> 2371    plan  2381 -> 2371    build 2391 -> 2382
design 2120 -> 2109    audit 2385 -> 2374    verify 1893 -> 1883
land   1899 -> 1906    (the fallback string is the longest substitution)
```

Six of seven stages get cheaper. The worst case moves from 2391 to 2382, leaving
eighteen characters where there were nine. **The cap does not move, and no rule
is displaced.**

## Proves it done

Three assertions that fail against today's tree and pass after:

1. `/never end a stage silently or in prose/` against `ALWAYS.join(' ')` — today
   it says `step`.
2. The rendered `build` block contains `Option one is the approval: verify`, and
   contains no `{{`. Today ALWAYS names no stage at all.
3. The rendered `land` block contains `standing the task down`.

Plus one that passes today and is the point of adding it: ALWAYS appears verbatim
in `docs/pipeline.md` twice. It goes red the first time someone edits a rule
without editing the page.

Full suite green — 672 tests today.

## What was rejected

| approach | why it lost |
|---|---|
| describe the rule in ALWAYS instead of substituting it | measured at 2450–2483; the one variant that fits costs a real rule and breaks an assertion. And it leaves `nextStage` dead, which is the function that already knows the answer |
| raise the cap to 2500 and write the longer rule | the repository's own comment says the number is set before the rule that needs it, not raised afterwards to fit one already written. Nothing here needs the room |
| put the gate rule in each stage's own `rules` array | seven copies to maintain, and each stage pays the same per-injection cost as ALWAYS does. Worse on both axes |
| fix `skills/fankeel-audit/SKILL.md` alone, leaving ALWAYS untouched | cheap and local, but `land` and `audit` stay two unrelated exceptions and the injected layer still says nothing about option two — defect (b) survives intact |
| make `nextStage` decide which stage changes are legal | breaks the documented skip-forward. That is a feature being removed as though it were a bug |

`skills/fankeel-plan/SKILL.md:137` is deliberately untouched. After this, `step`
means one plan task everywhere, and the gate rules stop using the word.

## What is still open

- ~~`docs/pipeline.md:224-225`'s two character figures.~~ Settled in Task 3.
  Measured `renderResume` at the 59-character reference root, each class over its
  own route: the block that page shows is 2356 and the range is 1857 to 2369,
  against the 2363 and "1867 to 2378" it carried. Both are now rounded and dated
  rather than replaced with two fresh exact numbers, because nothing pins them —
  the review of Task 3 corrected the reasoning, which had leaned on a
  `scripts/survey.js` precedent whose figure rotted from any test added anywhere,
  where this one moves only when a rule in `lib/stages.js` changes.
- `README.md` and `TODO.md` are the two pages the map lists as undeclared, dated
  by git rather than by anyone reading them. This change reads `README.md` and
  edits it; whether it should gain frontmatter is a separate question.
- Nothing reads this repository's own `README.md` in a test. Its gate diagram and
  its report example are both unguarded; the second is already wrong and is
  recorded in `TODO.md` rather than fixed here.
- `output-styles/fankeel-pipeline.md:115`, `output-styles/fankeel-terse.md:46` and
  ALWAYS[2] itself all say a skipped step. Under this change that reads as a
  skipped plan task, which in `build` is a real and reportable thing — so the
  phrase narrows rather than breaks, and none of the three is touched here. Worth
  a second look if `step` ever needs to mean something else again.
