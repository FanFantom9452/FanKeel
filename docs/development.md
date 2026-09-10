---
status: current
last_verified: 2026-09-11
source_of_truth: package.json, .claude-plugin/plugin.json, scripts/todo-check.js, scripts/version.js, scripts/skills-check.js, scripts/stage-registry.js
---

# Development

The two commands, where pure logic ends and process boundaries begin, and the
four scripts that keep a written claim from drifting away from what it
describes.

```
npm test
claude plugin validate .
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
`land` stage rules call for it, because a plan deleted at `land` is a link that
just died.

An entry under `## Waiting` also carries `lifts when: <the event>` and then a
`MM-DD` stamp, and todo-check fails when either is missing. The stamp is the
day somebody last read that entry and agreed it is still
waiting — not the day it was filed — so re-reading one and leaving it where it is
means moving its stamp forward. Entries stamped seven days or older are printed
below the verdict as **due for a re-read**, without failing the run: sitting under
`## Waiting` for a fortnight is not a defect, and a script cannot know whether the
thing an entry waits for has happened. What it can know is how long since a person
last said it had not. That is worth printing because `## Waiting` has never once
shrunk in this repository by an entry's blocker resolving — four times it has
shrunk, and all four were somebody re-reading the section and finding an entry
misfiled. It is drained by being read, so the interval between readings is the
thing to measure.

## `version.js` — the release number in eleven files

`node scripts/version.js` is the release number in the eleven files that carry it —
two manifests and one frontmatter line in each of the nine skills. With a number
it sets them all; with `--changes` it lists the commits since the last
`chore: <x.y.z>`, which is what a release contains. `npm test` fails when the eleven
disagree, so the script is what makes them agree rather than what notices. A
release used to be ten edits, and missing one left a skill announcing a version
the plugin is not — right in nine places, which is how it went unnoticed.

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
