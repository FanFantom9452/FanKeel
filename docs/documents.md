---
status: current
last_verified: 2026-09-11
source_of_truth: lib/docs.js, lib/map.js, lib/profile.js, scripts/layout.js, scripts/docs-check.js, scripts/docs-audit.js, skills/fankeel/SKILL.md, skills/fankeel-survey/SKILL.md
---

# Where documents live

The docs tree, the role each bucket carries, and why a role decides what is allowed to be out of date.

`.fankeel/docs.json`, version-controlled. Each bucket is a path and a **role**,
and the role says how long a document is meant to stay true:

| Role | | Allowed to be out of date |
|---|---|---|
| `reference` | describes the system as it is now | no |
| `decision` | why something is the way it is, written once | yes — it is dated by definition |
| `plan` | what is about to be done | until it lands, then it is archived |
| `report` | a dated snapshot: audit, benchmark, meeting, a judge's ruling (`docs/judgements/`) | yes |
| `archive` | retired; checked only that nothing current points at it | yes |
| `fixture` | a test's own input — describes nothing about the system, checked for links and line numbers only | n/a |

The two shapes that ship — `flat` and `phased` — and what happens to a markdown
file in no bucket are stated in [the skill](../skills/fankeel/SKILL.md), under
*Where documents live*. What belongs here is why the question is put that way:
`detect()` names the shape a repository already resembles, so the offer is "this
one?" rather than "which of these?" — a project that already has habits is not
asked to choose again.

## `layout`, which points at a tree rather than holding one

The buckets say where documents live. One optional key says where the project
says what its *directories* are for:

```json
"layout": { "file": "README.md", "heading": "目錄結構" }
```

Both halves are optional and the key is absent unless one of them survives being
trimmed. It is an **override**, not a requirement. With nothing declared the tree
is found by structure: among `CLAUDE.md`, `AGENTS.md` and `README.md`, the file
containing `├──` lines, and the nearest heading above the first of them. Measured
over 185 README and CLAUDE files on one machine — 36 of them third-party plugins
— 43 carry such a tree and that rule identified the heading in all 43. A keyword
list would have missed twenty-three Chinese headings and nine English ones that
are ordinary sentences, so the rule deliberately never reads the heading's words.

Declare it where the guess is wrong: a file whose first box block is a diagram of
something else, or a README with a tree its author does not want lifted.

**It points; it never copies.** The responsibility text lives in the README and
nowhere else, so nothing can hold a second version of it and disagree. That is
the whole reason this is a pointer and not a `directories` array — a map that
contradicts the README is worse than no map, because it is believed.

`lib/map.js` lifts the block into `.fankeel/map.md`, capped at fifty entries and
counting the ones nobody has described yet. Entries, not printed lines: the bare
verticals that hold a subtree open are carried without being counted, so a lifted
block runs a little longer than its cap — the largest real tree measured printed
66 lines for fifty entries. A project with no tree gets a line
saying so and the command that starts one — written with the plugin root resolved,
because the map is read on its own and `<plugin>` is defined only in the injected
block:

```
`node /the/resolved/plugin/root/scripts/layout.js` prints a skeleton to fill in.
```

That command prints a skeleton — one row per top-level directory, its size, what
is underneath, and an empty column. It writes nothing. The paths are derivable and
the answers are not, which is the whole shape of the problem: `backend/` is the
backend because somebody decided it was, and no listing says so.

## survey carries a scanner, not an instruction

The rule that says "check whether this already exists" is the kind that gets
agreed with and skipped, which is exactly why components get built twice. So
`survey` names a script instead. The commands, the two sources it reads, the caps
and how a `skipped:` line is answered are in
[the survey stage's skill](../skills/fankeel-survey/SKILL.md); what is kept here
is one dated run of it, and what the header is for:

```
$ node <plugin>/scripts/survey.js badge

fankeel survey — 99 files, matching: badge
source: git
skipped: 7 with no pattern for their extension, 1 nested repository not descended into

files whose name matches:
  lib/badge.js
  tests/badge.test.js

declarations:  (12 by name, then 5 more in files that match)
  lib/badge.js:22  function badgeWord(stage, clash) {
  lib/badge.js:36  function writeBadge(claudeDir, sessionId, word) {
  ...

documentation:
  docs/statusline.md:7  # The statusline badge

skipped, and openable by hand:
  .claude-plugin/plugin.json
  .claude/worktrees/registry-staleness/  (a repository of its own)
  ...
```

Run against this checkout on 2026-08-26. The header and the two lines under it
are what decides how far to trust the matches: `source:` says where the file list
came from and `skipped:` counts what was never opened, while the section at the
foot names the half of that a reader can open by hand. The header itself is the
files that reached the scan — not the coverage, and not the tree.

A written index of "what this project already has" disagrees with the code within
months and is then read back with confidence, which is worse than having none —
which is why the scan is re-run rather than stored. The declaration patterns are
deliberately shallow for the same kind of reason: the goal is to notice a name
exists, not to parse the language, and a missed declaration costs one line of a
report where a real parser would cost a dependency this plugin does not have.

## `.fankeel/` 各區的壽命

| 路徑 | 提交？ | 壽命 |
|---|---|---|
| `docs.json` | 是 | 跟文件一起版本控制 |
| `profile.json` | 是 | 專案的常設答案，改了就是改偏好；`task.js profile` 寫 |
| `sessions/<id>.json` | 否 | 一個 session 一筆，永不刪，`active:false` 即結束 |
| `map.md` | 否 | 每次 `map.js` 重生 |
| `build/<plan>/`、`build/ask/` | 否 | 一個 task 在跑時各階段寫下的一切——ledger、brief、report、測試輸出、design 的 `mockup.html`、verify 的證據；列出不清理 |
| `index.html`、`station/` | 否 | 這台機器的 station 副本，每次 prompt 重寫 |
| `docs/judgements/`（不在 `.fankeel/`） | 是 | `fankeel-judge` 的判斷，寫完不改（`report`） |

`docs.json` 與 `profile.json` 同層、都進版本控制，是這張表裡唯二「提交」的
`.fankeel/` 檔——其餘四區都在 `.fankeel/.gitignore` 之內。`docs/judgements/`
不在 `.fankeel/` 底下，卻也是「寫完不改」的一區：它跟 `docs.json`、
`profile.json` 一樣提交，但壽命規則更接近一份決定記錄，而不是一份可以重新
生成的快照。

這幾區**不能**是 `.fankeel/docs.json` 的一個 bucket，而這值得寫下來，因為路徑
本身是合法的：`lib/docs.js:185` 的 `if (!p.startsWith(b.path + '/')) continue;`
是純字串前綴比對，`skills`、`evals`、`agents` 都是 `docs/` 以外的 bucket。擋住
的是列檔的那一層，而那一層是同一個函式：下面第一條是它跑的旗標，其後六條是它
的六個呼叫端，`scripts/` 五處與 `lib/` 一處。每一行的引文都必須
跟它的行號同行。`scripts/docs-check.js:182` 是 `function quoteBeside(text, from) {`，
它只掃到換行為止，而同一行上的第二個路徑會被它自己的 `PATHISH` 擋掉——所以擠
在一行的兩個引用等於兩個都沒有引文，而被硬換行拆開的引文等於沒寫。

- `lib/tracked.js:31` 是 `const args = ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];`
- `scripts/docs-audit.js:347` 是 `const listed = trackedFiles(root);`
- `scripts/docs-check.js:330` 是 `const result = trackedFiles(root);`
- `scripts/layout.js:59` 是 `const found = trackedFiles(root);`
- `scripts/orient.js:199` 是 `result = trackedFiles(dir, { stats });`
- `scripts/survey.js:176` 是 `const tracked = trackedFiles(root, { stats }) || (stats.unlistable || stats.skippedExt`
- `lib/map.js:228` 是 `const found = trackedFiles(root);`，這是唯一會讀 bucket 與 role 的呼叫端，離段落所指的 bucket 引數最近

`--exclude-standard` 套用 `.gitignore`，所以宣告出來的 bucket 會
永遠列出零個檔。這張表是這幾區唯一的說明，`node scripts/residue.js` 是它們當下
的清單——表格給角色，`residue.js` 給有哪些與多大。

## What a document says about itself

A role is the project's filing decision and it covers a directory. A **contract**
is the document's own, declared in its frontmatter, and it wins — it is per file
and somebody wrote it deliberately.

```yaml
---
status: current | design-intent | superseded-by <path> | archived | generated
last_verified: 2026-09-06
source_of_truth: lib/badge.js, lib/render.js   # or: generated-by scripts/gen.sh
---
```

Every key is optional. A project that declares none is not broken; it gets the
weaker inference instead, which is a file's modification date. The three exist
because each replaces a guess with a statement:

| Key | Replaces | Why the guess was weak |
|---|---|---|
| `last_verified` | git mtime | mtime says somebody touched the file. A whitespace fix does that and verifies nothing. `last_verified` says somebody read it and it was true. |
| `status` | the directory it sits in | `design-intent` is the word that was missing. A page describing what a system is *meant* to become is not drifting when the code does not match it — it is doing its job. Without somewhere to say that, a roadmap gets written into an architecture page and then read as a description of what exists. |
| `source_of_truth` | reading the page for its subject | A comma list, doing two jobs told apart by what each entry names. Code: this is what the page is about, said outright rather than inferred. Links, code spans and fenced blocks are all read, so the tag names a subject a page never writes out rather than standing in for one it writes where nothing looked. A document: this page defers to that one, so the two are not a pair. Two pages describing one file is only a defect when neither defers. `generated-by` says the file is rewritten rather than maintained, which makes its age meaningless. |

**One file may have several owners, and that is not a defect to fix.** The
question was put on 2026-09-11 and answered no: the pipeline's own core files
are named in the `source_of_truth` of a dozen reference pages each, because
those are the files those pages are about. A single-owner rule would force
eleven of every twelve into a deferral chain and buy nothing. The row above
already carries the right test — whether *neither* page defers — so the sweep
lists the pairs as context and never fails on them, and what gets fixed is a
pair where neither side points at the other. Three such pairs were fixed the
day this was written; the count of shared files was not.

**A path that needs checking goes in a link.** `docs-check` does not parse
frontmatter — it does not know the block is there. It scans the file for markdown
links and code spans, that block included, so a path written into a key is
treated exactly as one written in a sentence and the rules below apply to it
unchanged. What is never read is a bare path, in either place, and the markup
rather than the place is the whole of it. How much of a link or a span is acted
on is the role's again: a reference page has both checked; a plan or a decision
record has its links checked, and of its code spans only that a `path:line`
overshot the file, never that the path is gone, since a plan names code that is
not built yet and a decision names code that was there when it was written; an
archive or a report is read for neither; a fixture is read exactly as a plan
is — links, and of its code spans only that a `path:line` overshot the file —
since the paths it names may exist only in the scaffold its own test builds. A `path:line` in a reference page is
checked against the code span that follows it on the same line, and one
written without such a span is listed as unchecked rather than as broken.

So a bare path written into a key of your own is read by nothing and checked by
nothing — a slower failure than a stale sentence, because a key looks like a
field something maintains where a sentence only looks like prose. An `amends:`
key here was exactly that, and
`tests/source.test.js` now fails on the shape rather than on the word: a key
nothing reads, holding a path that resolves. The vocabulary stays open; what is
closed is the silence.

`archived` and `superseded-by` are both retirement, and what separates them is
whether something took the page's place. `superseded-by` names that thing;
`archived` says only that the page stopped being current, which is what most
retirements are. Pointing `superseded-by` at the document a plan *implemented*
rather than at one that replaced it puts a third meaning under the word, and
the reader who follows it lands on a page that superseded nothing.

A decision record whose premise is overturned by later code does not move to
`superseded-by` or `archived`, since the record is of a moment rather than a
rewritten description — the specific sentence gets a parenthetical annotation
in place, `status` stays `current`, and the rest of the body is untouched.

The vocabulary is wider than those five words — `定案`, `活躍`, `draft`, `草稿`,
`deprecated`, `historical`, `merged-into <path>` are all understood, and anything
unrecognised reads as `current`. Being wrong towards checking is the safe
direction.

### Why this is worth the frontmatter

Taken from a repository of 121 documents where all three keys appear on every
single one, and where the reason is written down in its `CLAUDE.md`:
documentation rots because nothing forces it to stay true, so the gate at which a
document is created is cheaper than the audit three months later. That project
measured the alternative — a sweep found 62 contradictions and four were closed
in a quarter.

So the `build` stage rules carry the gate, not only the `audit` stage:

> A new document is the last resort: use an existing page, or write a generator
> when it derives from code. One written carries status, last_verified and
> source_of_truth.

### Filing, and what happens when you do not

A markdown file that falls outside every bucket has **no role**, and the sweep
says so once rather than guessing. Guessing `reference` is not a safe default,
it is the loudest one: a real project keeps its plans in a directory outside
`docs/` on purpose, and grading them as reference documents produced twelve drift
findings in one run, every one of them a plan doing exactly its job.

The exception is a project with no tree at all. With nothing filed anywhere,
reading markdown as reference is the only reading available, and a project in
that state wants the checks more than it wants the precision.

### `unfiled` and `undeclared` are two different questions

The scanners use both words, and they are not the same gap. **Unfiled** answers
*which bucket is this in?* — `roleOf` returned nothing, so no role covers the
page and none of the checks above graded it at all. **Undeclared** answers *did
anybody sign it?* — `contractOf` found none of `status`, `last_verified` or
`source_of_truth`, so the page is dated by git rather than by a reader. A page
can be either, both or neither, and the fixes are different: a bucket in
`docs.json` for the first, three lines of frontmatter for the second.

| | `unfiled` | `undeclared` |
|---|---|---|
| `scripts/docs-check.js` | a list, capped at twenty — but only pages under the doc root. A README beside code is not misfiled | not counted |
| `scripts/docs-audit.js` | one line, every directory | one line |
| `lib/map.js` | not counted | a list, in `.fankeel/map.md`, the root excluded |

Neither is a defect anywhere. Both are the state of the tree rather than a fault
in a page, and a command that always exits non-zero has an exit code that means
nothing.

**The root is excluded from `undeclared`, everywhere.** `README.md` and
`CLAUDE.md` are the front door rather than pages in a tree, and GitHub renders a
frontmatter block on a README as a stray table at the top of it. `TODO.md` is
excluded for the opposite reason: it is not a claim about the code that could
quietly stop being true, it is a list `scripts/todo-check.js` re-verifies in full
on every run, so a `last_verified` there would be a date somebody has to remember
to bump standing in for a check that already runs. Neither has a fix worth
offering, and a list of things nobody may act on stops being read.

`lib/map.js` was the exception until 2026-08-31, by age rather than by choice:
`pagesByStatus` was written before `isSignpost` existed. What made it worth
closing is what it looked like here — the two front-door files were the *entire*
undeclared bucket, so the one section that names unsigned pages carried nothing
but the two that must stay unsigned. It uses `isSignpost` rather than the audit's
"anything at the root": a loose `NOTES.md` beside them is a page nobody signed,
and the map is the only tool that reports one from outside the doc root. They are
still counted — `documents:` adds the buckets up, and a signpost is filed under
`current`, the bucket the map never prints, so excluding them subtracts nothing
from a line that claims to be every markdown file.

### `orphan`, deliberately empty where an index exists

An orphan is a document under the docs root that no other document links to.
`scripts/docs-audit.js:575` (`index.exists ? [] :`) reports them only where the project declares no
index. Where one exists, the same gap is already reported, and worded better,
as `missing from the index` (`scripts/docs-audit.js:562` is `if (!linked.has(rel)) index.missing.push(rel);`):
an index is a markdown file like any other, so anything it fails to list is
unreachable regardless of what else in the tree links there. Two names for one
problem is how a report starts looking longer than it is.

Both branches are tested. `tests/docs-audit.test.js:407-413` covers the
no-index case; `:418-426` covers the index case and asserts `orphans` comes
back empty. This project declares an index, so the branch that would populate
`orphans` never runs here — the empty result is the index case behaving as
built, not a gap in the check.

Orphans never fail a run. `defects()` opens at
`scripts/docs-audit.js:817` (`function defects(r) {`) and sums drift, landed
plans, a broken index and diagrams; `orphans` is not a term in that sum.

## The list is the output, not the count

`docs-check` prints the findings themselves, not a summary of them — the role
counts at the top are in addition to the list, not instead of it. The list is
capped at `MAX_FINDINGS = 200` (`scripts/docs-check.js:31`) and says so when it
bites, so a run past that cap is the one case where the printed list is not the
whole of it. Short of the cap, comparing two branches is a `diff` rather than a
flag:

    git stash && node scripts/docs-check.js > /tmp/before.txt; git stash pop
    node scripts/docs-check.js > /tmp/after.txt
    diff /tmp/before.txt /tmp/after.txt

A headline count that moved from 22 to 21 says one finding went and says nothing
about whether a different one arrived. The list says both.

Neither `docs-check` nor `docs-audit` decides that two documents contradict each
other, because nothing mechanical can. What the sweep does is turn "read all
forty documents looking for disagreements" into "read these two — they describe
the same source file, and one has not been touched since before it changed".

[Back to the index](README.md) · [Back to the front page](../README.md)
