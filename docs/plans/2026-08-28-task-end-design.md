---
status: design-intent
last_verified: 2026-08-28
source_of_truth: lib/stages.js, lib/render.js, lib/registry.js, .claude-plugin/plugin.json
---

# What happens when a task ends

**Goal:** make the end of a task the place the pipeline says three things it has
never said — what shipped, that `/clear` comes after standing down and not
before, and, when someone gets that order wrong, that a task was left behind.

## The one sentence

**A task ends at `land`, so that is where the advice goes; and `/clear` is the
one continuation that changes the session id, so that is what the new hook
listens for.**

## What was measured first

`/clear` starts a new session. Nine transcripts under
`~/.claude/projects/F--ymlab-fankeel/`; seven carry `<command-name>/clear</command-name>`
at line 8 — the first real user entry of the file — stamped with **that file's
own new `sessionId`**. The two without it were started by launching `claude`.

The pid does not change. `<config>/sessions/<pid>.json` holds one `sessionId` and
is rewritten, which two live pid files on this machine demonstrate: both name
sessions whose transcripts open with a `/clear`.

So the registry, keyed by session id, sees this:

| | after `/clear` |
|---|---|
| the new session | no entry. The mode is off: no injection, no stage rules, no badge |
| the old entry | still `active: true`. Invariant 2 forbids closing it unasked |
| the old entry's liveness | dead immediately — its id is gone from the rewritten pid file |

Nothing is corrupted and no phantom collision appears. The task simply stops
being read, and nothing says so.

`resume` and `compact` keep the id, which `docs/registry.md:94` already states.
It stops there, and a reader takes the list as complete.

## The hook contract, measured from the binary

`~/.local/share/claude/versions/2.1.247`:

```
@206697077  hook_event_name: n("SessionStart"),
            source: a(["startup","resume","clear","compact","fork"])

@206693141  the envelope every event spreads:
            { session_id, transcript_path, cwd, prompt_id?, permission_mode?,
              agent_id?, agent_type?, ... }

@150294662  p = {...Ys(d,ze()), hook_event_name:"SessionStart", source:t, ...}
            yield* ld({ session:e, hookInput:p, matchQuery:t, ... })
```

Three things follow, and none of them needed guessing:

- `matchQuery` **is** `source`, so `"matcher": "clear"` is exact. The hook never
  runs on an ordinary startup.
- `session_id` and `cwd` carry no `.optional()`, so `registry.rootFor(payload)`
  works unchanged. No new plumbing.
- `agent_id` is the subagent discriminator, and the binary says so in as many
  words: *"Absent for the main thread, even in `--agent` sessions. Use this field
  (not `agent_type`) to distinguish subagent calls from main-thread calls."* A
  subagent must never be offered a task — the skill's own invariant.

## The budget

Measured today by `tests/render.test.js:415` at the 59-character reference root:

```
survey 2371   design 2109   plan 2371   build 2394
verify 1883   audit 2389    land 1906   init 1364     cap 2400
```

`land` has **494 characters**. `build` has six, so `ALWAYS` is closed — every
word of this lands in `land`'s own rules and its template. The design record for
the gate rules states the standing rule: 2400 "should be the last" raise, and a
stage now has to displace a rule to gain one. Nothing here asks for room.

## The change

### 1. `land` says what shipped

`lib/stages.js` `land.template`:

```
<sha> <subject>
shipped:
  - <what someone can now do that they could not>
cost: <what it took>
open: <what is still not done>
then AskUserQuestion
```

The slot is phrased as a capability rather than as a change, because a commit
subject already holds the change and the thing it cannot hold is a task that
shipped four of them.

One new rule names the source, and the existing `Output:` rule stops saying
"three lines":

```
shipped: is one line per thing someone can now do that they could not, from
the ledger's completed entries where there is one.
```

The ledger already records exactly this — `ledger.js complete <n> "<what
landed>"` — so a plan-driven task has the list written down before `land`
starts. A `bounded` task has no plan file and lists them itself, which for one
to three items is not a burden worth new bookkeeping.

### 2. `land` says the order

```
Option one stands the task down, and `/clear` comes after it, never before:
a clear first leaves the entry active with no session reading it, because a
cleared session gets a new id.
```

This is the answer to "the context percentage arrives at the wrong moment". It
does — mid-task, when the cost of stopping is highest. The moment worth clearing
is the one where the context has no remaining value, and that moment is here.

`lib/context.js` is deliberately untouched. What it reports is what has *already*
been lost to compaction, which is a real signal at any point in a task; the
complaint was about its advice arriving early, and the fix for that is this rule
existing, not that one being weakened.

### 3. `hooks/carry.js` — the task the clear left behind

```
SessionStart, matcher "clear"
  → payload.agent_id present?        return. A subagent owns no task.
  → root    = registry.rootFor(payload)
  → state   = live.readLive(live.liveConfigDir(), payload.session_id)
  → orphans = registry.readActive(root)
              .filter(not live.isLive(state, id, data.configDir))
              .filter(not registry.isStale(data, now))
  → none?   exit 0, having written nothing
  → else    one block: the task, its stage and place on the route, how many
            files it claimed, its notes, its next, and the adopt command
            already filled in with both ids
```

The block it writes, settled at the gate on 2026-08-28:

```
FANKEEL — /clear left a task behind, and nothing is reading it now.

  task:  rework the 7d deviation colour ramp
  stage: build (3 of 5)  ·  touched 4 files  ·  last <1h ago
  notes:
    - ANSI 256 has no true mid green; the 46→83→120 run is the only clean path
  next:  wire the badge word into TokenBar

Adopt carries all of it — task, route, claims, notes, next:
  node <plugin>/scripts/task.js adopt 91cb1004-… --session f5305659-…

Leaving it is fine too; /fankeel → Clear out puts it down without taking it.
```

`notes` are in it because this is the last place they can be seen. They die with
the task, and this is the moment the task is closest to going unclaimed — a
shorter block would cost a whole turn of `/fankeel` to recover what it dropped.

It writes nothing. Not the registry, not a badge, not the entry it names —
invariants 1, 2 and 4 all forbid it, and `adopt` is a decision the user makes.
Like `inject.js` and `resume.js` it exits 0 on every path.

**The freshness window is `registry.STALE_MS`, which is already 12 hours**, and
it is what separates this clear's casualty from an ordinary abandoned record. An
entry last touched three days ago is not what the user just cleared; it is what
`/fankeel` → **Clear out** is for. Newest first, at most three, though in
practice there is one.

Every function it needs exists: `rootFor`, `readActive`, `isStale`, `ageText`,
`notesOf`, `nextOf`, `claimsOf`, `readLive`, `isLive`. The hook is a filter and a
render, and `lib/render.js` gains `renderCarry` beside `renderInit`,
`renderResume` and `renderBrief`.

### 4. The pages

`docs/registry.md:94` gains the third case. It is the one page marked `current`
that this change touches, and leaving it would make it say the opposite of the
hook: resume and compact are the same session, `/clear` and `fork` are not.

`skills/fankeel-land/SKILL.md` `## Output` and `docs/pipeline.md` `### land`
carry copies of the template and move with it.

## Files

| file | change |
|---|---|
| `lib/stages.js` | `land.template` gains `shipped:`; one new rule for its source, one for the down-then-clear order; the `Output:` rule stops saying "three lines" |
| `hooks/carry.js` | new. SessionStart on `clear`: reports an active entry whose session is gone, writes nothing |
| `lib/render.js` | `renderCarry` |
| `.claude-plugin/plugin.json` | a `SessionStart` entry, `"matcher": "clear"`, timeout 5 |
| `docs/registry.md` | `:94` gains `/clear` and `fork` |
| `skills/fankeel-land/SKILL.md` | `## Output`, and a step for the order |
| `docs/pipeline.md` | `### land` |
| `tests/carry.test.js` | new |
| `tests/stages.test.js` | `land`'s rules name `shipped` and the clear order |
| `TODO.md` | `fork` under `## Waiting` |

## Proves it done

Four assertions that fail against today's tree and pass after:

1. `tests/carry.test.js` — an entry that is `active`, not live, and under twelve
   hours old, under the payload's `cwd`, produces a block containing
   `adopt <that id>`.
2. The same entry with its session **live** produces empty output.
3. A payload carrying `agent_id` produces empty output, whatever the registry
   holds.
4. `byName('land').rules.join(' ')` matches `/shipped/` and the clear order.

And one that must keep passing, because it is the constraint this design is
shaped around: every stage's injection stays under 2400 at the reference root.
`land` moves from 1906 to roughly 2240.

Full suite green.

## What was rejected

| approach | why it lost |
|---|---|
| put the down-then-clear rule in `ALWAYS` | six characters left on `build`. It would displace a rule that every stage needs to buy one that only `land` uses |
| have the hook offer `adopt` for `fork` too | `fork` is unmeasured, and its predecessor may still be **live** where a cleared one is certainly dead. The same handling would tell someone to take a task off a running session |
| have the hook stand the old entry down itself | invariant 2. Nothing closes a task but the user, and a hook that tidied up would be the one thing this registry is built not to do |
| weaken `lib/context.js` | its subject is loss that has already happened, which is worth saying whenever it is true. The complaint was that nothing spoke at the right moment, and this adds that rather than removing the other |
| drop the twelve-hour window and report every dead entry | that is `/fankeel`'s job and it already does it. On `clear` the useful claim is narrow: *this* is what you just put down |
| take the shipped list from `git log <base>..HEAD` | the first `land` rule is "commit the reason, not the diff", so the subjects are reasons. Reading them back as a feature list would fight the rule the same file sets |

## What is still open

- `fork`: whether it changes the session id, and whether the session it forked
  from stays live. Both are inferred from the name and the schema, neither is
  measured. `TODO.md`, `## Waiting`.
- Whether `SessionStart` fires for subagents in practice. The code path is
  parameterised for it and `agent_id` documents it, so the guard goes in either
  way; it is one line and correct even if it never triggers.
- `docs/plans/2026-08-27-gate-rules{,-design}.md` are `status: current` in the
  `plan` bucket with their work landed at `b57c264`. Landed plans read as current.
  Noted at survey, not this task's to move.
