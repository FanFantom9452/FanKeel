---
status: current
last_verified: 2026-09-29
source_of_truth: agents/*.md, lib/profile.js
---

# Model choice

Open decision: which model each role runs on, and what effort each model runs at.

Today every agent file in `agents/` pins its own `model:` in frontmatter. Six pin
`sonnet` (brain, fixer, reader, render-reviewer, reviewer, verifier);
`fankeel-judge` pins `fable` and `fankeel-mockup` pins `opus`. Each file also pins an
`effort:`. The profile can already name a model for two roles, `judge.model` and
`design.mockup`, and for no other agent.

## To settle

- **a. Settled 09-29: profile keys that override an agent's pinned model.** Every
  file under `agents/` gets `agent.<name>.model` and `agent.<name>.effort`; a key
  replaces that line in a generated override file rather than in the plugin's own
  (`lib/agentfile.js`, item c below).
- **b. Settled: `haiku` not allowed for now.** 09-29, decided by the user: not strong
  enough; use sonnet 5.5. `haiku` stays a legal value of `judge.model`.
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
