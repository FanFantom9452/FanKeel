---
status: current
last_verified: 2026-09-01
source_of_truth: this file, no upstream — a decision record is not derived from anything
---

# fankeel — the decisions and why

What was decided while building this, and the reasoning that would otherwise have
to be rediscovered. Not a plan and not a specification: the shape of the thing is
in `README.md`, the rules are in `skills/fankeel/SKILL.md`, and what it does is in
`tests/`. This is only the part none of those record.

It replaces the design spec, the discipline requirements and the implementation
plan, which were rewritten into this and deleted on 2026-08-21. Git still has
them; nothing about a spent checklist is worth carrying forward in the tree.

## The mode is a fact about the registry, not a flag

A session is in fankeel mode exactly when it owns an active entry. No second
source of truth, and no way to be in the mode without having said what you are
working on.

Nothing ever switches it off but the user. Claude Code sessions resume — a
`SessionStart` carries `startup`, `resume` or `compact`, and a resumed session is
the same session — so a `SessionEnd` hook clearing `active` would drop the mode
behind the user's back and read as the plugin turning itself off at random. There
is no `SessionEnd` hook, and the plugin ships two hooks rather than three.

## The rules are restated every turn, and only the current stage's

caveman sends its full ruleset once at `SessionStart` and thereafter a nine-word
pointer back to it; the strength of a pointer decays as its target recedes by
thousands of tokens a turn. Restating the real rules on every prompt is what
holds. It is affordable only because one stage's rules are sent rather than all
five, which is also why a wrong `stage` is worse than a missing one.

## Collisions key on paths, not on names

Two people describe one job two ways — "colour ramp" and "fix 7d" — and an
identity check on the name sees two unrelated tasks. The file is what actually
gets overwritten, so declared `scope` is what gets compared.

Staleness (12 hours) softens a claim and never withdraws it: it writes nothing,
deactivates nothing, and is an observation about age offered to the reader. If
the owning session comes back, its next prompt refreshes `updated` and it stops
being stale; nothing had to be repaired because nothing was broken.

## The guard blocks, but only when asked, and never on a stale claim

A warning that only ever warns is an instruction, and instructions get agreed
with and skipped — the same argument that took the discipline text out of
`survey`. So `PreToolUse` can refuse the edit.

It is off by default because a block is only as good as the `scope` field it
reads, and nobody yet knows how accurately scope gets declared; a plugin whose
first act is to lock you out of your own repository does not get a second chance.
`guard: "ask"` puts the collision in front of you at the moment of the edit,
which is the recommended setting; `"deny"` refuses outright.

Two rules keep it from becoming a lockout. A stale claim never blocks — a
terminal killed yesterday would otherwise hold a file shut until someone edited
the JSON by hand. And when both sessions declared the file, the older claim
holds and the newer yields, so two sessions that both named it cannot block each
other into a stalemate.

## Then it stopped being opt-in, because its reason had gone

2026-08-30. The section above is left as written; this is what changed under it.

The default was off because "a block is only as good as the `scope` field it
reads, and nobody yet knows how accurately scope gets declared". Observed claims
landed on 2026-08-24 and nobody declares a scope any more — `hooks/touch.js`
records the path an edit lands on, `lib/dirty.js` asks git for the rest. The
reason went out with the field it named, and the default outlived it by six days
because nothing re-reads a decision record when the thing it argues about is
deleted.

The two gaps in the claims looked like a replacement reason and are not one. A
write git cannot see, a write claimed only on the next prompt, a dirty file whose
mtime predates `started`, a pass of more than sixty paths — every one of them
makes the guard **miss** a collision. Missing one is what the old default did on
purpose, so a gap that misses more is not an argument for missing everything.

The argument that would have counted is over-blocking, and it has one source:
`lib/live.js` answers "live" for every liveness it cannot measure. That direction
was chosen while the default was a warning and warning too much was the failure
worth having. It is kept, because it is what decides between the two modes rather
than an obstacle to either: under `ask` an unmeasurable registry costs a keypress
and a message naming its holder, and under `deny` it would cost real work. So
`ask` is what absence means, and `deny` stays a thing you ask for.

`off` became a stored word in the same change. Deleting the field said the same
thing as its absence for as long as absence meant off; the moment absence meant
`ask`, deleting it turned opting out into opting in.

## The registry is found by walking up, not fixed at the launch directory

The nearest `.fankeel/` at or above where Claude Code was opened wins, the way
git finds `.git`, stopping below the home directory — a registry picked up from
the directory that holds every user account would be a surprise nobody could
explain from what they typed.

This is what answers "sometimes one project, sometimes several" without a second
mechanism. Put the directory at the workspace and every session opened in any
child joins one registry; put it in a project and it covers that project. The
decision moves from "where did I launch" to "where did I create it", which is
made once instead of every time.

It has to be visible, though. Scope paths are relative to the registry rather
than to the launch directory, so when the two differ the injected block names
both. A registry the user cannot see from what they typed is one they will
misread.

## Scripts where discipline text would have been

Twice the first cut was a rule asking the model to remember something, and twice
it was replaced by something that produces an artifact:

| Instead of | There is | Because |
|---|---|---|
| "search for one that already exists" | `scripts/survey.js` | A model does not know what the project already has; asking it to look does not change that. |
| "keep TODO.md an index" | `scripts/todo-check.js` | A dead link is silent, and an index pointing at things that no longer exist is worse than no index. |

Neither stores anything. A written index of what a project contains disagrees
with the code within months and is then read back with confidence, which is the
failure the whole plugin exists to avoid — the feature would have become its own
hallucination source. Reading `git ls-files` and the working tree costs a second
and cannot go out of date.

The declaration patterns are one shallow regex per language on purpose. A missed
declaration costs one line of a report; a real parser costs a dependency, and
this plugin has none.

### git was not enough, and the reasoning that said it was had a blind spot

`git ls-files` was the only source at first, on the reasoning that a repository
already carries an ignore list and a second one is waste to maintain. Run against
a real working directory, six of seven projects turned out not to be repositories
at all — and the scanner did not fail there, it found the one that was and
reported success. A wrong answer that looks right is the failure this whole
plugin exists to prevent, and it was coming from the plugin.

So: git inside a repository, a directory walk anywhere else, the better source
per subtree, and the report names which was used. The walk needs a skip list
after all, and it also skips spreadsheets, archives and binaries — the first real
run returned eleven thousand files whose visible portion was entirely
spreadsheets. That asymmetry is deliberate: inside a repository a tracked file is
tracked on purpose, and outside one nothing has said what belongs.

## Voice goes in the system prompt, not in the injection

A ruleset injected at `SessionStart` lands in the conversation, which is exactly
what compaction rewrites and what a long session pushes into the distance. That
is the mechanism behind every "it worked at first and then faded" report about
this kind of plugin.

Claude Code has a native place for it. An output style is appended to the system
prompt — sent verbatim on every request, never touched by compaction, and inside
the cached prefix after the first turn. So fankeel ships `outputStyles/` rather
than injecting a voice, and the split is:

| | Where | Cost |
|---|---|---|
| How to talk — fixed for the session | output style, system prompt | Once, then cached |
| What is being done now — changes | the per-turn injection | ~200 tokens a turn |

Style does not go in the injection: that is paying every turn for something the
system prompt carries for free.

The dynamic half is the one line of output *shape* on each stage. A system prompt
is fixed for the session and the stage is not, so "quote the scanner" at `survey`
and "say almost nothing" at `build` can only live in the injection.

### The style is set by a skill, not by sending people to /config

An output style is the right mechanism and `/config` is where people never go.
*(Superseded in 0.20.0: the `fankeel-style` skill was removed. The three styles
still ship and are picked in `/config`; what came out was the skill that set one
for you, and the entry field and injected digest that existed to cover the gap
before it took effect.)*

They do not change settings; they say "answers are too long". So `fankeel-style`
is a skill over a script that writes the same `outputStyle` field `/config`
writes.

Nothing about it is fankeel-specific, deliberately: a style set this way survives
uninstalling the plugin, because it is the user's setting rather than this
plugin's state. The script is defensive about `settings.json` for the same
reason — other tools write that file, so unknown keys are preserved, the first
change is backed up, a file that does not parse is reported rather than
overwritten, and the write goes through a rename.

**The gap.** A `settings.json` change may not reach a session already running.
Rather than shipping a tool that says "it's set" when the user will not see it
until they restart, one constant — `SETTINGS_RELOAD_IS_LIVE` — records the
observed answer, and while it is false the script also writes a four-line digest
onto the session entry for the hook to inject. Four lines rather than the whole
style: a digest injected every turn accumulates in the transcript, and paying
that to enforce brevity would be self-defeating.

No `force-for-plugin: true`, because it overrides whatever the user chose and
fankeel is opt-in per session. And the skill never picks a style on the user's
behalf — it changes the voice of every session on the machine, including the
ones they are not looking at.

The always-on rules stay in the injection even though `fankeel-pipeline`
repeats them. A style is the user's choice, a hook cannot see which one is active,
and losing the rules whenever the user picks something else costs more than
repeating them every turn.

## A subagent gets a brief, and it is the best-value text here

A subagent starts with none of the parent's context and the per-prompt injection
cannot reach it, so `SubagentStart` hands it one instead.

The reason it is worth more than anything else in the plugin is the asymmetry.
What a subagent reads is input, in a context thrown away when it finishes. What
it returns is output — five times the price — and then occupies the parent's
context for the rest of the session. 280 tokens spent to take a thousand off a
return value is a trade that always pays, and it pays in the resource a long
project actually runs out of, which is window rather than money.

It carries the task, the scope, what the return value costs, and the voice digest
if one is set. It does not carry the stage rules: a subagent is not running the
pipeline, it is doing one bounded job inside somebody else's stage.

A subagent never gets a registry entry. It is not a session and does not own a
task, and an entry would make it a second claimant on its own parent's files.

Not built, deliberately: a different brief per `agent_type`. The hook can match on
the type, but which types deserve their own is a question real use answers and
guessing produces five briefs nobody tuned.

## Task memory is two capped fields, and the caps are in code

Planned as a versioned `.fankeel/memory/`; cancelled. Claude Code already
remembers in four places — `CLAUDE.md`, its own memory directory, git history,
the compaction summary — and a fifth store would have overlapped all four while
being the only one nobody reviews.

What none of the four holds is the state of a task in flight: what was tried,
what was decided on the way, what comes next. That is small by nature, so five
notes of 100 characters and one `next` line of 120 is the shape of the thing
rather than a limitation. The caps live in `lib/registry.js` because a cap that
depends on being remembered is not a cap.

Accepted: task memory does not cross machines and no one else on the repository
sees it. Anything that should cross machines belongs in a commit message,
`CLAUDE.md` or `TODO.md`, all of which are reviewed and none of which are this.

## Smaller calls, with their reasons

| Decision | Why |
|---|---|
| State in the project, not `~/.claude/` | One repository checked out twice on a machine gets one registry, not two. |
| `.fankeel/.gitignore` holding `sessions/` | Leaves the project's root ignore file alone, and makes "versioned" the default for anything added under `.fankeel/` later. |
| The file is named for the session id | No session can write another's, and no id has to be invented. |
| Nothing derived from the git branch | Free, and useless in a repository whose work all happens on `main`. |
| The badge word is the stage, not an intensity | An intensity is set once and never looked at; a statusline earns its space by showing what changes. `clash` takes the slot when it applies. |
| Both hooks exit 0 on every path | A `UserPromptSubmit` hook that throws blocks the prompt, and a `PreToolUse` hook that throws blocks the edit. A plugin that can wedge a terminal is worse than no plugin. |
| A corrupt entry is skipped silently by the hook | It is reported by `/fankeel`, so the failure is visible somewhere, just not on the hot path. |
| Five stages | Each has to earn its own rules, and a list nobody can hold in their head is a list nobody follows. `land` has no successor: what follows it is a new task, which is a decision rather than a transition. |
| A failed audit at `land` reports rather than blocks | Nothing enforces stage transitions, so "block" would have nothing to block with — discipline text wearing a gate. Revisit if transitions ever become enforced. |

## The route is per task, not a fixed list

Five fixed stages made the progress indicator lie in both directions. A one-line
typo fix sat at 2 of 5 looking permanently unfinished, and work that genuinely
needed a documentation pass got no stage to do it in.

So a task carries a `route`: the stages it will go through, in order, assembled
at the start from what the task is. The vocabulary stays closed — six stages,
each with rules that had to be earned — but the sequence is the task's. `stage`
refuses a step off the route rather than silently adding one, because a task that
quietly grew two stages is a task whose progress nobody can read.

`audit` is the sixth. It asks what stopped being true, which is a different
question from `verify` — verify asks whether the change works, audit asks whether
the things that describe it still match.

*(Extended in 0.24.0: `plan` became the seventh, between `design` and `build`.
Approving a plan is a human gate and `build`'s own discipline is that it does not
stop to ask, so a plan written inside `build` puts a gate in the one stage that
must not have one. The vocabulary is still closed, and the routes are now picked
from three named classes rather than assembled by hand.)*

## Documents have roles, and the role says what may be stale

A checker that treats every markdown file alike is a checker nobody keeps. An
archive is supposed to name code that no longer exists; a plan is supposed to name
code that does not exist yet; a decision record is supposed to name code as it was
on the day it was written. Only a reference page is claiming to describe the
system now.

Both of the false positives that killed the first run were this: a month-old plan
in Waypoint for naming files that were never built, and this repository's own
decision record for naming a `.fankeel/memory/` that was considered and rejected.
Reported alike, the one finding that mattered arrived buried.

So `.fankeel/docs.json` declares buckets as path plus role, and it is
version-controlled because it is a fact about the project rather than about a
session. Two shapes ship, both copied from repositories that already existed
rather than invented, and neither is imposed.

## Other people's plugins get used when they are there

`audit` covers documents, which nothing else does. For the code half, ponytail
already does it better than a reimplementation would, and graphify and codegraph
answer a question this scanner cannot.

Reading `installed_plugins.json` costs one file and makes the rule honest in both
directions: use theirs when theirs is installed, say plainly when it is not.
Depending on them outright would break for anyone without them; reimplementing
them would be worse at it and would put fankeel in the business of being a plugin
directory.

Where it lands is split, and the split is the budget. The injected block gets one
clause — `audit`'s `{{PONYTAIL}}`, filled by `lib/render.js` from
`lib/plugins.js` — because that block is sent every turn and has about two
hundred characters of headroom. graphify and codegraph are named in
[skills/fankeel/SKILL.md](../../skills/fankeel/SKILL.md) instead, which is read
once on entering a stage and can afford a table. A catalogue of all three lived
in code for a while with nowhere to be printed; it was deleted on 2026-08-29
rather than given a home the block could not pay for.

Their *shape* was worth taking and their text was not — tags, one line per
finding, an explicit boundary, and a sentence for when nothing was found. That is
a way of writing a report, not anybody's property, and the subject differs enough
that copying would not have helped.

## One caller is not evidence on its own

`lib/ledger.js`, `lib/plugins.js` and `lib/dirty.js` each have exactly one
production caller. Counted from outside that reads as three dead seams, and an
audit opened a TODO entry saying so for two of them. It is one borderline case
and two files doing their job, and the rule that separates them is worth writing
down because the count keeps looking like the answer.

**A module with one caller is evidence of a dead seam only when folding it would
neither move a dependency the caller does not otherwise have, nor put a unit test
behind a process spawn.**

| module | its one caller | what folding it would cost |
|---|---|---|
| `lib/ledger.js` | `scripts/ledger.js` | six pure text functions reachable only through `execFileSync`. `skills/fankeel-build/SKILL.md` also names the file as `source_of_truth` |
| `lib/dirty.js` | `hooks/inject.js` | the same one directory over: a hook is an entry point a test can only run as a process |
| `lib/plugins.js` | `lib/render.js` | `render.js` does no reading of its own anywhere: `registry.js` reads the session file, `context.js` the transcript, `plugins.js` the manifest, and `render.js` itself requires only `path`. Folding puts its first `readFileSync` in the module whose whole job is producing text |

The first two are the same case and it is not really about the count: the caller
is a process entry point, so the seam is the only thing a unit test can hold.
Only `lib/plugins.js` is lib-to-lib, which is where the count would have been
evidence — and what settles it there is a pattern the caller already keeps three
times over, one module per file it needs read.

The counts are where the question starts, not where it ends.

## A hook that cannot tell a wrong id from no plugin says nothing

A session id that never appears in the registry resolves to a path that does not
exist, and `lib/registry.js:140` returns null. Every hook then returns quietly.
The question that kept coming back is whether that silence hides a real bug —
whether a hook handed the wrong id should say so.

It cannot, and the reason is that there is nothing to say it about. A file that
is not there is byte-for-byte what a session not using this plugin looks like, so
any output would fire for every one of them. That is the opposite of the contract
every hook here is built on: exit 0 on every path, and cost nothing for a session
that is not in the mode.

The premise is also thinner than it reads. No hook takes an id from typed input —
`brief.js:33`, `carry.js:47`, `gate.js:27`, `guard.js:24`, `inject.js:52`,
`resume.js:28` and `touch.js:28` all read `payload.session_id`. A wrong id
reaching one of them would mean Claude Code passed a wrong one, which is not a
thing a warning in a hook would help anybody fix.

What the entry was actually worried about — a corrupt entry visible in no view at
all — was already answered, one directory over and in the one place a person is
looking rather than a hook firing. `readAll` returns the unreadable count beside
the entries it could parse, and `task.js` refuses an id no running session
claims. Both of those have a reader. A line printed from inside a hook does not.

## The document checker stops where the machine stops

`scripts/docs-check.js:8-18` states its own boundary: it reports what can be
decided mechanically, and leaves the rest to `audit`, where a person reads. A
`path:line` that no longer resolves is mechanical. One past the end of a file is
mechanical, and is reported as `past-end`. One that still resolves but now points
at the wrong line is not, and the difference is not a matter of effort.

Deciding it needs someone to know what the citation was meant to point at, and
nothing on disk records that. `lib/map.js:323` becoming 342 is only visible as
drift to a reader who knows what was at 323. Every mechanical proxy for that —
look for a symbol near the line, compare against the last commit that touched
both — answers a different question and reports on the occasions it disagrees
with itself.

Five citations drifted in one build, which is what reopened this. They stay
unreported, and that is the trade: this tool's findings are worth acting on
because none of them is a guess, and one heuristic is enough to make a reader
check the next twenty by hand.

## What is still a guess

The stage list. Five, named for what they produce, is a first cut; whether
`survey` earns its place and whether the rules fire at the right moments are
questions only real use answers. Tracked in [TODO.md](../../TODO.md).

`PreToolUse` does not fire for `AskUserQuestion`, and what to do about that is
open. `hooks/gate.js` was written to mark the moment a gate opened;
`hooks/resume.js` is the other end and works. The registration is present in the
copy that actually runs — the plugin cache's `plugin.json` is byte-identical to
this repository's — and two sessions since it was installed recorded nothing: one
ran `design,build,verify,land` to completion with `clock` and `burn` written to
its entry by the sibling hooks and neither `gateAt` nor `waited`, and the session
that settled these decisions made three gates with the same result. The one
`waited` value on record belongs to the session whose task *was* building the
feature, and its window straddles the commit that installed the hook, so it is
not evidence either way.

Whether `gate.js` is deleted, kept against a future release, or replaced by a
measurement `resume.js` can take alone is three different answers, and none of
them was asked here.

Whether `fork` changes the session id. `hooks/carry.js` now runs on it, and the
matcher is correct either way — the self-check at `:59` covers an unchanged id
and `live.isLive` at `:60` covers a predecessor still running — but nobody has
watched a `fork` reach the hook. Correct in both branches is not the same as
measured.
