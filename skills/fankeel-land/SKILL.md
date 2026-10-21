---
name: fankeel-land
description: The land stage — a green suite, the documents closed, the map rewritten, and the integration decision left to the user. Use for the land stage of a fankeel task, finishing a development branch, deciding between merge and PR, or cleaning up a worktree when work is complete.
version: 0.111.61
status: current
last_verified: 2026-10-18
source_of_truth: lib/stages.js, scripts/todo-check.js, scripts/map.js, hooks/carry.js, scripts/land.js, lib/suite.js
---

# fankeel-land

Produces a repository no dirtier than you found it.

**Done when** the suite is green, the documents are closed, the map is rewritten
and `todo-check` passes. The integration decision itself is the user's, so it is
what the gate asks — never something to settle first and report afterwards.

- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script this skill names against that root and nowhere
  else. One exception, and it is a different root rather than a search for
  one: where the registry root's own `package.json` names `fankeel`, the
  scripts to run are the working tree's, because the installed copy lags it
  by a release.
- **No fallback path.** Never the working directory, a home directory, a
  global skill root, or another copy found by name — that one path resolves,
  or none does.
- **A missing script stops the stage, named.** Say which path you resolved
  and that it is not in this plugin install — never a guess at where it
  moved, never a workaround.

## Not a defect

| Looks like a finding | Why it is not |
|---|---|
| A commit with only one short paragraph of prose | `lib/stages.js:217` caps it there (`one paragraph only for what a bullet cannot hold`) — the bullets are the record; more prose is not owed. |
| A `做了什麼:` list that skips files the diff touched | It is one line per new capability, not one per file — `lib/stages.js:400` (`做了什麼: one line per thing someone can now do`) — a file with no capability of its own has nothing to add there. |
| A landed plan still sitting on disk, not yet archived | `lib/stages.js:410` archives it only `then is archived, after asking` — a plan waiting on that answer is not forgotten, it is mid-step. |

## 1. The full suite, on the tree you are about to integrate

When this land is a release, do step 2a first — set the number and commit
it — and only then run this step: `package.json` is code to the record, so a
suite run before the bump is stale after it, `--check` below refuses on it,
and so does `task.js land`. A standing rule that every land
releases counts as the user saying so.

Verify ran the fast suite, so this check usually refuses; ask anyway, because
a whole run recorded earlier — an earlier land attempt, or verify's in a
project with no `test:fast` — still stands:

```
node <plugin>/scripts/suite.js --session <id> --check
```

It runs no test and writes nothing. `suite: record stands @ <sha>` with exit
0 means a whole-suite record is green and no code changed since, and that line is
this step's `suite:` line. `suite: no suite to run` also exits 0 and means
the project has no test command, so there is no record to stand and nothing
to run; copy that line to the report's `suite:` line as it is. Exit 1 prints
why, and the full run is what answers it:

```
node <plugin>/scripts/suite.js --session <id>
```

A record verify made with `--fast` is refused here by name — `suite ran the
fast set at <sha> — land runs everything` — because the tests named `@slow`
did not run. The full run waits while another `suite.js` on this machine
holds the lock, printing `suite: waiting — pid <pid> (session <id>) has run
the suite in <tree> since <HH:MM>; lock <file>`; that is a queue, not a hang,
and a lock whose pid has died, is over an hour old, or has not parsed for 5 s
is cleared on its own. One line is not a queue:
`suite: waiting — lock <file> is stale and could not be removed; delete it by
hand` — the lock is dead but Windows refused to move it; delete the file named
and the run goes on.

Where build ran in a git worktree opened by hand — one the entry does not
record — add `--tree <that worktree>`: the suite runs there, `suite.json`
keeps the path, and `task.js land` checks the record against that tree's HEAD
for as long as the directory exists.

The full run executes the project's test command — `package.json`'s `test` script, or
`--command "<cmd>"` — prints `suite: <pass> pass, <fail> fail @ <sha>`, and
records that beside the task's handoffs. **Red stops everything**, and since
2026-10-09 that is a refusal rather than a sentence: `task.js land` in step
6 will not record an integration without a green record at a sha no code
has changed since (`lib/suite.js`, `blocker`). Report the failures and
stop; the menu comes after a green run. A green run earlier in the session
only proves the tree it ran on, and the record says which.
`suite.json` keeps the failing tests' names, not why they failed: before
changing code for one, run the same command with `--test-reporter=tap` into a
file in the task's build directory and read that test's `not ok` block.

Where the suite was red on an earlier run of this task and is green now,
`task.js land` says so under its own line — `suite: green on run <N>; red on
run <n> — <the tests that failed>`, one line per red run. Copy those names
onto the report's `suite:` line: the green line alone hides that a test
failed on the way here.

## 1a. The skills gate

```
node <plugin>/scripts/skills-check.js [--root <dir>]
```

Fail-closed, same as the suite above: exit 1 on a script no skill can find, a
flag its script does not accept, a required-core script named by no skill, or
the scan itself finding no script reference anywhere — the last of those is
`classify()`'s own `empty-scan`, not judged a second time here.

## 2. Close the documents

```
node <plugin>/scripts/todo-check.js [--root <dir>]
```

### 2.0 File the record first

Run the suite with `--check` first; red stops the stage. Then write the five
typed fields in the user's language, to plain-language.md, and pipe them in:

```
node <plugin>/scripts/record.js write --session <id> <<'EOF'
要求: <the ask, one line>
做了什麼:
  - <what someone can now do that they could not>
為什麼這樣做: <the approach; what was given up>
驗過・沒驗過: <checked; not checked>
還剩什麼: <what is still not done>
EOF
```

It refuses a missing field, a sentence over 160 columns and a bare code, and
writes nothing; fix and pipe again. On success it adds 花費 from the session's
own transcript, files the record on the registry entry and in the month's file,
and prints `filed: <file>#<anchor>` and the six lines.

The task is still active at this point, which `write` requires, so it runs
before Execute stands the task down. The month file it writes is a changed file
that the step 4 notes commit (or this change's commit) must include, so it lands
with the work. `--root <dir>`, `--project <dir>` and `--config-dir <dir>` are
available when the session is registered under another root.

Close the TODO entries this work finished — whoever finishes the work closes
the entry in the same change (folder mode: `todo.js done <id> --sha <sha> --record "<one or two sentences on this entry>. 詳見 <link to the record>" --commits <sha,sha>` — the link is the `filed:` path from `record.js write` written relative to the TODO file, with its anchor, as a markdown link whose text is 任務紀錄 and whose target is that path and anchor, and the record itself lives there, not here; the file stays and gains a `## 完成紀錄` section — written to [plain-language.md](../../docs/90-agent/reference/plain-language.md), no `path:line`, never edited after, `--commits` naming every commit of the work but not the one that writes the record; hand-written `TODO.md`: remove the line). A plan that just moved is a link that just changed
address, so run this after anything moves.

Update `last_verified` on every page you re-read and found true. That date is the
difference between "somebody touched this file" and "somebody read it and it was
true"; a whitespace fix does the first and proves nothing.

A page under a bucket marked `audience: human` that this change touched is
named to the user at the gate: the person it is written for reads it, not a
reviewer.

When this session's diff added a TODO entry (folder mode: a new entry file from `todo.js new`; hand-written: a `TODO.md` bullet) that was not there in
`HEAD` before this task started, this stage's gate asks the user to confirm
which heading it belongs under — before the stage's own gate. Most entries are
filed correctly by whoever wrote them; this is the one check point that
catches a bullet parked under the wrong heading.

Mark the record `binding: true` in its frontmatter only when it changes how
code is written from here on — never for one that explains why something was
done. `docs-check` refuses an eighth; when a record replaces another, give the
old one `superseded_by: <path>` and it stops counting. The map lists every
binding record, and design reads them there at its step 5.

A landed plan whose design chose between approaches, or overturned an earlier
decision, leaves a decision record behind — what was decided and why. Any other
land — a TODO patrol, a batch of fixes — leaves a report in the `report` bucket
instead, because a decision bucket a person reads is for decisions. In a human
bucket the record opens with `一句話` (or `In one sentence`) and carries
`## 決定`, `## 為什麼` and `## 放棄了什麼` (or `## Decision`, `## Why`,
`## Given up`): docs-check's `decision-shape` refuses one dated from 2026-10-10
without them ([plain-language.md](../../docs/90-agent/reference/plain-language.md)).
Either way the plan is then archived — with no question when the profile's
`land.archivePlan` is true, **after asking** when it is not. An unarchived plan
gets read as current.
Archive with the script, the plan and its design together:

node <plugin>/scripts/archive.js <plan bucket>/<plan>.md <plan bucket>/<plan>-design.md

It moves each into the `archive` bucket and turns `status: design-intent` into
`status: current` in the same staged change: the page now describes what
shipped, and `docs-audit` never reads an archived page again. Its row in the
docs index changes from *design-intent* to *built* by hand.

## 2a. The release number, when the work is one

```
node <plugin>/scripts/version.js              what the sixteen places say
node <plugin>/scripts/version.js 0.35.0       set them
node <plugin>/scripts/version.js --changes    what has landed since the last one
```

Sixteen files carry it; `npm test` fails when they disagree; the release
steps are in [development.md](../../docs/01-guide/development.md).

**Only when the user says this is a release.** The number is a claim about what
shipped, which is theirs to make; `--changes` is what to show them when asking.

## 3. Rewrite the map

```
node <plugin>/scripts/map.js [--root <dir>]
```

The project looks different now, and the next task starts from this file.

## 4. Land the notes

Task notes die with the task. If a note still matters after the work lands, it
was never a note:

| | |
|---|---|
| a project convention | `CLAUDE.md` |
| a durable fact about the user or repository | the memory directory |
| why a change was made | the commit message |
| work deliberately deferred | folder mode: a new entry via `todo.js new` (title ≤ 28 columns, CJK as two; `要做成：` is not reason); hand-written `TODO.md`: one line, under the heading for what it is short of — under `## Blocked`, beneath a `### <timing>` whose next line is `on: MM-DD`, `after: <what>` or `upstream: <what>`; under `## Watch`, one whose next line is `if: <the event>`; either line ending in a `MM-DD` stamp; step 2's `todo-check` ran before this note existed, so run it again once the notes land |

**Before a durable fact goes to the memory directory, one of four decisions.**
Grep the directory for the fact's subject first, then:

- `store` — nothing there says it: a new file and one `MEMORY.md` line. When
  `input-check.js` already prints `entries: 20 of 20` or more, the store
  waits behind a `merge` the slimmer proposes.
- `update` — one file says it and is now wrong or short: edit that file, with
  a `**Corrected YYYY-MM-DD:**` line where it was wrong, and leave no second
  copy beside it.
- `merge` — two files already say it: listed for `fankeel-slimmer`'s
  `needs approval:`, never done here.
- `skip` — it is already said as well as this note would say it.

Four kinds are never stored: a secret — a key, token or password, or where one
is kept —, a raw log or command output, a transient state that clears itself
(a lock held, a server down, a branch mid-rebase), and a fact another memory
file already holds, which is an `update` rather than a second file.

If this task wrote to the memory directory, run
`node <plugin>/scripts/memory-check.js` once before standing the task down. A
wrong entry it finds is corrected in place with a `**Corrected
YYYY-MM-DD:**` line, never a silent rewrite; a stale citation is only ever
listed, and a deletion happens only for the entry the user points at.

`notes` holds five (`lib/registry.js:41`, `MAX_NOTES = 5`); a sixth note pushes
the oldest out and nothing announces it, so a task that produced six rulings has
already lost one by the time `land` reads them. Read the notes before standing
the task down, and put anything still needed into one of the four durable places
above.

**The gate: four options, in this order; the review runs after every export.**
After `record.js write`, the gate carries exactly these (land-8):

1. `收工 (Recommended)` — stands the task down; its description names the
   month file and anchor. The label must say `收工` or `down`
   (`lib/handoff.js:414`).
2. option two as every gate has it.
3. `匯出並回顧` — its description says
   「匯出這次的對話，接著回顧這次哪裡可以改進，把建議列給你核准」, that the
   whole session passes through one opus context, tens of thousands of
   tokens on a long one, and that the bundle holds everything said here.
4. `暫停`.

The word `retro` is nowhere the user reads, and nothing runs until the user
picks `匯出並回顧`. Then `node <plugin>/scripts/record.js session --session <id>`
packs this session's transcripts and those it was adopted from, masks
`.fankeel/sensitive.txt` and key shapes as `[REDACTED:<kind>]`, writes
`.fankeel/bundles/<day>-<id8>.jsonl.gz` and adds a `對話紀錄` line to the
record; `--commit` files a bundle of 2 MB or less in the records bucket.
The review follows with no second question: say one
`subagent_type: fankeel:fankeel-retro`, opus, in the background, prompt
naming `session <id>`, `bundle <path>` and `<plugin>`. It reads
`scripts/conversation.js --bundle <path> --tools`, returns a unified diff
for `skills/` or `CLAUDE.md`, one `evidence:` line per hunk, and writes
nothing. Ask it as its own question headed `改進建議`; an approved hunk
goes to one `fankeel:fankeel-fixer` per file. Then
`node <plugin>/scripts/record.js retro --session <id> --transcript <session>/subagents/agent-<id>.jsonl`,
the disposition on stdin, and stand down. A land brain sends it only when
its brief says the user picked `匯出並回顧`.

The commit is the same three parts every time, and `build` commits one task at a
time with the same skeleton — injected here, and read from step 4 of its own
skill there, because its injection has no room for the rule:

```
type: what changed, under 60 characters with the type

- <what changed> — <module or path>
- <what changed> — <module or path>

<one paragraph, only for what a bullet cannot hold: a number, a control, a
decision that went the other way>
```

The bullets are the `做了什麼:` list rewritten for the next session's `init`,
which reads `git log` before it reads any code: a capability in the report, a
change and the module it landed in here. Asking for the reason instead came back
as five paragraphs of it under a 107-character subject, and the reader had to
reconstruct the list. The reason is the one paragraph, and only when a bullet
cannot hold it.

Standing the task down is the last thing, and `/clear` comes after it — never
before. A `/clear` keeps the process and takes a **new** session id, so a clear
first leaves the entry `active` with nothing reading it. `hooks/carry.js` offers
it back on the next session's first prompt, but the clean order costs nothing.

## 5. Detect the workspace, confirm the base

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

`GIT_DIR == GIT_COMMON` is a normal repository with no worktree to clean up.
Otherwise it is a worktree; a detached HEAD is externally managed, so leave it
in place. The menu is then the PR, keep-as-is, and the pause every gate carries —
three, because `ALWAYS` never drops below three and a detached HEAD removes an
option rather than the floor.

The base branch is whatever this work forked from. If it is not already known,
ask — merging into the wrong base is expensive to undo.

## 6. The menu

**Before the menu, the profile.** `node <plugin>/scripts/task.js profile show`
prints the project's standing answer. Where `land.integration` and `land.push`
are set, do that — the injected rule already said which — and say so in one
line; the menu below is for a project that has not answered.

Present exactly these, and wait. Integration is the user's decision.

```
1. Merge back to <base> locally
2. Push and create a Pull Request
3. Keep the branch as-is
```

**Discarding is not on the menu.** It happens only when the user asks for it in
so many words, and then only against the typed word `discard`.

**Neither is uninstalling a plugin this session decoupled from.** Removing
one after its code has been unhooked is the user's own command, offered
here rather than run — say what was decoupled and that it can now be
removed, and stop there.

**Record the choice.** Once the integration is settled — by this menu, or by
the profile already answering it — run
`node <plugin>/scripts/task.js land merge|pr|keep [--push|--no-push]` before
step 7 executes it: `merge` for option 1, `pr` for option 2 (which always
pushes), `keep` for option 3. `profile suggest` counts these across a
project's past sessions, which is the only way `keep` ever becomes a
suggested answer — git's merge history speaks to `merge`, and to `pr` where
subjects read `Merge pull request`.

**Already on base.** Where the task has no worktree and its commits went
straight onto the base branch, there is nothing to merge: `task.js land merge`
records `direct` and prints
`fankeel — land: direct (already on <branch>, nothing to merge)`. `direct` can
also be typed as the verb. `profile suggest` leaves those records out of
`land.integration`, which takes `merge`, `pr` or `keep`.

## 7. Execute

**Merge:** from the main repo root, checkout base, pull, merge, then **re-run the
suite on the merged result**. A failure there stops everything — nothing has been
pushed, so it is recoverable; leave the branch and worktree in place and
investigate. Green, then clean the worktree, then `git branch -d`.

**Recorded as `direct`.** None of the above runs: there is no branch to merge
and no worktree to clean, and the suite record `task.js land` accepted was
taken on the base branch itself. What is left of this step is the push, or
not, as step 6 settled it.

**A task with its own worktree.** `node <plugin>/scripts/task.js show --session <id>`
prints a `worktree:` line when `task.js start` opened one under
`.fankeel/worktrees/<id8>/` on branch `fk/<id8>`. Run
`node <plugin>/scripts/land.js merge --session <id>`: it merges `fk/<id8>`
into the branch the main checkout is on with `--no-ff`, the message
`merge: <task>` and two trailers, `Fankeel-Task` and `Fankeel-Class`, and no
tag, and prints `<base>..<sha>`. Uncommitted files in the worktree, a subject
`commit.format` refuses, or `conflict <paths>` stop it with nothing merged and
both left in place. Re-run the suite on the merged result with the project's own test command (package.json's `test` script) from the main checkout, because `suite.js --session` runs in the worktree while it stands — or in the tree `--tree` named, for an entry with no worktree of its own — and its record is the gate before the merge, not after. That run takes no machine lock — only `suite.js` does — so start it when no `suite: waiting` or other suite is running here; only when that is
green run `node <plugin>/scripts/land.js clean --session <id>`: it removes the
worktree and runs `git branch -d fk/<id8>`, and a `-d` refusal is printed as
git said it — never retried with `-D`. A red suite leaves both in place, as
above. `scripts/residue.js` lists that worktree as in use, not spent, for as
long as the task's record is active.

**Agent branches.** `node <plugin>/scripts/residue.js` lists spent agent branches
(`worktree-agent-*`); commit.js landed
them by cherry-pick, so `-d` refuses them. `node <plugin>/scripts/land.js clean`
sweeps them (`residue.js --sweep`): it removes a clean spent worktree, runs
`git branch -D` on its branch, and prints what it kept — a dirty worktree, one
touched in two hours, any branch holding commits HEAD lacks.
Only what the sweep kept gets `git branch -D <name>` by hand.

**PR:** push, open it against the base, report the URL. **Keep the worktree** —
PR feedback gets fixed there.

**Keep:** say where the branch and worktree are.

Worktree removal refused for uncommitted files never gets `--force` on your own
initiative. Those files exist nowhere else. Show the user
`git status --porcelain -uall` and ask whether to commit them, move them, or
delete them.

Clean up only worktrees the project created under `.worktrees/`, `worktrees/` or `.fankeel/worktrees/`.
Anything else belongs to the host environment.

Record what this stage verified that a later stage will need again, one fact a
line: `node <plugin>/scripts/context.js add "<fact>" --at <path:line> --session <id>`.
Do not reopen a `path:line` that context.md already lists; its content is
inlined in your brief.

## Output

```
<sha> <subject>
要求: <the ask, one line>
做了什麼:
  - <what someone can now do>
為什麼這樣做: <the approach; what was given up>
驗過・沒驗過: <checked; not checked>
花費: <from record.js>
還剩什麼: <what is still not done>
suite: <suite.js line>
紀錄: <filed: line>
then AskUserQuestion
```

The report above the gate is the commit line, the six lines as `record.js`
printed them (step 2.0), `suite:` from step 1, and `紀錄:` with the `filed:`
value. `做了什麼:` is one line per thing someone can now do that they could not,
not a tour of the diff. Option one's
description names the month file and anchor.

After the user answers, the session's last message is the six lines as printed,
and nothing after them. A follow-up question the user asks after that is
answered, then the six lines are repeated as the last thing said.

`land` has no successor — what follows a finished route is a new task, which is a
decision rather than a transition.
