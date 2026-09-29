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

- **a. Profile keys that override an agent's pinned model.** Which agents get a key,
  and what a key does when it names a model the agent's file does not pin.
- **b. Settled: `haiku` not allowed for now.** 09-29, decided by the user: not strong
  enough; use sonnet 5.5. `haiku` stays a legal value of `judge.model`.
- **c. A default effort per model.** Settled by whoever picks the models.
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
model and leave the effort as pinned.
