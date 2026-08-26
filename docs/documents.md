---
status: current
last_verified: 2026-08-26
source_of_truth: lib/docs.js
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
| `report` | a dated snapshot: audit, benchmark, meeting | yes |
| `archive` | retired; checked only that nothing current points at it | yes |

Two shapes ship, both taken from real repositories rather than invented: `flat`
(one `docs/` with a numbered series) and `phased` (`01-vision` through
`99-archive`). Neither is imposed — a repository that already has habits keeps
them, and `detect()` says which shape it resembles so the question can be "this
one?" rather than "which of these?".

A markdown file in no bucket is reported. Not as an error, but as the one nobody
decided the lifetime of, which is the one most likely to rot unnoticed.

## survey carries a scanner, not an instruction

The rule that says "check whether this already exists" is the kind that gets
agreed with and skipped, which is exactly why components get built twice. So
`survey` names a script instead — `<plugin>/scripts/survey.js`, with the injected
block resolving `<plugin>` once above the rules — and the rule requires quoting
the output:

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

It reads `git ls-files` and the working tree on every run, so **nothing is
stored and nothing can go stale**. A written index of "what this project already
has" disagrees with the code within months and is then read back with confidence,
which is worse than having none. Declarations are found in JavaScript,
TypeScript, Vue and Svelte script blocks, PowerShell, Python, shell, Go, Rust,
C#/Java/Kotlin/Swift, Ruby, and CSS classes, custom properties and mixins, plus
markdown headings. Anything else is matched on filename alone. The patterns are
deliberately shallow, because the goal is to notice a name exists, not to parse
the language — a missed declaration costs one line of a report, and a real parser
would cost a dependency this plugin does not have.

"Nothing matched" is a finding, and the rule asks for the terms that were tried —
so the next person knows which synonyms were already ruled out.

A task starts at `survey`. At the end of a stage you are offered the next one,
staying put, or pausing — never told a stage is complete and left there. Short
tasks may skip forward, but the skip is said out loud, because skipping silently
is how `verify` gets skipped.

Each stage also carries one line about the **shape** of its output — `survey`
quotes the scanner rather than paraphrasing it, `build` says almost nothing
because the diff is the output, `verify` quotes the command and the line that
decided it. This is the dynamic half that an output style cannot do: the system
prompt is fixed for the session, and the stage is not.

`land` has no successor. What follows it is a new task, which is a decision rather
than a transition.

## What a document says about itself

A role is the project's filing decision and it covers a directory. A **contract**
is the document's own, declared in its frontmatter, and it wins — it is per file
and somebody wrote it deliberately.

```yaml
---
status: current | design-intent | superseded-by <path> | archived | generated
last_verified: 2026-08-22
source_of_truth: lib/badge.js        # or: generated-by scripts/gen.sh
---
```

Every key is optional. A project that declares none is not broken; it gets the
weaker inference instead, which is a file's modification date. The three exist
because each replaces a guess with a statement:

| Key | Replaces | Why the guess was weak |
|---|---|---|
| `last_verified` | git mtime | mtime says somebody touched the file. A whitespace fix does that and verifies nothing. `last_verified` says somebody read it and it was true. |
| `status` | the directory it sits in | `design-intent` is the word that was missing. A page describing what a system is *meant* to become is not drifting when the code does not match it — it is doing its job. Without somewhere to say that, a roadmap gets written into an architecture page and then read as a description of what exists. |
| `source_of_truth` | nothing | Two pages describing one file is only a defect when neither defers to the other. Declaring the source settles it, and `generated-by` says the file is rewritten rather than maintained, which makes its age meaningless. |

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

[Back to the index](README.md) · [Back to the front page](../README.md)
