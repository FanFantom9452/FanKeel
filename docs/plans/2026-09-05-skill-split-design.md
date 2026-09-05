---
status: current
last_verified: 2026-09-05
source_of_truth: skills/fankeel-build/SKILL.md, skills/fankeel-plan/SKILL.md, skills/fankeel-audit/SKILL.md, tests/skills.test.js
---

# Skill split: the procedure stays, the rationale moves

One ask. Three stage skills — `build`, `plan`, `audit` — keep their procedures
and templates in `SKILL.md` and move their rationale to a `rationale.md` beside
it, under the same headings. Nothing a rule says changes; where it is explained
does.

## Why

**A skill is read once on entering a stage; the injected block is re-sent on
every prompt.** Measured 2026-09-04 across all seven stages, twenty-one probes
for a skill-only procedure against its stage's injected rules returned twenty
misses
([2026-09-04-stage-division-design.md §3](2026-09-04-stage-division-design.md)).
The fix that release shipped was anchors in the injected block, and the cheapest
carrier it found was the `Read the fankeel-<stage> skill` pointer line. That
pointer is worth what re-reading the skill costs, and today the skill is mostly
not procedure:

| skill | lines | procedure | template | rationale | share |
|---|---|---|---|---|---|
| build | 458 | 48 | 27 | 375 | 83% |
| plan | 243 | 27 | 87 | 121 | 50% |
| audit | 303 | 106 | 98 | 90 | 30% |
| survey | 266 | 187 | 46 | 25 | 9% |
| design | 128 | 77 | 43 | 0 | — |
| verify | 196 | 138 | 50 | 0 | — |
| land | 184 | 89 | 87 | 0 | — |

Classified section by section on 2026-09-05 by one reader over all seven files,
dominant kind per section, minorities noted; the rows are in the plan. Three
files have something to move. Four do not.

Claude Code's own guidance says the same shape: invoking a skill loads only
`SKILL.md`; supporting files sit beside it and are reached by markdown link when
needed; keep `SKILL.md` under 500 lines
([code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills.md#add-supporting-files)).
`build` is at 458.

**What this buys.** A short `SKILL.md` is one that can be re-read mid-stage for
the cost of its procedures, so the pointer line the injection already carries
points at something cheap. The other half of that — a template slot for each
procedure that is silently skipped — is the next task, not this one: it is a
2400-character trade in each stage and depends on what the pointer line has room
for once this lands.

## What stays in `SKILL.md`

- Every paragraph the classification marked procedure or template, including
  the minorities inside rationale sections — `build`'s task loop steps at
  162–211 are procedure inside a section that is otherwise rationale, and they
  stay.
- The `## Output` fenced block, verbatim. `tests/skills.test.js:289` requires it
  to equal `templateFor(stage)`. Prose after the fence in that section may move.
- Every phrase `tests/skills.test.js` pins. The survey listed them by assertion
  line; the plan carries the list, and each implementer runs
  `node --test tests/skills.test.js` before returning. Several pinned phrases
  sit inside rationale sections — `build`'s "Say what you want back, and why it
  costs" at 391–433 — and those sentences stay where they are.
- **One sentence of why beside each rule that had one — the original's, not a
  new one.** Where a rule is followed by its reason, the first sentence of that
  reason stays and the rest moves; where a rule had no reason written, none is
  written now. Measured in this repository: a reviewer told the return contract
  and its reason returned three lines; one told the contract alone returned
  fifteen (`skills/fankeel/SKILL.md`, *State the return contract, and say what
  it costs*). The reason stays; the measurement that proved it moves.
- The frontmatter, unchanged except `last_verified`.

## What moves to `rationale.md`

Dated measurements, what went wrong in a named session, the history of a rule
("this stage used to say"), comparisons with other tools, worked arithmetic,
and the paragraphs explaining a design choice at length. Section by section,
per the classification rows in the plan.

## The `rationale.md` contract

- **Path:** `skills/fankeel-<stage>/rationale.md`. Not `reference.md`, the name
  the official example uses: `reference` is a role word in this repository
  meaning *must match the code*, and this file is the one kind of page that is
  not that.
- **Frontmatter:** `status: current`, `last_verified`, and `source_of_truth`
  naming the same code files the `SKILL.md` names, then `SKILL.md`. Naming the
  code keeps drift honest — a reason can stop being true when the code moves,
  and `docs-audit` should say so. Naming `SKILL.md` is the deferral that settles
  the pair the two files would otherwise form (`scripts/docs-audit.js`,
  `defers`).
- **No `version:` line.** `scripts/version.js` reads only `SKILL.md` and
  `tests/version.test.js:100` counts eleven rows; a twelfth would fail it.
- **Headings mirror.** Every `##` in `rationale.md` is a `##` that exists in
  its `SKILL.md`, same text. Sub-headings are free. A reader looking for the
  why of a section finds it under the section's own name.
- **One link, in the preamble of `SKILL.md`:** the sentence *Why each rule is
  what it is, under the same headings:* followed by a markdown link whose text
  and target are both `rationale.md`. No per-section links; the mirrored
  headings are the index.
- **Bucket:** the `skills` bucket in `.fankeel/docs.json` has no depth limit,
  so the file is filed as `reference` with nothing to declare. `docs-check`
  resolves its links; `docs-audit` grades it against the code it names.

## Files

| file | change | dispatch |
|---|---|---|
| `tests/skills.test.js` | one test, written first and red: for build, plan, audit — `rationale.md` exists, every `##` in it is in `SKILL.md`, `SKILL.md` links it | in-session — one edit, and it is the test the three implementers run |
| `skills/fankeel-build/SKILL.md` | rationale paragraphs out per the rows; one-line why stays; pins and Output intact | implementer, sonnet |
| `skills/fankeel-build/rationale.md` | new, per the contract | same task as its SKILL.md |
| `skills/fankeel-plan/SKILL.md` | same | implementer, sonnet |
| `skills/fankeel-plan/rationale.md` | new | same task |
| `skills/fankeel-audit/SKILL.md` | same | implementer, sonnet |
| `skills/fankeel-audit/rationale.md` | new | same task |
| `docs/subagents.md`, `docs/pipeline.md`, `docs/decisions/fankeel-shell.md` | re-read at verify; a sentence pointing at content that moved is edited, nothing else | in-session — `grep` for each moved heading over `docs/` is a pipe |
| `docs/README.md` | one row for this page | in-session — one edit |

The three skill tasks share no file and feed nothing to each other, which is
`plan`'s work: `ledger.js groups` decides the surface.

## Proves it done

The new test in `tests/skills.test.js` fails now — no `rationale.md` exists —
and passes after. The rest of the suite stays green throughout, which is what
holds the thirty-five pinned phrases in place. Reported rather than tested:
lines and bytes per `SKILL.md` before and after, so the next task knows what
the pointer line now costs.

## Against the map

Checked `.fankeel/map.md` on 2026-09-05. No page marked current is contradicted:

- `docs/pipeline.md` — *one skill per stage, what only it holds*: the table of
  what each skill holds does not change.
- `docs/subagents.md:52` — *step 5 of the fankeel-build skill says what that
  costs and how half of it is bought back*: the two pinned sentences that say
  it stay in step 5; the measurement behind them moves. Re-read at verify.
- `docs/decisions/fankeel-shell.md:346` — the build skill's `source_of_truth`
  names `lib/ledger.js`: frontmatter unchanged, still true.
- Nothing here is `design-intent` describing something as though it existed:
  `rationale.md` does not exist yet and this page says so.

## Out of scope, and why

- `skills/fankeel/SKILL.md`, 998 lines: the user's call at survey. It is the
  `/fankeel` entry point and carries the rule missed at `:916`; a task of its
  own.
- `survey`: 25 rationale lines of 266, and the 4b minority beside them — under
  the threshold at which a second file is cheaper than the paragraphs.
- `design`, `verify`, `land`: no rationale to move.
- Template slots in `lib/stages.js`: the next task, via `task.js task`.

## Unverified

Whether Claude follows the relative link to `rationale.md` from a skill invoked
out of the plugin cache — the documentation says bundled files are reached by
markdown link, and `${CLAUDE_SKILL_DIR}` exists for scripts, but nothing here
has invoked a split skill yet. Verify checks it by invoking `fankeel-build` and
asking for one fact that lives only in `rationale.md`.
