---
status: current
last_verified: 2026-08-25
source_of_truth: this is a design; lib/stages.js and the scripts are the code
---

# Three silences

Three things the pipeline does not say, each one found by a user watching it run
rather than by a test.

| | The silence |
|---|---|
| **init** | Between the prompt being submitted and `task.js start` landing, nothing on the statusline says fankeel is running. On a large project that gap is minutes. |
| **depth** | `survey` reads a capped slice and the gate offers no way to ask for more. "Stay in survey" reads a little more and stops again. |
| **residue** | `audit` reads documents. Nothing reads the working tree, so a directory nobody decided the fate of is invisible until it is 73 GB. |

They are independent. They share one property: each is a thing the user can see
going wrong before any scanner can.

## 1. `init` — the badge that appears when the prompt does

`hooks/inject.js:50` returns early when this session owns no active entry, and
writes nothing. That early return is correct for a session that never used the
plugin. It is wrong for the one prompt that is trying to start using it.

**The hook writes an `init` badge when the prompt is a `/fankeel` invocation and
this session has no entry at all.**

```js
if (!mine || mine.active !== true) {
    const dir = claudeConfigDir();
    if (dir) {
        try {
            if (!mine && startsFankeel(payload.prompt)) {
                badge.writeBadge(dir, sessionId, 'init');
                badge.writeLead(dir, sessionId, { word: 'init', step: 0, steps: FULL_ROUTE.length });
            } else if (mine || badge.readBadge(dir, sessionId) === 'init') {
                badge.clearBadge(dir, sessionId);
                badge.clearLead(dir, sessionId);
            }
        } catch (e) { /* housekeeping */ }
    }
    return;
}
```

`startsFankeel` matches `/fankeel`, `/fankeel:fankeel`, `@fankeel` and `$fankeel`,
with or without arguments, case-insensitively. It does not match
`/fankeel-audit`, which starts no task.

```js
const startsFankeel = (prompt) => /^[/@$]fankeel(:fankeel)?(\s|$)/i.test(String(prompt == null ? '' : prompt).trim());
```

**The prompt text is really there.** `hooks/*.js` has never read
`payload.prompt`, so this was a guess until it was checked:
`ponytail-mode-tracker.js:14` reads `data.prompt` on the same event, and its
`/ponytail lite|full|ultra` switching works. That is a shipped precedent on this
machine, not a reading of a document.

**Nothing lingers.** Three exits, and every one already exists or is one line:

| | |
|---|---|
| a task starts | `task.js start` overwrites the word with `survey` |
| no task starts, the next prompt is ordinary | the `else if` above reads the badge and clears it only when it says `init` |
| the session is abandoned | `badge.pruneBadges` takes it with the rest |

The read in that `else if` is the one new cost, and it is paid only by a session
that has no registry entry — never by one with a task in flight. A session that
has never touched fankeel pays one `readFileSync` of a file that is not there.

`lib/badge.js` gains `readBadge`. It writes nothing and returns `null` for
anything it cannot read, which is the same shape every other reader in that file
has.

**`step=0`, `steps=7`.** The route is not chosen yet, so seven is a claim about
the default rather than about this task — the same default `task.js start` uses
when no class is given. It becomes the real route the moment the class is
picked. Writing no `step` at all was the alternative and it says less.

## 2. `survey` — the cap, the tree, and the fourth option

### The cap

`scripts/survey.js:25` caps every section at 25 rows. `TODO.md:14` has carried
this since ranking was added: *142 named matches still do not fit in 25*.

```
node <plugin>/scripts/survey.js --max 200 badge colour
node <plugin>/scripts/survey.js --all badge colour
node <plugin>/scripts/survey.js --tree
```

One knob. `--max N` sets the per-section cap (1 to 100000); `--all` is `--max`
with no limit. `parseArgs` consumes the value the way `--root` already does.

`parseArgs` silently skips any argument starting with `--`, so a typo is
currently invisible. It stays that way — an unknown flag is not worth an error
path, and the report names the flags it honoured in its header line.

### The tree

`--tree` adds a section: every directory under the root, nested, with the files
in it and their sizes.

```
tree — 89 files, 612.4K

  .claude-plugin/            2 files    4.1K
    marketplace.json  1.2K   plugin.json  2.9K
  docs/                     17 files  148.2K
    README.md  2.4K   collisions.md  9.1K   documents.md  7.8K
    ...
```

It comes from the same file list the rest of the report uses, so git's ignore
rules apply on a repository and the dot-directory skip applies off one. `--max`
governs it too: a directory with more files than the cap prints `... and N more`,
because a silent truncation reads as "that is all of them".

This is a second view of the same tree `map.js` maps, and the two must not
disagree. Change 4 is what stops them.

### The fourth option

The gate offers three options. `AskUserQuestion` accepts four — its schema caps
`options` at `maxItems: 4`, so a fifth does not exist and a fourth is free.

The fourth is **read wider**: re-run the scanner with `--all --tree`, read the
files it names, and come back to the same gate with more on screen. The stage
does not change, the route does not change, and the class does not change.

**This is smaller than what was approved at the gate, and here is why.** The
approved version changed `ALWAYS[0]` — the rule all seven stages carry — from
three options to four. But "read wider" means nothing at `land`, and `build` has
only 82 characters of headroom under the 2000-character cap that
`tests/stages.test.js:84` enforces. So:

- `ALWAYS[0]` gains three words making the three a **floor** rather than a list.
- The fourth option itself is added to `survey`'s own rules, which have 563
  characters spare.

If the fourth option is later wanted at `verify` or `audit`, it is added to those
stages the same way. Nothing about this design forecloses it, and nothing about
it builds for a case nobody has hit.

## 3. `scripts/residue.js` — what nobody decided about

A third scanner beside `docs-check.js` and `docs-audit.js`, and the same
contract as both: **it narrows, it never deletes, and the gate offers the
cleanup.**

Everything it knows comes from git. There is no heuristic for "unused" and no
list of suspicious filenames.

| | | fails the run |
|---|---|---|
| **undecided** | untracked and not ignored. Somebody has to commit it, ignore it, or delete it — nobody has. | yes |
| **spent worktrees** | a registered worktree whose branch is already merged. | yes |
| **weight** | ignored directories, with their size. `release/` at 73 GB is not a bug; not knowing about it is. | no |
| **the gap** | directories the walk enters that `git ls-files` never names. | no |

Only the first two fail. A command that always exits non-zero has an exit code
that means nothing — the same reason `docs-audit.js:602` fails on three of its
five sections.

```
node <plugin>/scripts/residue.js [--root <dir>]
```

Outside a git repository it says so and reports nothing. Git is the entire basis
for every judgement above; guessing without it would be the heuristic this
avoids.

**fankeel is its own first test case.** `.claude/worktrees/registry-staleness/`
is untracked, not ignored, 960K, and its branch merged in 0.26.0 — it is
sections one and two at once.

`audit`'s rules gain one line naming this scanner. Its headroom is 721
characters.

## 4. One enumerator

The reason section four of the residue scanner exists is a bug this project has
right now:

```
node scripts/map.js        → 75 markdown files
node scripts/docs-check.js → 30 markdown files
```

The 45 are 26 under `.claude/worktrees/` and 19 under `.superpowers/`. Six of
them are filed in `.fankeel/map.md:35-43` as `planned, not built` and `retired`
— so the map that `survey` step 2 says to read first is describing a stale
worktree as the project's intent.

The cause is two enumerators:

| | reads | used by |
|---|---|---|
| `trackedFiles()` in `scripts/survey.js:206` | `git ls-files`, falling back to a walk that skips every dot-directory | survey, orient, docs-check, docs-audit |
| `markdownUnder()` in `lib/map.js:71` | its own walk, with a `SKIP` set that has no `.claude` and reads no `.gitignore` | map |

`markdownUnder` is deleted. `trackedFiles` moves to **`lib/tracked.js`** and all
five callers require it from there — `lib/` requiring from `scripts/` is the
wrong direction, and this is the change that makes the layering honest anyway.

The move is behaviour-preserving. `map.js`'s comment asks for a map that still
works outside git, and `trackedFiles` already does exactly that: git first, walk
second. It satisfies the comment better than the code under it does.

**One consequence, named rather than discovered later.** On the git path the map
lists tracked files, so a page written this minute is absent until it is
committed. `docs-check` and `docs-audit` have always behaved that way; after
this, all three agree. `map.js` runs at `survey` step 2 and `land` step 8, and at
both of those everything relevant is committed.

## 5. TokenBar

The circles come from `step`/`steps` in the lead file, and both ports refuse a
zero:

| | |
|---|---|
| `F:\ymlab\TokenBar\statusline.ps1:628` | `$n -lt 1` becomes `$n -lt 0` |
| `F:\ymlab\TokenBar\statusline.sh:474` | `[ "$step" -ge 1 ]` becomes `-ge 0` |

`steps` keeps its `1..12` guard — a denominator of zero is still nothing to draw.
Both comments gain a sentence: zero is a plugin that has started and not yet
chosen a route.

This is a different repository. It gets its own commit, its own version bump and
its own tag; the installed copies under `~/.claude/` are never edited by hand,
because `tokenbar-update.ps1` overwrites them.

**No palette entry for `init`.** TokenBar renders an unknown word on a neutral
gray ramp, and neutral is the correct colour for "not yet a stage". Giving it a
stage colour would say it is one.

## What is deliberately not built

**Unused packages.** `knip` and `deptry` answer a different question — the
manifest against the code, not the tree against git — and answering it needs
either a dependency or a shell-out to a tool that may not be installed.
`lib/plugins.js` already has the pattern for that: use theirs when it is there,
say plainly that it is not when it is not. It slots in later as a named external.
It is not something fankeel reimplements.

**A deletion path.** Every scanner here reports. `skills/fankeel-audit/SKILL.md:79`
already says never move a document unasked, and a directory is not a smaller
decision than a document.

**A filename heuristic.** No list of "screenshots at the root look like
residue". Untracked-and-unignored already catches those, and it catches them for
a reason that can be stated.

**A second colour for `init`.** See above.

## What proves it done

| | fails now, passes after |
|---|---|
| `tests/inject.test.js` | a payload whose `prompt` starts `/fankeel` and whose session has no entry writes `word=init` and `step=0`; a payload with any other prompt writes nothing |
| `tests/inject.test.js` | a session with an `init` badge and an ordinary next prompt has it cleared; a session with no badge is not written to |
| `tests/badge.test.js` | `readBadge` returns the word, and `null` for a missing or unreadable file |
| `tests/survey.test.js` | `--max 2` caps a section at two rows and says how many were dropped; `--all` drops nothing |
| `tests/survey.test.js` | `--tree` lists a nested directory with its files and their sizes |
| `tests/stages.test.js` | `survey`'s rules name the fourth option; every stage still fits under 2000 characters |
| `tests/residue.test.js` | a fixture repository with an untracked unignored directory reports it and exits non-zero; a clean one exits 0 |
| `tests/map.test.js` | a repository with an untracked worktree under `.claude/` counts the same markdown files as `docs-check` |
| by hand | `node scripts/map.js` and `node scripts/docs-check.js` report the same count on fankeel — 30, not 75 and 30 |

The whole suite is 576 tests, 0 failures, before any of this.

## Against the map

Two pages marked `current` say things this makes false, and both are changed in
the same work:

- `docs/statusline.md:38` — *"The word is the stage, not an intensity."* `init`
  is not a stage. The page gains the word and the reason it has no colour.
- `docs/pipeline.md:115,195` — two copies of `ALWAYS[0]`, both quoting three
  options.

`skills/fankeel/SKILL.md:288-290` carries the option table and gains a fourth
row. `docs/documents.md:31` describes the survey scanner and gains the flags.

Nothing else marked `current` describes any of this.
