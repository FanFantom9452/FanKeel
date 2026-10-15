---
status: design-intent
date: 2026-10-15
task: render reviewer 強制、effort 探針、未派 agent 的去留
judgement: docs/90-agent/judgements/2026-10-15-agent-effort-usage-render.md
---

# Render review becomes a refusal, effort becomes a parameter, unused agents get a ruling

Three independent parts, one spec. The judge's answer
(`docs/90-agent/judgements/2026-10-15-agent-effort-usage-render.md`) is the
input; where this spec departs from it, the section says so and why.

No mockup: nothing here puts something new on a screen. The page this changes
is what a script refuses, not what a page shows.

## 1. A page change cannot complete without a render verdict

- `.fankeel/render.json` pages take an optional `"src": [globs]`. `lib/shots.js`
  `parseTargets` accepts it (an array of non-empty strings, else the existing
  refusal shape) and a new export `pagesTouched(targets, paths)` returns the
  names of the pages whose `src` matches any path. Matching is
  `path.matchesGlob` (Node 22+; this machine runs 24) on `/`-separated paths.
- A project with no `render.json`, or whose pages carry no `src`, is never
  refused — the skill's "where the project has one" stays the condition.
- `scripts/ledger.js complete` and `fix`, given `--range`, run
  `git diff --name-only <range>` and call `pagesTouched`. A non-empty result is
  refused unless either:
  - `--render <file>` is passed and the file's first non-blank line is
    `disposition: ship`; its path is written into the ledger entry; or
  - the ledger holds a `Ruling: render skipped — <why>` line written since this
    task's last `complete`/`fix` entry — so one task's skip never covers the
    next. `<why>` must be non-empty.
- The refusal names the pages, the paths that hit them, and both ways through.
- `VERB_FLAGS` gains `render` for both verbs.
- **Departure from the judge:** the no-ledger seat is `task.js stage`, not
  `commit.js`. `commit.js` runs before a task's reviewers — it prints the range
  they review — so a check there would demand a render review of a commit that
  does not exist yet. Instead, `task.js stage <next>` leaving `build` on a route
  without `plan` intersects the entry's `claims` with `src`, and refuses unless
  `--render <file>` (same first-line rule) is passed or a note reads
  `Ruling: render skipped — <why>`. A route with `plan` has the ledger check and
  is not checked twice.
- Design's mockup is not gated: there is no real page to shoot, and the tuning
  loop is already the user looking at it.
- `skills/fankeel-build/SKILL.md` (~442-454) and `skills/fankeel-verify/SKILL.md`
  (~253) name `--render` and the ruling line; the build skill names
  `task.js stage --render` for the no-plan route.

## 2. Effort is sent on the dispatch, not baked into a file

Probe, 2026-10-15, this session: two `fankeel:fankeel-reader` dispatches on
opus, one with `effort: "high"`. Its `agent-*.prefix.json` carried
`effortValue: "high"`; the control's carried `medium`, the agent file's
`effort: medium`. The call's `effort` overrides the agent file.

- Delete the six variant files (`agents/fankeel-{brain,implementer,reviewer}-{high,xhigh}.md`),
  `scripts/variants.js`, and `VARIANT_EFFORTS`/`renderVariant` in
  `lib/agentfile.js` (`syncAgent` and the profile's `agent.<name>.effort` stay —
  they are per-role, a different job). `.claude-plugin/plugin.json` drops the six.
- The plan's `**Dispatch:**` third field keeps its form (`implementer, opus, high`)
  and its lint; what it means changes: dispatch `fankeel:fankeel-implementer`
  with `effort: "<field>"`, and its reviewer with the same. `lib/plantasks.js`
  comment, `skills/fankeel-plan` (~205-210), `skills/fankeel-build` (~218, ~430).
- `lib/stages.js`: the "Deep thought?" rule sends `fankeel:fankeel-brain` with
  `effort: "high"`/`"xhigh"`; the build agent list drops `-<effort>` names.
- `lib/title.js` `prefixFor` reads `toolInput.effort` before the file's
  `effort:` — the probe's own title read `· medium` on a high dispatch.
- `docs/90-agent/reference/model-choice.md` (~43-44) and `subagents.md` (~119)
  carry the probe, dated; the effort-1 TODO entry closes.
- Tests that list or render variants (`agents`, `agentfile`, `guard-variant`,
  `title`, `stages`, `brief`, `dispatch-gate`, `init-docs`) follow.

## 3. Every agent never dispatched here has a ruling

Decided with the user, 2026-10-15:

| agent | ruling | why |
|---|---|---|
| implementer-xhigh, reviewer-xhigh, brain-high | delete | section 2 retires every variant |
| mover, mutator | keep — stage agent only | they exist because the stage agent cannot Edit; in-session audit/land move files themselves and in-session verify has no mutation step |
| writer | keep — stage agent only | build/audit stage agents write human pages through it; in-session the session writes them |
| init-scout, slimmer | keep, no change | `fankeel-init` dispatches both; this repository never ran init |

- The ruling is written as one decision record, `docs/03-decisions/2026-10-15-unused-agents.md`
  (human, 決定 / 為什麼 / 放棄了什麼), and `subagents.md` names which agents
  only a stage agent dispatches.

## Proves it done

- `tests/ledger.test.js`: a range touching a `src` glob is refused without
  `--render`; accepted with a `disposition: ship` file; refused with a
  `disposition: fix` file; accepted after a ruling line; a later task is refused
  despite the earlier ruling; a range touching no page is untouched. Fails now.
- `tests/shots.test.js`: `src` parsed, a non-array refused, `pagesTouched`
  matches and misses.
- A `task.js stage` test: leaving build on `build,verify` with a claimed page
  path is refused, then passes with `--render`.
- `tests/title.test.js`: a dispatch carrying `effort: "xhigh"` titles `· xhigh`.
- Full suite green with `FANKEEL_BROWSER` set to Chrome.

## Against the map

`model-choice.md` and `subagents.md` say the Agent tool cannot set effort —
this change makes that false and rewrites both. No other current page found
in conflict.

## Unverified

`task.js` is mid-edit in another session on main; its `stage` command may move
before this rebases.
