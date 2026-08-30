---
status: archived
last_verified: 2026-08-28
source_of_truth: lib/map.js, lib/docs.js, scripts/survey.js
---

# The directory tree, and the background nobody types

## The failure this exists to stop

A session opens in a project it has not seen. It runs `orient` and learns which
directories exist and how many files each holds. It reads the map and learns
which documents are retired. It runs the scanner and learns where a term appears.

None of that answers the first question a person would ask: **what is each of
these directories for?**

So the model reads files until it can guess. Measured on this repository, that is
993,556 bytes of markdown — roughly 249,000 tokens — of which 623,138 bytes sit
in pages the map already marks retired. On a real session in another project the
same reflex reached 68% of a one-million-token window during `survey` alone.

The answer cannot be derived. `backend/` is the FastAPI backend because someone
decided it was; no listing says so. It is the background a person carries without
noticing, and therefore the background they skip when briefing an AI.

## What is already here

| | answers |
|---|---|
| `scripts/orient.js` | which directories exist, how many files, git state |
| `scripts/survey.js` `treeLines()` | the tree with sizes |
| `lib/map.js` `signpost()` | where the truth is for a question you already have |
| `lib/map.js` `pagesByStatus()` | which documents must not be followed |
| — | **what each directory is for** |

Two of those are nearly the thing. `treeLines()` already produces the skeleton; it
has every path and every size and no responsibilities. `signpost()` already lifts
human-written navigation out of a README; it lifts the first markdown *table* and
cannot see a `├──` block.

## The approach

**The responsibilities live in the project's own README, written by a person.
`docs.json` records where they live. `map.js` lifts them. When there are none,
fankeel generates the skeleton and asks for them.**

Three properties, in the order they matter:

1. **One copy of the text.** The responsibility strings exist only in the README.
   Nothing caches them, so nothing can disagree with them. "Both places" means the
   README holds the content and `docs.json` holds a pointer — a file name and a
   heading — never a second copy.
2. **Human-readable, because a human maintains it.** A JSON array of directory
   descriptions is worse for the person who has to keep it true, and they are the
   only one who can. The artefact a developer already writes for other developers
   is the artefact to reuse.
3. **Its absence is a finding.** A project with no tree gets a named line in the
   map saying so, and the command that starts one. Today that gap is invisible:
   nothing anywhere reports that directory responsibilities are missing.

### Found by structure, declared only to override

`signpost()` guesses badly today: it walks a fixed `SIGNPOSTS` list and lifts the
first table in the first file that exists. Against Trovara, which has an annotated
tree at `README.md:254`, it lifted a fifteen-row table out of `CLAUDE.md` instead —
`CLAUDE.md` sorts first and its first table is a different table.

The fix is not a declaration. It is two structural rules, measured against the two
projects on this machine that actually have a tree:

1. **Which file** — among the signpost candidates, the one containing
   `├──` / `└──` lines. Trovara's `CLAUDE.md` has none and its `README.md` has 93,
   so this picks the right file where sort order picks the wrong one.
2. **Which heading** — the nearest heading above the first such line.

Measured 2026-08-29 over 185 `README.md` and `CLAUDE.md` files — every project
under `F:/ymlab` and every third-party plugin in the Claude Code plugin cache,
which is a sample nobody here wrote. 43 of them carry a box tree of three lines or
more, and **the nearest-heading rule found a heading in 43 of 43.** None failed.

The headings are the argument against the obvious alternative:

| heading | files |
|---|---|
| 專案結構, including 📂 and 📁 prefixed variants | 14 |
| 目錄結構 | 4 |
| **What lives where** | 4 |
| Project Structure, including a 🛠️ prefixed one | 4 |
| **Files it writes** | 3 |
| 輸出檔案 | 3 |
| **How Design System Generation Works** | 2 |
| Architecture, 架構, 目錄, 項目結構, 項目架構, 📚 文檔結構 | 1–2 each |

A keyword list of "Structure", "Directory", "Layout" misses the twenty-three
Chinese headings outright, and misses the three bolded English ones too — nine
files whose heading is an ordinary sentence no list would ever hold. Five headings
carry an emoji prefix. The structural rule does not read the heading at all, which
is exactly why it does not care what language or decoration the project uses.

**43 of 185 is also the other number: roughly three quarters of these files have
no tree.** That matches the smaller sample below and points the same way — the
lifter serves the quarter that have one, the skeleton serves the rest.

So the pointer is an **override**, not a requirement:

```json
{
  "preset": "flat",
  "index": "docs/README.md",
  "buckets": [ ... unchanged ... ],
  "layout": { "file": "README.md", "heading": "目錄結構" }
}
```

It exists for the project where the guess is wrong — a file whose first box block
is an ASCII diagram of something else, or a README with a tree the author does not
want lifted. Absent, the structure decides, which is what makes this work in a
repository that has never heard of fankeel — every repository, the first time.

### Why `layout` and not `tree`

`tree` already carries three senses in this repository, and a fourth is how the
word stops meaning anything:

| | |
|---|---|
| `lib/docs.js:106` | `read().tree` is the parsed `docs.json` — seven consumers across `lib/map.js`, `scripts/docs-audit.js`, `scripts/docs-check.js`, and twenty-two uses inside `docs.js` |
| `scripts/survey.js:419` | `opts.tree` is the `--tree` flag |
| `scripts/survey.js:300` | `treeLines()` renders a directory listing |

A `tree` key inside `docs.json` would read as `read(root).tree.tree`. `TODO.md`
already carries an open entry for exactly this failure with a different word —
*"`step` still names a route entry ... a third sense the 08-27 settlement never
enumerated"* — so the repository has been bitten here before and has not finished
healing. Adding a fourth sense knowingly is a defect, not a naming preference.

The key is `layout`, the generator is `scripts/layout.js`, and the prose still
says "directory tree" throughout, because that is what a person calls it. Renaming
the existing `read().tree` was rejected: seven external consumers for a word this
change does not need to own.

### The key would be dropped on the way in

`lib/docs.js:115` `normalise(data)` ends

```js
return { preset: ..., index, buckets };
```

It rebuilds the object from three known keys, so anything else in `docs.json` is
discarded silently at `read()` and reaches no consumer. The override above does
not work until `normalise` carries `layout` through — validated the way `index`
is, a string file name and a string heading, both optional, the whole key dropped
if neither is usable.

This is the first task in any decomposition of this design. Every other piece that
reads the override depends on it, and a spec that assumed the key survived would
have shipped an override that silently did nothing.

### What gets lifted

A block under the named heading whose lines carry `├──`, `└──` or `│`, or a
fenced block immediately under it. Lines are taken verbatim, capped the way
`firstTable` caps: a maximum row count and a maximum width, because the map is
read on every survey and an unbounded lift is a second copy of the README.

A heading that names no such block is reported as a heading with no tree — which
is different from no heading at all, and the difference is the whole value of the
report.

### When there is none

```
node <plugin>/scripts/layout.js [--root <dir>]
```

Prints a skeleton built from `treeLines()`: one row per directory, its size, and
an empty responsibility. It writes nothing. The developer pastes it into their
README and fills the right-hand column — which is the one part no tool can do,
and the whole reason the tool stops there.

```
docs/       85.4K   8 files, 3 directories below
hooks/      31.2K   6 files
lib/       118.7K  13 files
scripts/   129.6K   9 files
tests/     ...
```

**One level deep, and each row says how much is underneath.** Measured across
three projects on this machine:

| project | depth 1 | depth 2 | depth 3 |
|---|---|---|---|
| fankeel | 11 | 14 | 5 |
| MiFanDiscordBot | 12 | 28 | 55 |
| Trovara | 12 | 42 | 87 |

The first column is the finding: eleven or twelve directories regardless of how
large the project is. That is a skeleton somebody fills in one sitting. The second
column diverges — fourteen against forty-two — and the third is unusable.

Trovara's hand-written tree is four levels deep and that is where its value is, so
depth one alone would be poorer than what a person writes unaided. The resolution
is not to go deeper automatically: its author went deep on `backend/` and
`frontend/` and left `docker/` and `scripts/` as one line each. Choosing where the
detail belongs is judgement about the project, which is the same judgement the
responsibility column is asking for. A generator that emits 141 rows has made that
choice for them, and made it badly.

So the tool prints the fillable dozen with a count of what is underneath, and the
person deepens the rows that earn it.

Stopping at print rather than writing into the README is deliberate. The README
is the developer's document; a tool that edits it uninvited is a tool people turn
off. `map.js` writes to `.fankeel/`, which is generated ground; this writes to
standard output, which is nobody's.

## A bug this was written on top of, which does not exist

Two drafts of this page carried a section claiming `scripts/survey.js:419`

```js
if (opts && opts.tree && opts.root) lines.push(...treeLines(opts.root, result.files, max));
```

prints nothing unless `--root` is given, and that the three places teaching
`--tree` without one — `skills/fankeel-survey/SKILL.md:74`, `:117`,
`skills/fankeel/SKILL.md:253` — therefore instruct the model to scope from a tree
that never appears.

**It is not true.** `parseArgs` at `scripts/survey.js:437` defaults
`root = process.cwd()`, and `main` passes it through, so `opts.root` is always
set. `node scripts/survey.js --tree` and `node scripts/survey.js --tree --root .`
produce byte-identical output; the tree lands at line 70 of the report either way.

The finding came from reading the guard rather than running the command, and from
a first run piped through `head -25` — which cut the report forty-five lines above
the tree. Every later claim built on it, including a `TODO.md` entry under
`## Ready` and a paragraph about why the defect should not be bundled into this
work, was reasoning from an observation that was never made.

It is kept here rather than deleted because the shape of the mistake is worth
more than the space: a guard that *looks* like it needs an argument, a truncated
first run that agreed, and three documents amended before anything ran the two
commands side by side. The step this design exists to serve — scope from the tree
before reading files — works today.

## Proves it done

| claim | test |
|---|---|
| the structure finds it with nothing declared | `tests/map.test.js` — a fixture with a table in `CLAUDE.md` and a tree in `README.md`, no `docs.json` at all, lifts the tree and names the heading above it. Fails now: `signpost` takes `CLAUDE.md` |
| the pointer overrides the guess | `tests/map.test.js` — the same fixture with `layout: {file, heading}` naming the second block lifts that one instead |
| the key survives `read()` | `tests/docs.test.js` — a `docs.json` carrying `layout` comes back with it. Fails now: `normalise` rebuilds from three keys |
| absence is reported | `tests/map.test.js` — a fixture with no tree gets a line naming the gap and the command. Fails now: nothing is printed |
| a heading with no block | `tests/map.test.js` — declared heading, no `├──` lines, reports "heading, no tree" rather than "no heading" |
| the skeleton is one row per directory | `tests/layout.test.js` (new) — every directory in the fixture appears once, with a size and an empty responsibility |
| nothing is written | `tests/layout.test.js` — the fixture's README is byte-identical after the run |

## Against the map

`.fankeel/map.md` lists 0 pages as planned-but-not-built, so nothing here is being
designed against intent. `docs/documents.md` is `current` and describes what
`docs.json` declares; it gains the `layout` key at `land`. No page is contradicted.

## Rejected

**A `directories` array in `docs.json` holding the responsibility text.** It is
the obvious shape and it is a second copy. The person maintaining it would have
to keep the README and the JSON saying the same thing, and a map that disagrees
with the README is worse than no map, because it is believed.

**Writing the tree into the README automatically.** The paths and sizes are
derivable and the responsibilities are not, so an auto-written tree is a tree of
blanks in someone else's document.

**Putting the figure in the injected block.** `survey` renders at 2,371
characters against a cap of 2,400. A line there costs a rule, and the map is read
in `survey` step 2 anyway.

## Measured, 2026-08-28 and 2026-08-29

Ten `README.md` and `CLAUDE.md` files across eight projects, counting how a
directory tree is actually drawn:

| shape | files |
|---|---|
| `├──` / `└──` / `│` | 2 — MiFanDiscordBot at 38 lines, Trovara at 93 |
| a bullet list of paths | 0 — the three low counts are paths mentioned in prose |
| a table naming paths | 8 of 10, at 4 to 30 rows — but those are navigation tables, which `signpost()` already lifts |

The block shape is settled: a project that has a tree draws it with box
characters, and none of the eight writes one as a list. Widened the next day to
185 files including 36 third-party plugins, 43 carried a box tree and the
heading rule found every one; the numbers are above, under **Found by structure**.

**Six of the eight projects have no tree at all, and roughly three quarters of the
185 files do not either.** The lifter serves the minority that do; the skeleton
serves the rest, and it is therefore the load-bearing half. A plan that decomposes
this should order the work that way.

## A tree that is only half filled in

The skeleton is pasted, three rows get a responsibility, the fourth interrupts
someone. That is the normal state, not the exception, and it decides the rule.

Measured over the 43 trees, 2026-08-29 — 1,000 rows in total:

| | |
|---|---|
| rows carrying a description | 837 (84%) |
| rows that are a path and nothing else | 163 (16%) |
| trees with no description anywhere | **0** |
| trees described all the way through | 12 (28%) |
| **trees partly described** | **31 (72%)** |

This corrects the reasoning below rather than the conclusion. The case worried
about — a skeleton pasted in and left blank — **does not occur once in 43**.
Nobody writes a tree and describes nothing. What everybody does is describe most
of it: partial is not the edge case the count defends against, it is the
overwhelmingly normal state, and the count fires on nearly three quarters of real
trees rather than on a rare accident.

The row total is worth keeping too. A thousand rows across 43 trees is a mean near
23, against the eleven or twelve directories at depth one — so people do go deeper
than the skeleton, selectively, which is the behaviour the depth decision above
assumed rather than measured.

This repository already has both answers to a half-declared thing, and they are
told apart by one question — would reporting it mislead, or is the gap itself
worth knowing?

| | |
|---|---|
| `lib/map.js` `firstTable()` | refuses below three rows: *"A one-row table is a formatting accident, not a map"* |
| `lib/map.js` `pagesByStatus()` | names the gap and counts it: *"undeclared — 2, dated by git rather than by anyone reading them"* |

A tree with empty right-hand columns is both at once. The paths are real — someone
chose to list them. "A tree exists" is not, and a map that says so while saying
nothing is the false comfort this whole design is against.

**So: lift it, and count the rows with no responsibility.**

```
tree — 7 directories from README.md, 4 with no responsibility
```

Refusing would be all-or-nothing and would throw away the three rows somebody did
fill in. Counting is the same sentence at every degree of completeness, including
none — where it reads as seven directories and seven unfilled, which is both
honest and the prompt to go and finish it.

`tests/map.test.js` covers three degrees: none filled, some filled, all filled.

## Still a guess

Whether a project that has never written a tree will fill the skeleton in at all.
Every measurement here is of trees that already exist, written by people who chose
to write one; none of it says what someone does with a skeleton handed to them.
The count is the most the tool can do about it, and whether a count is enough of a
nudge is answered by use, not here.
