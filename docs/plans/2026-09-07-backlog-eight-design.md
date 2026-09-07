---
status: design-intent
last_verified: 2026-09-07
source_of_truth: scripts/docs-check.js, scripts/todo-check.js, scripts/docs-audit.js, skills/fankeel/SKILL.md
---

# Eight backlog entries — 2026-09-07

Three `## Ready` measurements and five `## Needs a decision` entries, taken
together because six of the eight are one or two lines each and the two that are
not share a question: what is a document allowed to claim about code.

## What the measurements returned

Two of the three Ready entries close on evidence, with no code change. They are
recorded here and written up in `docs/reports/2026-09-07-audit-constants.md`.

**`LANDED_QUIET = 3` re-measures to 3.** The constant was picked from 8 plans
inside a 0–4 day band. Seven more plans landed between 09-01 and 09-06; six are
usable (`2026-09-06-waiting-lifts-when.md` was written straight into
`docs/archive` and never sat in `docs/plans`). The gap between a plan's last
content commit and its archiving commit:

| plan | last edit | archived | gap |
|---|---|---|---|
| `2026-08-30-tracked-concurrency` | 08-31 | 09-03 | 3 |
| `2026-08-31-todo-waiting-backlog` | 08-31 | 09-04 | 4 |
| `2026-09-01-six-decisions` | 09-01 | 09-05 | 4 |
| `2026-09-01-stage-timing` | 09-01 | 09-04 | 3 |
| `2026-09-01-stage-units` | 09-01 | 09-04 | 3 |
| `2026-09-04-ready-and-decisions` | 09-04 | 09-04 | 0 |

Same 0–4 band, mode 3. The constant stands.

The measurement has one trap worth recording, because it caught this design
first: `git log -1 -- docs/plans/X.md` returns the *archiving* commit, since a
rename touches the old path. Read that way every gap is 0 and the band looks
like it collapsed. The gaps above come from the second-newest commit on that
path.

**`LANDMARK = 4` earns its output, seven times over.** Running `docs-audit` with
the constant raised out of reach gives **102 pairs**; shipped, it gives **31**.
It suppresses 71. The entry also asked whether the pairs section earns its own
output: of 8 pairs read, 0 held a factual disagreement and 3 restated what a
neighbour owns — and those 3 are entries D1, D2 and D3 below. A section that
generated three of the eight items in this plan has earned it.

**Whether an output style reaches a subagent stays open, and stays blocked.** No
`outputStyle` is set in `~/.claude/settings.json`, `.claude/settings.json` or
`.claude/settings.local.json`. A style lives in the system prompt
(`docs/output-styles.md:33-45`) and nothing in this repository reads one
(`docs/output-styles.md:79` — "a hook cannot see which one is active"). Setting
one is the user's to do, which is what the 09-07 design gate already concluded
at `docs/plans/2026-09-07-ready-fourteen.md:892-894`. The entry stays under
`## Ready` untouched.

## The contested one: a citation that drifted

`docs/decisions/fankeel-shell.md:416-448`, decided 2026-09-05, says `docs-check`
deliberately does **not** report a `path:line` that still resolves but points at
the wrong line. Its reasoning is sound and this design does not dispute it:

> Deciding it needs someone to know what the citation was meant to point at, and
> nothing on disk records that. [...] Every mechanical proxy for that — look for
> a symbol near the line, compare against the last commit that touched both —
> answers a different question and reports on the occasions it disagrees with
> itself.

Both proxies it names were tested against the four incidents the entry was filed
for. **"Look for a symbol near the line" catches 0 of 4** — none of the four
citations names a symbol, and across the repository only 126 of 719 resolved
citations land on a declaration line at all, so that proxy is blind to 82% of
them by construction. Measured at `8587d3c` over every `path:line` span in
`git ls-files "*.md"`, fences included — `checkDoc` binds `withoutFences` to
`linkText` alone, so the span loop reads raw text — with `DECL` as committed, and
a markdown heading not counting, since `declaredSymbols` only builds from
`CODE_EXT` files. 133 of 768 on the branch tip; the pair moves with the day, the
82% does not.

Note the denominator this is *not* about. Those 719 span every role; the
`reference` pages this change actually polices hold eleven. The 82% measures how
far a symbol proxy could reach if it were applied everywhere, which is the claim
the 09-05 section made against it — not the size of the surface below.

What this design proposes is not a third proxy. It removes the decision's
premise. When a reference page writes

    `lib/dirty.js:180` calls `addClaim` per path

the page has itself recorded what the citation was meant to point at. Comparing
`addClaim` against line 180 is not a guess about intent; it is reading the
intent the author wrote down beside it. The decision's boundary — *report what
can be decided mechanically* — is respected, because for a quoted citation this
is mechanical.

**The surface is eleven citations, not 723.** Only the `reference` role must
match the code; `plan` stops being true when it lands, `report` and `decision`
record a moment, and `archive` naming deleted code is the archive working.
Measured across `git ls-files "*.md"`:

| role scope | `path:line` citations | with a quote beside them | quote at cited line | quote elsewhere in file | no match |
|---|---|---|---|---|---|
| every role | 723 | 352 | 53 | 81 | 218 |
| `reference` only | 11 | 4 | 3 | **1** | **0** |

Eleven citations live in four files: `docs/registry.md` (7), `docs/documents.md`
(1), `skills/fankeel-land/SKILL.md` (1), `skills/fankeel-survey/SKILL.md` (2).
One is currently wrong — `docs/registry.md:403` cites `lib/dirty.js:180` for a
call to `addClaim` that is at `:183`. Zero false positives on that set.

All four incidents the entry was filed for were in reference-role pages, so the
check would have caught 4 of 4. One of them has since drifted a second time:
`skills/fankeel-survey/SKILL.md` cited `scripts/task.js:914`, was corrected to
`:929` on 09-05, and now reads `:938`.

### The rule

In a **reference** page, a `path:line` citation followed on the same line by a
code span that is not a path is a *quoted citation*. `docs-check` resolves the
quote against the target file:

- quote is at the cited line — nothing reported.
- quote is not at the cited line but occurs **exactly once** elsewhere in the
  file — report `moved`, naming the line it is actually on. **This fails the
  run**, like `gone` and `past-end`.
- quote occurs more than once, or not at all — report `moved` without a line.
  Ambiguity is reported, never resolved.
- no quote beside the citation — report `unquoted` as **context, not a defect**.
  It does not fail the run.

`unquoted` is deliberately non-failing. Another repository upgrading fankeel must
not have its `land` broken by citations it wrote under the old rule; this
repository's own seven get quotes during the build because they are seven.

## The other four

**`todo-check` `SECTIONS`.** `scripts/todo-check.js:58` is a closed set, and
`:258` pushes an off-convention heading into the same `problems` array as a dead
link, so a repository with its own headings exits 1 with every entry unclassified
— 22 of 22 on the case that filed this. Neither per-project names nor a config
key is needed: the discriminator is already in the data. **Every** entry
unclassified is one fact about the repository, reported once and non-fatal.
**Some** entries unclassified means the repository does use the convention and a
stray heading is a real defect, which keeps failing exactly as it does now.

**D1 — the scope guard.** `skills/fankeel/SKILL.md:977-1013` restates
`docs/collisions.md:96-165` with no deferral, and the file's `source_of_truth`
at `:7` omits `lib/guard.js` although that is what implements it. The section
stays: it is short form the agent needs in context. It gains the deferral
sentence the file already uses at `:129` and `:545`, and the frontmatter gains
`lib/guard.js`.

**D2 — task memory.** `skills/fankeel/SKILL.md:547` restates
`docs/registry.md:59-81` near-verbatim, in a file that defers to that exact page
400 lines earlier at `:129`. One sentence, same idiom.

**D3 — window bucketing.** `docs/station.md:203-205` and
`docs/registry.md:230-231` both say the halves are deleted from `usage` so every
existing reader sees the shape it always had. `registry.md` owns the record
shape and keeps the sentence; `station.md` defers to it. `registry.md:232`
already points forward to `station.md`, so only one side changes.

## Files

| file | change | dispatch |
|---|---|---|
| `scripts/docs-check.js` | quoted-citation check: `moved` (fails) and `unquoted` (context); add both to `ORDER`; reference role only | implementer, sonnet |
| `tests/docs-check.test.js` | first `path:line` fixtures — at-line, moved, ambiguous, unquoted, and a non-reference role that must stay silent | implementer, sonnet |
| `scripts/todo-check.js` | all-unclassified becomes one non-fatal line; some-unclassified keeps failing | implementer, sonnet |
| `tests/todo-check.test.js` | fixtures for both halves of that split | implementer, sonnet |
| `docs/registry.md` | fix `lib/dirty.js:180` to `:183`; quote its other six citations | implementer, sonnet |
| `docs/documents.md`, `skills/fankeel-land/SKILL.md`, `skills/fankeel-survey/SKILL.md` | quote their four citations; `fankeel-survey`'s two are stale again | implementer, sonnet |
| `skills/fankeel/SKILL.md` | `source_of_truth` gains `lib/guard.js`; deferrals added to `## The scope guard` and `## Task memory` | implementer, sonnet |
| `docs/station.md` | `:203-205` defers to `registry.md` instead of restating it | implementer, sonnet |
| `docs/decisions/fankeel-shell.md` | new section: a carried quote is a record, not a proxy — decided 2026-09-07, narrowing the 09-05 boundary | in-session — it reverses a decision, which is not an implementer's call |
| `docs/reports/2026-09-07-audit-constants.md` | new: the two measurements, 繁體中文, `report` role | implementer, sonnet |
| `docs/README.md` | index row for the new report | in-session — one line |
| `TODO.md` | close seven entries; the output-style one stays under `## Ready` | in-session — one edit, one file |

## Proves it done

- `tests/docs-check.test.js` gains a fixture where a reference page cites
  `foo.js:10` and quotes a line living at `foo.js:20`. **Fails now** — today
  `docs-check` reports nothing and exits 0. **Passes after** — one `moved`
  finding naming line 20, exit 1.
- The same fixture under a `plan` role reports nothing, which is what keeps the
  role boundary honest.
- `node scripts/docs-check.js` on this repository reports `docs/registry.md:403`
  before the citation is corrected and exits 0 after it is.
- `tests/todo-check.test.js`: a `TODO.md` whose every entry is under `## Someday`
  exits **0** with one line saying so — it exits 1 today. A `TODO.md` with three
  good headings and one `## Someday` entry still exits 1.
- `node scripts/todo-check.js` and `node scripts/docs-check.js` both exit 0 on
  this repository at the end.
- `npm test` green.

## Unverified

The false-positive rate for `moved` is measured on four quoted citations, all in
this repository. Four is not a sample. The failure mode it cannot rule out is a
cited line whose text is reworded without moving, which would report `moved`
wrongly; `unquoted` being non-failing limits the blast radius, but the rate is
unknown until another repository runs it.
