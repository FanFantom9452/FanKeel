---
status: current
last_verified: 2026-09-17
source_of_truth: package.json, .claude-plugin/plugin.json, knip.json, scripts/todo-check.js, scripts/version.js, scripts/skills-check.js, scripts/stage-registry.js
---

# Development

The three commands, where pure logic ends and process boundaries begin, and the
four scripts that keep a written claim from drifting away from what it
describes.

```
npm test
claude plugin validate .
knip
```

## Where the code lives

`lib/` is pure logic, tested directly. The one exception is `lib/fanout.js`, which
ends in a four-statement block reading stdin and writing stdout, because
`lib/tracked.js` spawns it as a child process to read several repositories at
once; it sits in `lib/` rather than `scripts/` because nothing in `lib/` may reach
the other way, which is the rule that put `lib/tracked.js` there to begin with.
`hooks/` is where stdin, stdout and process exit otherwise live, and all eight
hooks are tested as subprocesses with real payloads.

Every hook exits 0 on every path, including every error path. A `UserPromptSubmit`
hook that throws blocks the prompt it was called for and a `PreToolUse` hook that
throws blocks the edit, and a plugin that can wedge your terminal is worse than no
plugin. The other five are not load-bearing that way, but a stack trace in front of
the user in the middle of somebody else's turn is its own kind of broken.

## `todo-check.js` — whether `TODO.md` is still an index

`node scripts/todo-check.js` says whether [TODO.md](../TODO.md) is still an index —
every link resolving, none of them landing on a document whose declared role
records a moment rather than the present, no entry carrying detail that belongs
in the file it points at, and every entry filed under `## Ready`, `## Needs a decision` or
`## Waiting`, which is what says whether it can be started today. Where *no*
entry uses those three and every one of them sits under a heading of its own,
that is a repository with its own vocabulary rather than one leaving entries
unfiled, so it is said once and does not fail the run. An entry under no heading
at all is the unfiled case, and still does. A clean run
prints the split, so the ready count is on screen without opening the file. The
`land` stage rules call for it, because a plan archived at `land` is a link that
just moved.

Under `## Waiting`, entries are grouped by what they wait for: a `### <timing>`
heading at most 28 columns wide — a CJK character counts two — whose next line
is `lifts when: <the event>` and then a `MM-DD` stamp, followed by the entries
that lift together when it comes. todo-check fails a Waiting entry under no
timing, a timing with no entries, one missing its event or its stamp, and a
title over the width. The stamp is the day somebody last read that timing and
agreed it is still waiting — not the day it was filed — so re-reading one and
leaving it where it is means moving its stamp forward. An event that opens with
an `MM-DD` is a date, and its timing is due from that day; any other timing is
due once its stamp is seven days old. Due timings print below the verdict as
**due for a re-read**, without failing the run: sitting under `## Waiting` for a
fortnight is not a defect, and a script cannot know whether the thing a timing
waits for has happened. What it can know is a date, and how long since a person
last said it had not. On 2026-09-18 two entries left because their events had
happened, and both were found by somebody reading the section rather than by the
event announcing itself — so the reading is what gets scheduled: `orient` lists
every timing each time, and `/fankeel` offers one option once any is due.

`## Needs a decision` gets a due list of its own, read off git blame rather
than a stamp — nobody writes `lifts when:` or a date on those bullets. An
entry whose last edited line git blame puts seven days old or more prints
under its own heading below the verdict, the same non-failing way. `lib/blame.js`
holds the shared reading, because `scripts/orient.js`'s own `## Needs a decision`
ordering in its `todo:` block needs the same history.

## `version.js` — the release number in thirteen files

`node scripts/version.js` is the release number in the thirteen files that carry it —
two manifests and one frontmatter line in each of the eleven skills. With a number
it sets them all; with `--changes` it lists the commits since the last
`chore: <x.y.z>`, which is what a release contains. `npm test` fails when the thirteen
disagree, so the script is what makes them agree rather than what notices. A
release used to be eleven edits, and missing one left a skill announcing a version
the plugin is not, unnoticed until [`tests/contract.test.js`](../tests/contract.test.js)
started running — its comment carries the count now, not this page.

## Releasing — the steps this repository actually takes

The section above says what `version.js` does and nothing says when to run it.
Until 2026-09-18 no page did, and the steps lived only in whoever had done one
before. These are the eight 0.70.0 went through, in order.

1. **The branch is finished first.** `npm test` green, and `docs-check`,
   `todo-check`, `docs-audit`, `skills-check`, `memory-check` and `residue` all
   exit 0 on the tree about to be released. A release is a claim about what
   shipped; a red check makes it a claim about something else.
2. **`node scripts/version.js --changes`** lists the commits since the last
   `chore: <x.y.z>`. That list *is* the release, and it is what to put in front
   of whoever is choosing the number — there is no changelog to read instead.
3. **`node scripts/version.js <x.y.z>`** writes the thirteen places and says how
   many it changed. Only on the user's say-so: the number is a claim about what
   shipped, and that claim is theirs.
4. **Commit it as `chore: <x.y.z> — <one line>`.** That subject is the marker
   `--changes` counts back to, so a release committed under any other subject
   leaves the next one listing this one's commits again.
5. **`npm test` again.** `tests/contract.test.js:262` reads all thirteen and
   compares them, so the bump is only proven by a run that happened after it.
6. **Integrate.** `land.push` is `false` in this project's profile, so a local
   merge to `main` is where a release stops unless the user says otherwise.
7. **Push only when asked, and ask separately.** The plugin is installed from
   the GitHub marketplace `FanFantom9452/FanKeel`, so nothing off this machine
   sees a release until `main` is pushed — and the profile's standing answer is
   not consent for the one step that publishes.
8. **The terminal that pushed still holds the old copy.**
   `plugins/installed_plugins.json` pins `fankeel@fankeel` to a `gitCommitSha`
   and an `installPath` under `plugins/cache/fankeel/fankeel/<version>/`, and
   Claude Code reads that path and its hook list once per process; `/clear` does
   not re-read either. A new terminal does, and an in-flight task comes across
   with `/fankeel` → Adopt. That is why a release is the last thing a session
   does rather than the first.

## `skills-check.js` — a fail-closed gate over the skill files

`node scripts/skills-check.js` is a fail-closed gate over this plugin's own
skill files: every `skills/**/SKILL.md` and `lib/stages.js` is scanned for a
script or flag it names, checked against what `scripts/` actually has. It
exits 1 on a script no skill can find, a flag its script does not accept, a
required-core script named by no skill, or the scan itself finding no script
reference anywhere — the last of those is `classify()`'s own `empty-scan`,
because a scan that names nothing is the extractor having broken, not a quiet
tree, and nothing here judges that a second time. `skills/fankeel-land/SKILL.md`
runs it in its own step; the injected `land` rules had no room left to name it
too.

## `stage-registry.js` — the stage table a tool reads as data

`node scripts/stage-registry.js` writes `skills/registry.json`: one entry per
stage with the sentence that gates entering its skill, the sentence that
says it is done, and how many of its own budgeted bytes the injected block
spends today. It follows `eval.js`'s precedent rather than joining
`REQUIRED_CORE` — nothing in a stage's rules or a skill names this script,
so nothing would go looking for it there. `tests/stage-registry.test.js`
regenerates the file and deep-equals it against what is committed: a rule
that grew without regenerating, or a budget lowered below what a stage
actually measures, fails there rather than drifting silently.

## `knip.json` — which files nothing reaches, and which exports go unchecked

`knip` is the third command above and the only one this repository does not own.
[skills/fankeel-audit/rationale.md](../skills/fankeel-audit/rationale.md) says why
that question goes to an outside tool rather than to the obvious forty lines.

Without a config it answered badly. On 2026-09-13 a bare `knip` reported 228
unused files: 212 were under `.fankeel/`, which is per-machine and regenerated,
and four more were the frozen evidence scripts under `docs/reports/evidence/`.
The twelve left were real entry points it had no way to see — the nine
`hooks/*.js`, which `.claude-plugin/plugin.json` invokes by path, and
`scripts/map.js`, `scripts/stage-registry.js` and `scripts/task.js`, which are
run as `node scripts/<x>.js`. Hence `entry` and `ignore`.

**The exports row is excluded, and that is a limitation rather than a taste.**
knip 6.32.2 does not resolve CJS namespace property access, so on 2026-09-13 it
called 146 genuinely used exports unused. On 2026-09-18 knip 6.37.0 still does
not, and `knip --include exports` gives 156 on both versions: the tree grew, the
tool did not change. One barrel shows it with one variable changed:
`knip --trace-export badgeWord`, destructured at `tests/badge.test.js:9`,
returns `import[badgeWord] ⎆ ✓`; `knip --trace-export clearBadge`, reached as
`badge.clearBadge`, returns `(no imports found) ✗` — and `scripts/task.js:138`
and `hooks/inject.js:120` call it. The shape is not rare here: counting lines
under `tests/` that bind a module from `../lib/`, `../scripts/` or `../hooks/`
to a plain identifier rather than destructuring it gives 60 lines across 40 of
the 74 test files, against 35 destructured lines across 26. `TODO.md` carries
what would lift the exclusion.

**A green run has to be able to go red.** An `ignore` wide enough to silence 228
files is wide enough to silence a real one, and the exit code cannot tell them
apart — so both halves of this config are controlled rather than merely run
clean. For `ignore`: drop a file nothing imports into `lib/`, and `knip` must
name that file and nothing else; on 2026-09-13 it reported exactly
`Unused files (1)` and that one path. For `exclude`: append a genuinely dead
export to a module that is reached, then run the same tree twice with only that
field changed. With it, `knip` exits 0 and says nothing; without it, `knip`
exits 1, reports `Unused exports (147)` — the standing 146 plus the probe — and
names the probe. So the exclusion does hide a dead export in `lib/`, which is
its measured cost rather than an asserted one. The runs are in
[reports/evidence/2026-09-13-knip-config](reports/evidence/2026-09-13-knip-config/provenance.txt).
