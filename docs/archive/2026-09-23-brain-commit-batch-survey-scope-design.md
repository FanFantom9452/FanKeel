---
status: current
last_verified: 2026-09-23
---

# Batch the build-stage commit handoff; survey excludes `docs/archive` by default

This page records session `acf598a5-5c99-40b6-9040-cf359d6eb717`'s design step
for task "brain 回報不必等回話（commit 交接）＋ survey 預設只搜現行文件". It
describes what is meant to be, not what is today — `lib/stages.js`'s
`COMMIT_RULE`, `lib/render.js`'s build-stage brief clause and
`scripts/commit.js` are the current, partial build this replaces; this page is
design-intent until a plan and a build land it.

Survey's read: `lib/stages.js:595-664` (`COMMIT_RULE`, `controlRules`,
`controlFor`), `lib/tracked.js:357-397` (`trackedFiles`, no role filter),
`lib/docs.js:177-230` (`roleOf`, the bucket table `map.js` already reads),
`scripts/commit.js` (one commit file → one commit), `scripts/survey.js`
(`scan`, `parseArgs`, no `docs.js` consultation).

## Why two topics in one design

Both are the same shape: a stage agent's report is throttled by a mechanism
that was sized for one thing at a time and now runs into that limit —
`COMMIT_RULE`'s one-file-one-commit round trip, and `trackedFiles`'s
undifferentiated file list. Survey called the combination architectural
because both change an interface other files already depend on
(`hooks/gate.js`, `hooks/brief.js` and every controlled stage for the first;
`docs-check.js`, `docs-audit.js`, `orient.js` and `map.js` for the second) —
checked below, the second turns out narrower than that in practice (no
other script calls `scripts/survey.js`'s own `scan()`), but the class stands
on the first topic alone.

## 1. The build-stage commit handoff batches, it does not stop waiting

A subagent cannot act again until whatever dispatched it resumes it —
`SendMessage` is the parent's tool, never the subagent's own
(`docs/subagents.md`'s platform-fact table, confirmed again here). So "回報不
必等回話" cannot mean the wait disappears; an `Agent` call is synchronous by
construction. What can change is *how often* the round trip happens: today a
build-stage brain returns `commit <file>` and stops after every single task's
implementer, even when it already dispatched several independent tasks in one
batch (`renderBrainBrief` already allows up to four `Agent` calls per
response). The wait is real but the count of waits is not — one round trip
per completed independent batch, not one per task.

- `scripts/commit.js` reads a commit file of one or more blocks, each
  shaped exactly as today (`paths`, a blank line, `message`), separated by a
  line that is exactly `---`. It commits each block in file order —
  `git add` then `git commit -o` scoped to that block's paths, as now — and
  on success prints one `<task-file>: <base>..<sha>` line per block, newline
  joined; a block's own path list is what the printed line is keyed on, since
  a plain `<base>..<sha>` cannot say which commit belongs to which task once
  there is more than one. `base` is `HEAD` before *that block's* commit, so a
  three-block file's second line's `base` is the first block's `sha` — chained,
  not all three against the same starting `HEAD`, because that is the range
  each task's reviewer actually gets diffed against. A block that fails
  (nothing to commit, a path git refuses) stops the run there: blocks already
  committed keep their commit, the file is not retried whole, and the line for
  the failed block and everything after it is the one-line `commit.js: <why>`
  the brief already knows how to read — unchanged from today's single-block
  error shape, just possibly not the last line printed.
- `lib/stages.js`'s `COMMIT_RULE` names the multi-block shape and says the
  controller relays back everything `commit.js` printed, verbatim, same as
  today — no format change on the controller's side, since it already forwards
  the raw stdout.
- `lib/render.js`'s `renderBrainBrief`, build-stage clause: a brain may write
  one commit file per batch of tasks it dispatched together (up to the
  existing four-`Agent` cap) instead of one per task — one block per task that
  is ready to commit, `---` between them — and returns `commit <path>` once
  for that batch. A task whose implementer is not back yet, or that this batch
  never touched, is not blocked by this: it is simply not a block in this
  file, and reaches its own commit (alone, or in a later batch) the same way.
  Design/plan are unaffected — each writes exactly one file, ever, so their
  clause keeps today's one-block shape and prose.
- `docs/subagents.md`'s commit-flow paragraphs (the ones that say the commit
  moved to the parent, one task at a time) get the batched shape added beside
  the per-task one, since both are now real.

## 2. `scripts/survey.js` excludes `docs/archive` by default

`lib/docs.js`'s `roleOf` already classifies every file under a bucket whose
role is `archive` — `map.js` already reads it that way — but
`scripts/survey.js`'s `scan()` calls `trackedFiles` directly and never
consults `docs.js`, so a retired duplicate in `docs/archive` (126 files, per
survey's scan of this repository) is scanned and reported exactly like a
current file, with no way to tell the two kinds of hit apart on the page.

- `scan(root, terms, opts)` reads `docs.read(root).tree` once and drops any
  entry whose `docs.roleOf(tree, rel) === 'archive'` from the list before it
  is split into `files`/`nested` — so it never enters the declaration scan,
  the name-match list or the printed file count. The dropped count is kept
  (not silently subtracted): the header gains a line, `excluded: N archive
  files under <bucket path>[, <bucket path>...] — pass --archive to include`,
  naming every archive bucket that lost at least one file, one line, always
  printed when `N > 0` — a stated zero is not printed, matching the "no
  conflict" convention the design skill itself uses.
- A new `--archive` flag (`parseArgs`, beside `--all`, `--max`, `--tree`, its
  own boolean, no interaction with the section cap) restores the excluded
  files to the scan — for the case survey itself needs sometimes: confirming
  something really was retired rather than moved, or that no live duplicate
  of an archived design exists.
- A root with no `docs.json` (`docs.read` returns a null tree) filters
  nothing — `roleOf` already returns `null` with no tree, same as `map.js`
  reads it — so a project that never ran `docs.js` behaves exactly as before:
  no `docs/archive`, nothing to exclude.
- `skills/fankeel-survey/SKILL.md` documents `--archive` beside `--all` and
  `--tree`, and says plainly that the default scan already excludes
  `docs/archive` — so the existing "retired, do not follow" language in step 3
  is not contradicted by step 4 quietly including retired pages under a
  different name.

Scope, checked rather than assumed: `docs-check.js`, `docs-audit.js`,
`orient.js` and `map.js` all call `lib/tracked.js`'s `trackedFiles` or
`lib/docs.js`'s `roleOf` directly, never `scripts/survey.js`'s `scan`; the one
other importer of anything from `survey.js` is `scripts/orient.js`, and only
for `isSubtree`, which this does not touch. This half's interface change is
contained to `scripts/survey.js` and its skill.

## 3. Check against the map

`.fankeel/map.md` lists `docs/plans/2026-09-19-stage-agents-design.md` as the
design-intent page for the stage-agent split (controller/agent, commit-and-
wait) that `COMMIT_RULE`/`controlFor` are a partial build of. This page does
not contradict it — it extends the same commit-and-wait mechanism that page
described, batching what was always meant to be a per-round-trip cost. No
other page the map marks current describes `scripts/commit.js`'s file format
or `scripts/survey.js`'s file list as anything other than what they are
today, so there is nothing else to check against; no conflict.

## Testing

- `tests/commit.test.js`: a two-block file (disjoint paths, two messages)
  commits twice and prints two lines, `base` chained from the first commit's
  `sha`; a block whose paths have nothing staged stops the run there and
  reports which block failed, leaving the earlier block's commit standing —
  fails on today's parser (a `---` line is read as part of the first block's
  message, one commit, one line) and passes after.
- `tests/survey.test.js`: a fixture tree with one file under an
  `archive`-role bucket and one outside it — `scan()`'s file list and
  declaration scan both carry only the second, and the header's `excluded:`
  line names the bucket and the count; `--archive` restores both files —
  fails on today's `scan` (no `docs.js` read, both files present, no
  `excluded:` line) and passes after.
- Artefact check: the printed `excluded: N` is read against itself — running
  `scan()` once and counting `tracked.files.length - result.files.length -
  nested.length` must equal the `N` printed on the header, on the same run,
  not asserted as two separately maintained numbers.

## Unverified

Whether the 09-23 collision this task opened with is reproducible on demand
was already unknown at survey and stays unknown here — this design addresses
the round-trip count a fix chain forces, not a confirmed reproduction of that
specific incident.
