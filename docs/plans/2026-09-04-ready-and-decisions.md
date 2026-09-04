---
status: current
last_verified: 2026-09-04
source_of_truth: the eleven tasks landed as commits on todo-ready-and-decisions; the ledger at .fankeel/build/2026-09-04-ready-and-decisions/progress.md holds the ranges and the rulings
---

# Ready Backlog and Three Decisions Implementation Plan

**Goal:** close every `## Ready` entry and the three settled `## Needs a decision`
entries in `TODO.md`, and record one measurement the repository has argued from
without ever taking.

**Architecture:** one rule decides every numeric fix — **a number stays in prose
only where something prints it.** `2393` is printed by `tests/render.test.js`, so
it stays and the sentence gains a pointer to what prints it; `2808`, `seventeen
of the nineteen` and the file counts in `docs/README.md` are printed by nothing,
so they become descriptions. The three decisions are settled without changing any
behaviour: the `orphan` guard is deliberate and stays, the dispatch evidence is
copied into the repository *without editing the reports that cite it*, and
`build`'s chain does not become a workflow. One new report records the wake-up
measurement.

**Tech Stack:** Node's built-in test runner only (`package.json` declares
`"test": "node --test"` and **no dependencies at all** — the repository has none
and none may be added). Plain CommonJS, as every file in `lib/` and `scripts/`
already is.

**Spec:** in chat, this session. There is no spec file — the route was set by hand
with `task.js route`, not by `--class architectural`, so `design` produced an
approach and a file table rather than a document.

## Global Constraints

Generated from this project on 2026-09-04, at `4e5b600`.

- **No `CLAUDE.md` and no `AGENTS.md` exist in this repository.** Conventions come
  from `README.md`, from `.fankeel/map.md`, and from the code. Do not invent one.
- **`package.json` has no `dependencies` and no `devDependencies` key at all.**
  Adding either is out of scope for every task below. The only script is
  `"test": "node --test"`.
- **`.gitattributes` is `* text=auto eol=lf`.** Write LF line endings. A file
  rewritten with CRLF shows as wholly changed in the diff.
- **Filing, from `.fankeel/docs.json`:** index is `docs/README.md`; buckets are
  `docs` (`reference`, `depth: 1`), `docs/decisions` (`decision`), `docs/plans`
  (`plan`), `docs/reports` (`report`), `docs/archive` (`archive`), `skills`
  (`reference`), `output-styles` (`reference`).
- **`docs/reports` holds role `report`: a dated snapshot, never edited after.**
  The four files already in it —
  `2026-09-02-process-state-review.md`,
  `2026-09-03-dispatch-vs-inline.md`,
  `2026-09-03-dispatch-vs-inline-named.md`,
  `2026-09-03-dispatch-vs-inline-join.md` and
  `2026-09-04-chains-as-workflows.md` — **must not be modified by any task in
  this plan.** Where one of them is wrong, the correction goes to a `reference`
  page instead. This constraint is the reason Task 8 copies files rather than
  editing citations.
- **`lib/docs.js:183-185` applies a bucket's `depth` only when the bucket
  declares one.** `docs/reports` declares none, so it takes everything beneath it
  recursively — but `lib/docs.js` files markdown only, so the non-markdown
  evidence added by Task 8 is filed by nothing and reported by nothing.
- **Registry caps, `lib/registry.js`:** `MAX_NOTES = 5` (:33),
  `MAX_NOTE_LEN = 100` (:34), `MAX_NEXT_LEN = 120` (:35), `MAX_CLAIMS = 60`
  (:45). Task 6 quotes the first of these and must copy the value, not restate it.
- **`TODO.md` has exactly three headings** — `## Ready`, `## Needs a decision`,
  `## Waiting` — and every `## Waiting` entry ends with an `MM-DD` stamp.
  `node scripts/todo-check.js` enforces both.
- **A plan is `status: design-intent` while it runs**, becomes `status: current`
  when the work lands, and is archived after that.
- **Commit style is Conventional Commits**, lowercase type, no scope, the subject
  carrying a clause after an em dash or a semicolon. Recent subjects:
  `docs: adopt also deactivates; registry.md declares the three files it now describes`,
  `feat: a session's own agents count in its usage`.
- **Green at land:** `npm test`, `node scripts/docs-check.js`,
  `node scripts/todo-check.js`. Judge each on an unpiped run — a pipe swallows the
  exit code.

## File structure

| File | Responsibility after this plan |
|---|---|
| `docs/README.md` | the index, and a Roles table that names every bucket `docs.json` declares |
| `tests/docs.test.js` | gains the case that ties the Roles table to `docs.json` |
| `docs/pipeline.md` | the pipeline, with no figure nothing prints |
| `docs/registry.md` | the registry, with the injection figure pointing at what prints it |
| `tests/render.test.js` | unchanged behaviour; one comment stops naming a removed feature |
| `skills/fankeel-design/SKILL.md` | one approach, agreeing with its own line 16 |
| `skills/fankeel-build/SKILL.md` | the brief, the fifth round's end, and why the chain is not a workflow |
| `skills/fankeel-verify/SKILL.md` | the reviewer brief, with the pre-judgement rule |
| `skills/fankeel-land/SKILL.md` | the notes table, with the cap that silently drops the sixth |
| `docs/documents.md` | the roles, and the first written account of `orphan` |
| `docs/reports/evidence/2026-09-03-dispatch-vs-inline/` | the raw evidence three reports cite by bare filename |
| `docs/reports/2026-09-04-agent-wakeups.md` | the new dated snapshot |
| `docs/subagents.md` | the run journal's real shape, and a pointer to the new report |
| `TODO.md` | the entries this plan did not close |

## Ordering

Tasks 1 through 8 share no file and may run at once. Task 9 waits for Task 1 —
both write `docs/README.md`. Task 10 waits for Task 9 — it links to the file Task
9 creates. Task 11 runs beside Task 10: the entries it deletes are owned by Tasks 1
through 8, and Tasks 9 and 10 close no `TODO.md` entry at all. `ledger.js groups`
reads this decomposition and returns three groups — 1-8, then 9, then 10 and 11.

---

## Task 1: the Roles table stops omitting two buckets

`docs/README.md` claims every page it lists is `reference`, and its Roles table
names only four of the seven buckets `.fankeel/docs.json` declares. The two
missing buckets are `skills` (9 files) and `output-styles` (3 files). The claim
is false in the other direction too: the index links plans, reports and a
decision record above that sentence.

**Files:**
- Modify: `docs/README.md` — correct the sentence at :68, add two rows to the Roles table at :72-79
- Test: `tests/docs.test.js`

Read `docs/README.md:60-80` first; the exact table formatting is there and must be
matched rather than guessed.

1. Write the failing test first. Add to `tests/docs.test.js`:

```js
test('the index Roles table names every bucket docs.json declares', () => {
    const root = path.join(__dirname, '..');
    const declared = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'docs.json'), 'utf8'));
    const index = fs.readFileSync(path.join(root, 'docs', 'README.md'), 'utf8');
    const missing = declared.buckets
        .map((b) => b.path)
        .filter((p) => !index.includes('`' + p + '`'));
    assert.deepStrictEqual(missing, [], 'buckets absent from the index: ' + missing.join(', '));
});
```

   Match the file's existing `require` block rather than adding new ones — check
   what `tests/docs.test.js` already imports at the top, and add only what is
   missing.

2. Run `node --test tests/docs.test.js` and watch it fail, naming `skills` and
   `output-styles`.

3. Add a row for each to the Roles table, in the order `docs.json` lists them, both
   with role `reference`, wording their "what it is" cell in the voice of the rows
   already there.

4. Replace the sentence at :68. It currently claims that every page listed above
   carries the role `reference`. It must instead say that each page carries the role of
   whichever bucket they sit in, and that the table below is the list. Do not
   state a file count anywhere: nothing prints one, so it goes stale silently.

5. Run `node --test tests/docs.test.js` and watch it pass. Then
   `node scripts/docs-check.js` — unpiped.

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/README.md` with a complete Roles table. Task 9 appends one index
  entry to this same file and must not disturb the table.

**Dispatch:** in-session — this task is the plan's success criterion, and the red
run has to be on screen before the green one; a dispatch would return only the
claim that both happened.

---

## Task 2: the four figures and phrases nothing prints

Five known-value replacements across three files, each verified this session
against what actually prints the number.

**Files:**
- Modify: `docs/pipeline.md` — :145, :731-733, :861
- Modify: `docs/registry.md` — :187-188
- Modify: `tests/render.test.js` — :461
- Test: none — this task writes no test file.

1. `docs/registry.md:187-188` currently reads `capped at 2400 characters and
   renders \`build\` at 2394.` Run `node --test tests/render.test.js` and read
   the line it prints: `ℹ build  2393 chars at a 59-char root  (2350 here)`.
   Replace `2394` with `2393`, and extend the sentence to name
   `tests/render.test.js` as the thing that prints it, so the next reader re-runs
   rather than trusting the page.

2. `docs/pipeline.md:145` currently reads:

```
which is what keeps a per-turn restatement affordable — 2808
characters, about 700 tokens. That figure is the block above counted as it is
printed, so it is re-measured by counting it again rather than by trusting the
number.
```

   Three readers counted that block this session and got 2808, 2824 and 2864;
   the third could not reproduce the second's number using the second's own line
   span. Delete the character figure and the two sentences instructing a recount.
   Keep `about 700 tokens`, and say in one clause that the figure is rounded
   because nothing prints it — the same reasoning `skills/fankeel/SKILL.md`
   already gives for its own rounded figures.

3. `docs/pipeline.md:731-733` calls a feature's route `all\nsix`. The route has
   seven stages, and :289 of the same file already says `all seven`. Replace it.
   Read the surrounding sentence before editing — the words wrap across lines.

4. `docs/pipeline.md:861` reads `Only the first four sections fail the run —
   pairs, orphans and uncovered directories...`. The four that actually fail are
   drift, landed plans, a broken index and diagrams; `scripts/docs-audit.js:775-784`
   sums exactly those. `pairs` prints fourth in the report but is context, not a
   defect. Rewrite the sentence to name the four by name rather than by print
   order.

5. `tests/render.test.js:461` reads
   `// memory fields full, a second session to report, the voice digest present.`
   The style skill and its digest were removed in 0.20.0
   (`docs/decisions/fankeel-shell.md:178`). Delete the clause
   `, the voice digest present` and leave the rest of the comment. Change no
   assertion — this is a comment only, and the test's behaviour must not move.

6. `npm test`, unpiped. Then `node scripts/docs-check.js`, unpiped.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks read.

**Dispatch:** in-session — every replacement is a known string for a known string,
already quoted above; this is one Edit call each and a dispatch would cost more
than the edits.

---

## Task 3: `design` asks for one approach, not two or three

`skills/fankeel-design/SKILL.md:39` is headed `### 2. Two or three approaches`.
Its own line 16 says `A second approach is a catalogue, not more design`, its
Output section says `One approach, not a catalogue`, and `lib/stages.js:225`
injects `one approach, not a catalogue` into every design turn. The heading is the
only one of the four that disagrees.

**Files:**
- Modify: `skills/fankeel-design/SKILL.md` — the heading at :39 and the paragraph beneath it
- Test: none — this task writes no test file.

1. Read `skills/fankeel-design/SKILL.md:10-50` so the paragraph under the heading
   can be reworded in the file's own voice.
2. Change the heading to name one approach.
3. The paragraph beneath currently opens `With trade-offs. Lead with the
   recommendation and say why.` — that survives a single approach unchanged in
   meaning, but re-read it and adjust any wording that presupposes a set to choose
   from. Keep the `Cut ruthlessly` paragraph exactly as it is; it is about scope,
   not about how many approaches.
4. Do not renumber the other steps, and do not touch step 1 or step 3.
5. `npm test` and `node scripts/docs-check.js`, both unpiped. Note that
   `tests/output-styles.test.js` and `tests/contract.test.js` read skill files;
   if either fails, the heading text is asserted somewhere and that assertion is
   part of this task.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks read.

**Dispatch:** implementer, sonnet — the heading is a known value but the paragraph
under it has to be rewritten in the file's voice, which means reading the section
first; the reading is what a dispatch keeps out of the parent.

---

## Task 4: `build` gains a brief script, an end to round five, and the chain ruling

Three additions to one file, all of them absences rather than errors.

**Files:**
- Modify: `skills/fankeel-build/SKILL.md`
- Test: none — this task writes no test file.

1. Read `skills/fankeel-build/SKILL.md:126-263` — the task loop and
   `## Rulings, not stalls`.

2. **The brief.** At :158-163 the text tells a dispatch to carry `the **path** to
   the plan file with the task's number`, which hands an implementer the whole
   plan. Immediately after that sentence and before :165
   (`A dispatched implementer does not commit`), add a short paragraph proposing
   a `task-brief` script: it writes task N's own text to a file and prints the
   path, so a dispatch carries a path rather than two thousand words. Write it as
   what the loop should do, naming `scripts/` as where such a script would live.
   **Do not write the script** — that is not in this plan's scope, and the TODO
   entry asks for the rule, not the tool.

3. **Round five.** :234 reads `Fix rounds are bounded at **five**. A finding you
   overrule is a ruling, not a silence.` Nothing anywhere says what happens when
   the fifth round ends with findings still open. Add one or two sentences after
   that line saying it: the remaining findings are recorded as rulings with their
   cost, using `ledger.js ruling`, and the task is marked complete with them
   named — a cap that silently drops what it caps is the failure this is
   preventing.

4. **The chain ruling.** In `## Rulings, not stalls` or immediately after the
   loop's step 5, record why `build`'s chain does not become a Workflow while
   `verify`'s did. The reason: steps 4 and 5 put a parent `git commit` between
   the implementer and the reviewer, because the reviewer reviews the pinned
   range `BASE..sha` and that sha does not exist until the parent commits. A
   workflow's hops run inside its script, where the parent cannot commit. Cite
   `docs/reports/2026-09-04-chains-as-workflows.md:41-44`, which records the one
   trial and states that its parent did not commit between hops. Say plainly that
   the trial had no control arm.

   Then say what that leaves open, in one sentence: the chain cannot be a
   workflow, but a **group** of tasks that share no file and feed nothing to each
   other is a different shape, and `ledger.js groups` already computes it. Do not
   write a rule for that here — it is an open entry under `## Needs a decision`
   in `TODO.md`, and Task 11 must not delete it.

5. `npm test` and `node scripts/docs-check.js`, both unpiped.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks read.

**Dispatch:** implementer, sonnet — three paragraphs of new prose that must match a
19.6 KB file's voice, which means reading it; the reading is what a dispatch keeps
out of the parent.

---

## Task 5: `verify` stops pre-judging its reviewers

A brief that told a reviewer a page was `less likely to have drifted` got
`no drift` back. No rule anywhere in the repository forbids seeding a reviewer
with a verdict.

**Files:**
- Modify: `skills/fankeel-verify/SKILL.md`
- Test: none — this task writes no test file.

1. Read `skills/fankeel-verify/SKILL.md:95-115` — the dispatch-brief paragraph,
   which ends `...spend they were never given the chance to question.` and is
   followed at :105 by `Never a pasted diff...`.
2. Before :105, add a rule: a brief never tells a reviewer what it expects to
   find. Give the observed instance as the reason — a brief saying a page was
   less likely to have drifted got `no drift` returned — and say what to write
   instead: the same question about every target, with no ranking among them.
3. Match the file's existing rule formatting; the surrounding rules will show
   whether they are bulleted or bolded run-in sentences.
4. `npm test` and `node scripts/docs-check.js`, both unpiped.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks read.

**Dispatch:** implementer, sonnet — new prose in an existing rule list, which has
to be read to be matched.

---

## Task 6: `land` says what the notes cap drops

`skills/fankeel-land/SKILL.md:70-80` holds a table mapping each kind of note to
where it should go instead. It never says there is a cap. There is:
`lib/registry.js:33` sets `MAX_NOTES = 5`, and `scripts/task.js:664` drops the
sixth silently.

**Files:**
- Modify: `skills/fankeel-land/SKILL.md`
- Test: none — this task writes no test file.

1. Read `skills/fankeel-land/SKILL.md:60-90` — the `## 4. Land the notes` section
   and its table.
2. After the table, add a short paragraph: `notes` holds five
   (`lib/registry.js:33`, `MAX_NOTES = 5`); a sixth note pushes the oldest out
   and nothing announces it, so a task that produced six rulings has already lost
   one by the time `land` reads them. Copy the constant's value exactly — `5` —
   and name the file and line, not the number alone.
3. Say what `land` does about it: read the notes before standing down, and put
   anything still needed into one of the four durable places the table already
   names.
4. `npm test` and `node scripts/docs-check.js`, both unpiped.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks read.

**Dispatch:** implementer, sonnet — a new paragraph that has to sit against an
existing table in the file's voice.

---

## Task 7: `documents.md` drops a stale count and explains `orphan`

Two changes to one page. The first is a number nothing prints; the second is a
finding the page has never described at all.

**Files:**
- Modify: `docs/documents.md`
- Test: none — this task writes no test file.

1. `docs/documents.md:167` reads
   `which is what most retirements are — seventeen of the nineteen in \`docs/archive/\` here`.
   `docs/archive/` holds 29 files today; 27 carry `status: archived` and 2 carry
   `status: superseded-by`. The count has been wrong twice and `TODO.md`'s own
   proposed replacement (`22 of 24`) was stale before it was read. Delete the
   count. Keep `which is what most retirements are` and let `most` carry it —
   nothing prints this number, so no value written here stays true.

2. The word `orphan` appears nowhere in this file, though the audit reports one.
   Add a short section or paragraph, filed with the other audit findings this page
   describes, saying:
   - an orphan is a document under the docs root that no other document links to;
   - `scripts/docs-audit.js:559` reports them **only where the project declares no
     index**, because with an index present the same gap is already reported, and
     better worded, as `missing from the index` (`index.missing`, :542-546);
   - both branches are tested — `tests/docs-audit.test.js:404-411` covers the
     no-index case and `:417-425` covers the index case, asserting `orphans` is
     empty there;
   - orphans never fail the run. `defects()` at `scripts/docs-audit.js:782-786`
     sums drift, landed plans, a broken index and diagrams, and never `orphans`.

   Write it as description, not as a defence — the reader wants to know why an
   empty section is correct here, not to be persuaded.

3. `npm test` and `node scripts/docs-check.js`, both unpiped.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks read.

**Dispatch:** implementer, sonnet — the orphan section is new prose that has to be
placed among the page's existing findings, which means reading the 13 KB page.

---

## Task 8: the dispatch evidence enters the repository

`docs/reports/2026-09-03-dispatch-vs-inline.md`, `-named.md` and `-join.md` cite
their raw evidence by bare filename — `ab.sh`, `arm-dispatch.json` — with no path
anywhere in any of the three. The files exist, in three finished sessions' scratch
directories, and a reader has no way to resolve a citation to them. All three
reports carry role `report` and must not be edited, so the citations are made
resolvable by putting the files where the bare names find them.

**Files:**
- Modify: `docs/reports/evidence/2026-09-03-dispatch-vs-inline/` — a new directory, 18 files copied into it
- Test: none — this task writes no test file.

1. The sources are under
   `C:\Users\Owner\AppData\Local\Temp\claude\F--ymlab-fankeel\<session>\scratchpad\`
   for three sessions:

   - `39b77b4d-0487-4b69-aadd-ee77a17a45e6` — `ab.sh`, `ab-provenance.txt`,
     `arm-dispatch.json`, `arm-inline.json`, `pilot-dispatch.json`,
     `pilot-inline.json`
   - `e3b238dc-7170-42cb-bc5f-7736139219d4` — `ab2.sh`, `ab2-provenance.txt`,
     `arm2-dispatch.json`, `arm2-inline.json`
   - `74a6a414-7f4c-46fb-b5fd-d4fdb66b2c45` — `ab3.sh`, `ab3-provenance.txt`,
     `ab3-prediction.txt`, `arm3-dispatch.json`, `arm3-inline.json`, `extract.js`,
     `arm3-dispatch.err`, `arm3-inline.err`

   `arm3-dispatch.err` and `arm3-inline.err` are 0 bytes. Copy them anyway — an
   empty stderr is the evidence.

2. Copy all 18 into one flat directory,
   `docs/reports/evidence/2026-09-03-dispatch-vs-inline/`. They are one experiment
   series run on one date; the filenames are already distinct across the three
   sessions, so nothing collides and the bare names each report cites resolve to
   exactly one file.

3. **`ls` the destination and count before claiming the copy happened.** Expect
   18 files and roughly 36.8 KB.

4. Add nothing else. In particular add no `README.md` there: a markdown file under
   `docs/reports/` is filed as a `report` and would need an index entry of its own,
   and the `*-provenance.txt` files already record where each run came from.

5. Verify nothing new is filed: `node scripts/docs-check.js` and
   `node scripts/docs-audit.js`, both unpiped. `lib/docs.js` files markdown only,
   so the count of tracked documents must not move.

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/reports/evidence/2026-09-03-dispatch-vs-inline/`. Task 11 closes
  the `TODO.md` entry that asked for this and may state the path.

**Dispatch:** in-session — one copy operation and one `ls` to confirm it; a
dispatch would cost a system prompt to run `cp`.

---

## Task 9: the wake-up measurement becomes a report

One session was measured this session, and nothing in the repository records it.
It is the first measurement of what a dispatch costs the parent *per wake-up*
rather than per token returned, and it contradicts the framing it was asked to
test.

**Files:**
- Modify: `docs/reports/2026-09-04-agent-wakeups.md` — a new file
- Modify: `docs/README.md` — one index entry for the new report
- Test: none — this task writes no test file.

1. Write `docs/reports/2026-09-04-agent-wakeups.md`. Frontmatter `status: current`,
   matching the other files in `docs/reports/`; check
   `docs/reports/2026-09-04-chains-as-workflows.md` for the exact frontmatter
   shape and follow it.

2. It records, from session `f1816f3e-12b5-4291-a42c-a72483b1bc15`
   (1724 lines, 475 assistant turns, 255 user turns,
   2026-09-04T00:31:08Z to 2026-09-04T10:36:00Z):

   - **The `Agent` tool has no background flag here.** All 31 `Agent` calls in
     that session carried exactly four input keys — `description`, `model`,
     `subagent_type`, `prompt` — and every one returned
     `Async agent launched successfully`. There is no foreground form to compare
     against, so the question "is a background agent worse than a subagent" has no
     control arm in this harness. Say that first; it is the finding that matters
     most.
   - 31 `Agent` dispatches (30 `general-purpose`, 1 `claude-code-guide`, all
     `sonnet`) and 3 `Workflow` calls produced 27 distinct wake-up turns. Not 1:1.
   - Peak effective context 658,718 tokens. Twelve evenly spaced samples of
     input + cache-read + cache-creation: 73,010 / 130,489 / 176,073 / 267,592 /
     340,044 / 375,614 / 418,405 / 457,377 / 511,443 / 562,490 / 604,292 /
     658,718.
   - Totals: 1,434,490 output tokens, 176,563,502 cache-read tokens.
   - **The wake-ups are not what stacked the context.** 27 wake-up turns against
     475 assistant turns is 5.7% of the turns. What lands in the parent and is
     re-read on every later turn is the returned content, which is what
     `skills/fankeel/SKILL.md` already says under *Dispatch by default*: the
     return value is the expensive part. This measurement supports that sentence
     rather than adding to it.
   - **One `Workflow` run held `agentCount` 10 and cost one wake-up.** That is the
     shape a fan-out of ten `Agent` calls cannot have. State it as an observation
     from one run with no control arm, not as a measured advantage.
   - The parent transcript carries **0** lines with `isSidechain: true` (1201 carry
     `false`). The subagents' own 19,076,379 bytes across 63 files live only under
     `subagents/`, never in the parent.

3. **Say what it does not show**, in its own section: there is no A/B, no control
   arm, one session, one machine, and the wake-up-to-dispatch ratio of 27:34 is
   unexplained — 7 dispatches produced no matching notification under their own id.

4. Add one entry to `docs/README.md` in the same style as the entries already
   pointing at `docs/reports/`. Do not touch the Roles table Task 1 wrote.

5. `node scripts/docs-check.js` and `npm test`, both unpiped.

**Interfaces:**
- Consumes: `docs/README.md` as Task 1 left it — the Roles table must already be
  complete before this task appends to the file.
- Produces: `docs/reports/2026-09-04-agent-wakeups.md`. Task 10 links to this exact
  path.

**Dispatch:** in-session — every number above is already in this context and the
task is one Write plus one Edit; a dispatch would have to be handed the same
figures to retype.

---

## Task 10: `subagents.md` gets the run journal's real shape

`docs/reports/2026-09-04-chains-as-workflows.md:16-17` describes a Workflow run
record as `workflows/<run id>.json` holding three fields. The file on disk holds
19 keys. That report is role `report` and must not be edited, so the correction
goes here, to the `reference` page that documents subagents.

**Files:**
- Modify: `docs/subagents.md`
- Test: none — this task writes no test file.

1. Read `docs/subagents.md:70-115` — where the three dispatch reports are already
   cited, at :75, :81 and :107.

2. Add what a Workflow run leaves behind, verified this session against
   `C:\Users\Owner\.claude\projects\F--ymlab-fankeel\f1816f3e-12b5-4291-a42c-a72483b1bc15\`:

   - `<session>/workflows/<run id>.json` holds 19 keys, not three:
     `runId, timestamp, taskId, script, scriptPath, args, result, agentCount,
     logs, durationMs, summary, workflowName, status, startTime, phases,
     defaultModel, workflowProgress, totalTokens, totalToolCalls`.
   - `agentCount` **does** exist — how many agents the run held. `phases` carries
     each phase's `title` and `detail`. `defaultModel` records the model the
     script asked for.
   - There is still no per-agent token split in that file.
   - `<session>/subagents/workflows/<run id>/journal.jsonl` is the second file,
     which the report does not mention at all, and it is where the run's own
     agents' transcripts sit.

3. Add one sentence pointing at `docs/reports/2026-09-04-agent-wakeups.md` for the
   wake-up measurement, in the style of the pointers at :75, :81 and :107.

4. **Do not edit `docs/reports/2026-09-04-chains-as-workflows.md`.** Say here, in
   one clause, that its :16-17 describes three fields because three were what that
   day's run was checked for — a dated snapshot being accurate about its own date.

5. `node scripts/docs-check.js` and `npm test`, both unpiped.

**Interfaces:**
- Consumes: `docs/reports/2026-09-04-agent-wakeups.md`, created by Task 9. Linking
  to it before it exists makes `docs-check.js` report a dead reference.
- Produces: nothing other tasks read.

**Dispatch:** implementer, sonnet — a new section in a 16 KB reference page whose
voice has to be matched, and the key list above is transcription the implementer
can copy verbatim.

---

## Task 11: `TODO.md` loses what this plan closed

Eleven `## Ready` entries and three `## Needs a decision` entries are closed by
Tasks 1 through 8. Tasks 9 and 10 close no `TODO.md` entry at all, which is why
the Ordering section puts this task beside Task 10 rather than after it. Two of the eleven bullets were themselves wrong about the
values they proposed, which is worth one line in the commit message and nothing
in the file.

**Files:**
- Modify: `TODO.md`
- Test: none — this task writes no test file.

1. Delete all eleven bullets under `## Ready`. The section then has no entries;
   leave the heading in place — `scripts/todo-check.js` reads the three headings
   and an absent one is a different kind of defect.

2. Delete these three bullets under `## Needs a decision`, and no others:
   - the one beginning `Whether the three pairs' evidence files belong in the repository`
   - the one beginning `Whether the orphan check should fire where an index exists`
   - the one beginning `Whether build's chain is one workflow too`

3. **Leave the other nine `## Needs a decision` entries and all thirteen
   `## Waiting` entries exactly as they are**, stamps included. This plan did not
   settle them. Confirm both counts with `node scripts/todo-check.js` before
   deleting anything — it prints the per-section totals, and the first read of
   this file in the session that wrote this plan was truncated and undercounted
   `## Waiting` at six.

4. Run `node scripts/todo-check.js` unpiped. It must exit 0. It also prints, without
   failing, every `## Waiting` entry stamped seven days or older — read that list
   and report it; do not act on it in this task.

5. `node scripts/docs-check.js` and `npm test`, both unpiped.

**Interfaces:**
- Consumes: Tasks 1 through 8 must all have landed — they own every entry deleted
  here. An entry deleted before its work lands is a defect nobody can find again.
- Produces: nothing.

**Dispatch:** in-session — deleting fourteen named bullets from one file, each
identified above by its opening words.

---

## Self-review

**Spec coverage.** Eleven `## Ready` entries: 1 → Task 4, 2 → Task 5, 3 → Task 4,
4 → Task 6, 5 → Task 3, 6 → Task 7, 7 → Task 2, 8 → Task 2, 9 → Task 1,
10 → Task 2, 11 → Task 2. Three decisions: evidence → Task 8, orphan → Task 7,
build chain → Task 4. Three findings not on `TODO.md`: `documents.md` never
described `orphan` → Task 7; the reports' citations do not resolve → Task 8; the
run record's real shape → Task 10. The measurement → Task 9. `TODO.md` itself →
Task 11. No requirement is unassigned.

**Placeholders.** None. Every task names its files, quotes the text it replaces
where that text is known, and says to read the surrounding lines where it is not.
No task says "similar to Task N". Every task carries a `**Dispatch:**` line and a
non-empty `Modify:` or `Create:` list.

**Naming.** `MAX_NOTES` is written the same way in the Global Constraints and in
Task 6. `orphans` and `index.missing` are written as code in Tasks 7 and 11.
`docs/reports/2026-09-04-agent-wakeups.md` is written identically in Tasks 9 and
10.

**One thing this plan does not do.** It proposes the `task-brief` script in prose
(Task 4) without writing it. The `TODO.md` entry asks for the rule; the script is
a separate piece of work and would need its own tests.
