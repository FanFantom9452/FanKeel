---
judged: 2026-10-15T09:22:35.342Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點（含 session-4、upgrade-3）"
session: 705fc204-267d-4185-aaa1-dd372a5c09cd
stage: build
---

# Judge brief 1 — agent effort, agent coverage, mandatory render review

## Question

# Judge brief 1 — agent effort, agent coverage, mandatory render review

Repository: F:/ymlab/fankeel (the fankeel Claude Code plugin). Read-only.

The user asked three things, in their own words (translated): "We have many custom agents. Do a deep analysis: can a mod or anything else change an agent's thinking effort? Among all these custom agents, is there a flow that is guaranteed to dispatch each one, so we have nothing designed but never used? And for frontend design, mockups and verification, I see the reviewer but no rendering agent being forced to run. Does the skill mandate it? I want it mandatory."

## Question 1 — can a subagent's effort be set at dispatch?

Facts to start from (check them, do not trust them):
- `docs/90-agent/reference/model-choice.md` (~:43) says the Agent tool cannot set effort, which is why `agents/fankeel-*-high.md` / `-xhigh.md` exist as copies with a changed `effort:` line (`VARIANT_EFFORTS` in `lib/agentfile.js`). Only brain, implementer and reviewer have variants.
- `docs/03-decisions/2026-10-07-mod-reopen.md` and `docs/90-agent/todo/brief-3.md` (subagent brief via `agent.spawn` in a mod) and `docs/90-agent/todo/effort-1.md` (per-subagent effort, blocked on brief-3). `hooks/pane.ts` is the existing mod. `hooks/title.js` reads the effort for the title.
- Any profile key `agent.<name>.effort` (`lib/profile.js`, `parseAgentValue`) — what does it actually change, and where is it applied?

Answer: which mechanisms can change a dispatched agent's effort today (agent file frontmatter, variant files, a profile key that rewrites agent files, a mod's spawn API, an env var), which cannot, and the cheapest one that gives per-dispatch control. Cite path:line. Unknowns stay unknown; say what would settle them.

## Question 2 — is every custom agent reachable from a flow?

The agents: everything under `agents/` (brain ×3, implementer ×3, reviewer ×3, reader, fixer, mover, mutator, verifier, writer, mockup, render-reviewer, judge, init-scout, slimmer). Dispatch sites are in `lib/stages.js` (STAGE_AGENTS ~:715-725, stage rules), `lib/render.js` (`renderBrainBrief`), `skills/*/SKILL.md`, and `scripts/*.js`.

For each agent, give one row: the flow that dispatches it, whether that dispatch is **mandatory** (a rule or script requires it every time that flow runs), **conditional** (a judgement or a profile key), or **never** (nothing names it). Mark which conditions are enforced by code (a script refuses or checks) and which are only words in a skill. Then name the ones designed but effectively unused, with the evidence (for example `git log`, or session transcripts under the config dir's `projects/` if you can find them, and the counts).

## Question 3 — is the render reviewer mandatory, and how to make it so?

Facts to start from: `skills/fankeel-build/SKILL.md`, "A task that changes a page gets a second reviewer… runs it by default, every time", with two exceptions (one request of the tuning loop; the user says skip). `skills/fankeel-verify/SKILL.md:253-258` dispatches it only "when the claim under evidence is about what a page shows". `agents/fankeel-render-reviewer.md`, `.fankeel/render.json`, the render script it uses, and any check in `scripts/gate-check.js`, `lib/handoff.js`, `scripts/review-check.js` or `scripts/ledger.js`.

Answer: is it mandatory today in words, in code, or neither, and at which stages (design mockup, build page task, verify)? The user wants it **mandatory**. Propose the smallest enforcement that a model cannot skip silently: what decides "this change touches a page" (render.json's declared pages, file globs, a plan task flag), where the refusal lives (which script, which function), what the exceptions stay (tuning loop?), and what test locks it. Name the files and the size of the change.

## Shape of the answer

Three sections, one per question. Each opens with a one-sentence verdict, then the evidence as path:line, then (for 1 and 3) a recommended change with the files it touches, and (for 2) the table. Mark each claim EXTRACTED (read in a file) or INFERRED. Under 900 words.

## Answer

## 1. Can a subagent's effort be set at dispatch?

Verdict: today the only per-dispatch route is the shipped `-high`/`-xhigh` files for three roles, but the current Claude Code build's Agent tool schema carries an `effort` parameter, which contradicts model-choice.md:44 and, if honoured, is the cheapest control by far — unmeasured here.

- Frontmatter `effort:` in every `agents/*.md` — works; lib/title.js:153 reads it for the title only. EXTRACTED.
- Variants: lib/agentfile.js:117-127 `renderVariant`, scripts/variants.js:16 BASES = brain, implementer, reviewer; chosen by the plan Dispatch line's third field (lib/plantasks.js:115-121), lint refuses other values (lib/plantasks.js:560-561); class architectural forces `high` (lib/profile.js:275-278). Per-dispatch, but 2 efforts x 3 roles. EXTRACTED.
- Profile `agent.<name>.effort`: lib/profile.js:299-306 validates; lib/agentfile.js:64-82 `syncAgent` writes `.claude/agents/<name>.md` with the `effort:` line replaced; hooks/title.js:28-38 swaps `fankeel:<name>` to bare `<name>` so that file resolves; only in a session started after the write (hooks/title.js:60-71). Per-role, not per-dispatch. Today `.claude/agents/` holds mover, mutator, reader (model only, .fankeel/profile.json:12-14). EXTRACTED.
- Mod spawn API: `.claude-plugin/types/claude-code/index.d.ts:475-478` `effort?: string | number` on agent.spawn, but `hooks/` has no `agent.spawn` or `turn.step` (grep; docs/03-decisions/2026-10-07-mod-reopen.md:13); todo/effort-1.md is `blocked` on brief-3. EXTRACTED.
- Env var: none sets it; `CLAUDE_EFFORT` only exposes the current turn's effort (claude-code/index.d.ts:797). EXTRACTED.
- Agent tool parameter: `.claude-plugin/types/claude-code-tools/index.d.ts:15-16` `effort?: "low"|"medium"|"high"|"xhigh"|"max"` ("Written by Claude Code 2.1.296", installed CLI 2.1.300; file gitignored). hooks/title.js:29 `{ ...input }` passes it through. model-choice.md:44, subagents.md:119 and plans/2026-10-02-docs-writer.md:1046 say the tool cannot — stale against this build. Whether the request honours it is not measured anywhere in docs/. EXTRACTED (schema) / INFERRED (stale).

Recommended: one probe — dispatch `fankeel:fankeel-reader` with `effort: "high"`, read `effort` from a PreToolUse hook input inside the subagent (claude-code/index.d.ts:844) or its `agent-*.meta.json`. If honoured: build/plan skills send `effort:` instead of `-<effort>` names (skills/fankeel-build/SKILL.md:217-218,430; fankeel-plan:207-208), retire scripts/variants.js and the six variant files, trim tests/agents.test.js:10, fix the three doc lines. If not: keep variants; effort-1 stays the route.

## 2. Is every custom agent reachable from a flow?

Verdict: no flow guarantees any agent by code; every dispatch is words in a skill or brief, and five agents plus three variants are effectively unused on this project.

Counts: assistant `tool_use` Agent calls in C:/Users/user/.claude/projects/F--ymlab-fankeel (72 sessions + subagents/, bench temp dirs excluded): reviewer 278, implementer 107, verifier 83, reader 82, reviewer-high 41, fixer 40, implementer-high 23, brain 22, mockup 4, judge 4, brain-xhigh 4, render-reviewer 2, writer 1, mover 1, mutator 0, init-scout 0, slimmer 0, implementer-xhigh 0, reviewer-xhigh 0, brain-high 0. EXTRACTED.

| agent | flow | kind | enforced |
|---|---|---|---|
| brain | any stage in profile `stage.agents` (lib/stages.js:687,700-704); profile.json:6-8 lists survey only | conditional (profile) | code: hooks/guard.js:169-187 refuses an unlisted stage; nothing requires one |
| brain-high/-xhigh | user says yes to "Deep thought?" (stages.js:687) | conditional | words |
| implementer | build, every plan task (build SKILL:217) | mandatory in words | code lints the line only (plantasks.js:560) |
| implementer-high/-xhigh | Dispatch line effort / architectural (profile.js:275-278) | conditional | lint |
| reviewer | plan:353, build:430, verify:239, audit:236 | mandatory in words | none: `ledger.js complete` takes note+range only (scripts/ledger.js:566-584) |
| reviewer-high/-xhigh | with implementer effort (build:430) | conditional | words |
| reader | survey per lens (stages.js:223), audit, init, verify | mandatory in words (survey) | words |
| verifier | verify per row (verify:185) | mandatory in words | words |
| fixer | build:521, verify:121, audit:78 on a finding | conditional | words |
| mover | audit/land brain only (stages.js:723-724, render.js:641) | conditional (`stage.agents`) | words |
| mutator | verify brain only (render.js:633) | conditional | words |
| writer | build/audit brain brief only (stages.js:721,723; brain.md:97); no skill names it | conditional | words |
| mockup | design step 3, `design.mockup` + judgement (stages.js:258, design:81-129); tuning loop | conditional | words |
| render-reviewer | build page task (build:442-454); verify page claim (verify:253) | conditional (judgement) | words |
| judge | /fankeel-ask (ask:70); scripts/judge.js files it | mandatory in words | words |
| init-scout | /fankeel-init (init:39) | mandatory in words | words |
| slimmer | init:209; gate offer (render.js:387) | conditional | words |

Unused: mover, mutator (bench-only: 148/73 dispatches under Temp dirs), writer, init-scout, slimmer, implementer-xhigh, reviewer-xhigh, brain-high. Cause for mover/mutator: they exist only for a controlled audit/land/verify brain and the profile controls survey alone. INFERRED from the above.

## 3. Is the render reviewer mandatory?

Verdict: mandatory in words at build only, conditional at verify, absent at design, and no script, hook or test checks it ran.

- build SKILL:442-454 "runs it by default, every time"; exceptions: tuning-loop request, user's skip ruling; :489-492 non-`ship` is a first round. verify SKILL:253-258 only when a claim is about a page; "leave it off". design SKILL:94 names it only as what `data-block` points at. EXTRACTED.
- Code: scripts/gate-check.js:34-38 checks the gate block only; scripts/review-check.js:16,41 formats findings; scripts/ledger.js:566-584 `complete` needs note and range; lib/handoff.js has no render match; lib/guard.js:296 only makes it read-only (tests/guard.test.js:403-407); tests/skills.test.js:696 asserts the mention. `.fankeel/render.json` does not exist in this repo; its schema is pages{name,url}+roles (lib/shots.js:6-7), urls not source files, so it cannot decide "touches a page" alone. 2 dispatches vs 4 mockups. EXTRACTED.

Smallest enforcement:
1. "touches a page" = `render.json` pages gain optional `"src": [globs]` (lib/shots.js:21-48, ~8 lines) — the list tune.js `--src` already takes. No render.json: no check, matching the skill's "where the project has one".
2. Refusal in `ledger.js complete` and `fix` (scripts/ledger.js:566,715): with `--range`, `git diff --name-only` ∩ src non-empty requires `--render <file>` whose first line is `disposition: ship`, or an earlier ledger `Ruling: render skipped — <why>` line (lib/ledger.js:109 rulingLine). Else `fail`. ~35 lines.
3. Exceptions kept as that ruling line (tuning loop, user's skip): recorded, never silent.
4. Gap: a `bounded` task has no ledger (design SKILL:90-91); scripts/commit.js is its only seat (same glob check on the block's paths, ~15 lines) — second step.
5. Lock: tests/ledger.test.js (refused without `--render`, accepted with ship, accepted with ruling, non-page range untouched) and tests/shots.test.js; skill text at build:442-454, verify:253 names the flag.

pick: Agent tool now exposes `effort` (probe it); no agent is code-mandated and 8 are unused; render review is words-only — enforce in ledger.js complete/fix with render.json src globs.
why: see sections above.
would flip if: a probe shows the Agent tool's `effort` param is ignored by the request (section 1 falls back to variants); a project render.json with src globs cannot name what draws its pages (section 3 needs a plan flag instead).
unread: hooks/pane.ts body beyond imports/PLACES; scripts/commit.js beyond its header; lib/handoff.js beyond grep.
