---
status: current
last_verified: 2026-10-09
source_of_truth: agents/*.md, lib/profile.js
---

# Model choice

Open decision: which model each role runs on, and what effort each model runs at.

Today every agent file in `agents/` pins its own `model:` in frontmatter:
`fankeel-judge` pins `fable`, `fankeel-mockup` pins `opus`, and every other one pins
`sonnet`. Each file also pins an `effort:`. The profile names a model for two roles by
keys of their own, `judge.model` and `design.mockup`, and for any agent by
`agent.<name>.model` (item a below).

## To settle

- **a. Settled 09-29: profile keys that override an agent's pinned model.** Every
  file under `agents/` gets `agent.<name>.model` and `agent.<name>.effort`; a key
  replaces that line in a generated override file rather than in the plugin's own
  (`lib/agentfile.js`, item c below).
- **b. Settled 10-08: `haiku` for `fankeel-mutator`, `fankeel-mover`, `fankeel-implementer`
  (only where the plan already holds the code, i.e. the plan Dispatch line `implementer, haiku`)
  and `fankeel-reader`.** The 09-29 ruling was about Haiku 4.5; Haiku 5.5 is re-measured, see the
  last section. Each is set by the user with `node scripts/task.js profile set agent.fankeel-<role>.model haiku`;
  this page does not change the profile. **Revised 10-09: `fankeel-reader` back to `sonnet`**,
  the other three unchanged, after the twelve-item bank (last section).
- **c. Settled 09-29: a default effort per model.** Claude Code's model-config
  documents medium as the default effort of Sonnet 5.5 and Opus 5.5, and the agent
  files keep the `effort:` they pin. Raising one role's effort for a single task goes through
  `task.js profile set agent.<name>.effort <e>` (`--default` writes the config dir,
  otherwise the project), which writes `.claude/agents/<name>.md` outside the plugin
  cache (`lib/agentfile.js:64-82`, `syncAgent`).
- **d. Whether any role runs with an advisor.** Claude Code's `advisorModel` lets the
  executor consult a stronger model on its own initiative, with the whole transcript
  and no question of its own — so it cannot replace `/fankeel-ask`, which needs a
  stated question and a filed verbatim answer. Open: whether the main session,
  `fankeel-brain` or implementers get one, and on which model. Mechanism as read
  on 09-29: [the advisor report](../reports/2026-09-29-advisor-tool.md).

## Constraint on c

The Agent tool cannot set effort. Only an agent file's frontmatter `effort:` can. So
a default effort per model can only be done by editing the frontmatter of each agent
file, or by generating it from the profile; a profile key alone would change the
model and leave the effort as pinned. Item c settles it: the pinned `effort:` stays,
and a per-task raise goes through the override file. It is the plugin's own agent file
with `model:`/`effort:` replaced and `generated_by: fankeel <version>` added
(`lib/agentfile.js:46-60`); the profile unset command removes it (`lib/agentfile.js:71-75`);
`task.js start` rewrites one left by an older plugin version (`lib/agentfile.js:95-109`,
called at `scripts/task.js:721`); and `hooks/title.js:28` (`overrideFor(input.subagent_type`)
sends `fankeel:<name>` as `<name>` when such a marked file exists (`lib/title.js:106-121`), because
only the bare name reaches it.

A raise for one dispatch is shipped rather than generated: `-high` and `-xhigh`
copies of `fankeel-brain`, `fankeel-implementer` and `fankeel-reviewer`
(`renderVariant` in `lib/agentfile.js`, written by `scripts/variants.js`),
because a plugin agent loads at startup and a file written mid-session was
never measured to resolve. A plan's `**Dispatch:**` line
`implementer, <model>, <effort>` sends the implementer and its reviewer at that
effort, approved at the plan gate; `ledger.js lint` refuses any other value.
The controller asks the user before it sends a brain at `high` or `xhigh`, and
only for a stage it judges needs deep thought (`controlRules` in
`lib/stages.js`). The override file above stays the per-role route.

## Fast mode

Fast mode cannot be given to some subagents and not to others (checked on
2026-10-05 against Claude Code's fast mode documentation). It is one switch
for the whole session, turned with `/fast`; neither the Agent tool's
parameters, an agent file's frontmatter, nor a Workflow `agent()` call has a
field for it. It runs only on Opus models — Opus 5.5, Opus 5 and Opus 4.8 — so
a `sonnet` implementer, reader or reviewer has no fast version to be given.
Whether a subagent with no `model` of its own inherits fast from a session
that has it on is not documented and was not measured. Giving fast to the
sonnet subagents alone waits upstream, in a blocked TODO entry, on Sonnet
supporting fast or on fast being settable per agent.

## Haiku 5.5, ruled onto four roles

On 09-29 the user ruled `haiku` out ("not strong enough; use sonnet 5.5"). That ruling was
about Haiku 4.5, and no figure stood behind it. An external measurement of Haiku 5.5,
228 `claude -p` runs on single task shapes with two-sided controls
([2026-10-08 external model bench](../reports/2026-10-08-external-model-bench.md)), found it
passing scripts, review, multi-source verification and agentic fixes n/n at effort `high`,
and failing inline counting over about 45k tokens. Its evidence is in another repository,
so its figures cannot be recomputed here.

`scripts/bench.js` then measured fankeel's own subagents one role at a time, five runs of
haiku against five of sonnet, counting only the subagent's own spend
(the plan `docs/99-archive/2026-10-08-haiku-bench.md`, [the report](../reports/2026-10-08-haiku-bench.md);
the figures are in the report and are not retyped here). In the valid batches every role's
haiku arm ran n/n valid. The mutator, mover and implementer verdict lines say `haiku`. The
reader verdict line says `not haiku`: the rerun had one non-passing run per arm, a wrong
answer on sonnet and a too-strict path check on haiku, and the user overrode that verdict.
The report says which batches are void and why.

On 10-08 the user ruled `fankeel-mutator`, `fankeel-mover`, `fankeel-implementer` (only where
the plan already holds the code) and `fankeel-reader` onto `haiku`. The user sets each with
`node scripts/task.js profile set agent.fankeel-<role>.model haiku`; this page has not run
it and does not change the profile. Since `hooks/title.js` replaces a dispatch's explicit
model with a generated override's pinned model, the override wins over the model a dispatch
names ([subagents](subagents.md)).

On 10-09 `scripts/bench.js` measured the four roles again on twelve items each, in three tiers
([the report](../reports/2026-10-09-haiku-bank-drift.md)). Its rule, every haiku run valid and
passing, said `haiku` for mover and implementer and not for reader or mutator. Reader's haiku
arm cited the line that merges the config three times on mid-config-chain, where the value is
written one file over, and the judge marked it `fabricated`. Mutator's 35 valid haiku runs all
passed; its one invalid run was the relay rewriting the prompt it dispatched. The user moved
`fankeel-reader` back to `sonnet` and kept the other three on `haiku`; `.fankeel/profile.json`
says `"agent.fankeel-reader.model": "sonnet"`.

Haiku 5.5 is not ruled for any other role (reviewer, verifier, brain, judge-excepted and the
rest): no profile and no plan sends `haiku` for a role not listed above.
