---
judged: 2026-10-22T03:09:16.238Z
model: fable
agent: fankeel-judge
task: "分析 plan/build stage agent 意外暫停的原因"
session: e9bbb2be-7475-4c47-a1be-bfe3457dec2b
stage: survey
---

# Brief: why do plan- and build-stage agents sometimes stop unexpectedly?

## Question

# Brief: why do plan- and build-stage agents sometimes stop unexpectedly?

## Question

In recent fankeel sessions on this machine, the plan stage and the build stage
sometimes "pause unexpectedly": the stage's work stops before it is finished and
before its gate is asked, and the user has to nudge the session ("繼續") to get
it going again. What causes this, and which cause accounts for most occurrences?

The user asked (verbatim): 「幫我深度分析看看最近的SESSION plan stage 還有 build
stage agent 有時候會意外暫停 這是甚麼原因?」

## Options (candidate causes — not exhaustive, add any the evidence shows)

A. **Stage agent (`fankeel:fankeel-brain`) ends its turn early** — returns a
   relay/handoff or plain text mid-loop (e.g. after a long fan-out, a reviewer
   return, or hitting its own turn/context limit) without writing the gate, and
   the controller then has nothing to do but wait.
B. **Controller ends its turn waiting on `scripts/await.js`** running in the
   background, and the wake-up never arrives (await exits on a condition that is
   not a gate, times out, or the background-task notification is lost / 0-byte
   output), so the main session idles.
C. **Compaction** — `compact.at` (350000) or `gate.away` (ask) triggers a
   compact / "stop before leaving" path that ends the turn mid-stage.
D. **Hook interference** — `hooks/guard.js` (guard: deny) or another hook
   blocks a write/command, and the agent stops instead of routing around it;
   or a Stop/SubagentStop hook ends the turn.
E. **Rule text that tells the model to stop** — stage rules / skills (plan is
   NOT in stage.agents; build IS) containing lines like "end your turn", "never
   poll", "wait" that the model applies at the wrong moment.
F. **Harness/API side** — subagent errors, rate limits, API overload, user
   interruptions, or desktop-app background-agent behaviour.
G. Something else the transcripts show.

Note the asymmetry: profile `stage.agents` = `survey,build,verify`, so **build
runs through a stage agent** and **plan runs in the main session**. A cause that
explains both must not depend on the stage agent alone — or the answer should
say the two have different causes.

## Background / where to look

- Plugin root (working tree, current): `F:/ymlab/fankeel`
- Stage skills: `skills/fankeel-plan/SKILL.md`, `skills/fankeel-build/SKILL.md`
- Stage agent: `agents/fankeel-brain.md`
- Controller rules printed per stage: `scripts/task.js` (search "You are the
  controller", "end your turn", "await.js"), and whatever file emits ALWAYS /
  stage rules (`hooks/` directory — check `hooks/hooks.json` and each hook).
- `scripts/await.js` — what it waits for, its exit conditions and timeouts.
- Compaction / away logic: grep `compact.at`, `gate.away` across `scripts/`
  and `hooks/`.
- Session registry: `.fankeel/sessions/*.json`; per-task build dirs
  `.fankeel/build/task-*/` (look for `relay-*.md`, `build.md` ledgers, handoff
  files that end without a `json gate` block).
- Transcripts: `C:/Users/user/.claude/projects/F--ymlab-fankeel/*.jsonl`
  (main sessions) and `<session>/subagents/agent-*.jsonl` (stage agents and
  readers). `node scripts/conversation.js --help` reads them. The most recent
  sessions (10-20 to 10-22) are the ones the user means; pick the ones that sat
  at plan or build. Look for: the last assistant message before a user
  "繼續"/"continue"-style nudge; stop_reason values; tool errors or hook
  denials right before a stop; background task notifications that never
  arrived; compaction boundaries.
- Earlier related judgements may exist in `.fankeel/build/ask/`
  (e.g. `1-compact-before-build-*`, `1-plan-stage-duration-brief.md`,
  `2-stage-context-carry-brief.md`) and in the judgements bucket declared by
  `.fankeel/docs.json`. Read them rather than re-deriving.
- `git log --oneline -60` for recent fixes touching await/relay/compact/gate.

## What counts as an answer

- A ranked cause list, each backed by at least one concrete occurrence:
  session id (first 8 chars), stage, and the transcript line or file that shows
  the stop and what immediately preceded it.
- Separate verdicts for plan and build if the causes differ.
- For the top cause: the mechanism (which rule/script/hook/harness behaviour,
  path:line) and one concrete change that would stop it, small enough to be a
  single build task.
- Say plainly what could not be determined from the evidence.

## Answer shape

The six fixed fields of the judge, then `## Summary`. `pick:` names the top
cause (by letter or a new one), with plan/build split if needed.

## Answer

pick: G — the main session (controller) ends its turn on a status line with nothing in flight and no waker; build and plan differ only in what the stop follows (build: a stale notification or a cross-session wait; plan: nothing — no plan-stage stall found, only plan-writer relays at the 300k soft budget). The brain itself never paused: 0 of 76 runs.
why: 198a8e58 J:875 (build) end_turn "等 station 遠端 session 收工" with no await/agent pending; user nudged J:879, J:909 admits "剛才沒有代理在跑". 84774b47 B:102 (design, main session) end_turn after the judge returned, "下一步…寫 design", nothing dispatched; nudge B:110. 47bc7b65 A:2821 same shape. Rules only schedule a wake-up for three cases (lib/stages.js:685: after dispatch, SendMessage, no-path notification); .claude-plugin/plugin.json:11-214 registers no main-thread Stop hook, only SubagentStop (hooks/agent-end.js:42). Every brain in 10 sessions handed back via SubagentHandback (reader 8); compaction, guard denials, rate limit each explain at most one case.
would flip if: a plan- or build-stage transcript showed a brain ending with no handback / stop_reason max_tokens, or a background await.js notification that never arrived while the handoff existed — then B/A would lead.
unread: docs/90-agent/judgements/*.md bodies; transcripts 3e679f73, 97a16e9b, 2189ddd8, 13857501, 3751ce2a, 33ca21cf (0-2 short user turns, no nudge pattern); hooks/compact.ts beyond the lines readers quoted.
delegated: 198a8e58-….jsonl (opus); 349c5d13-….jsonl + 84774b47-….jsonl (opus); 47bc7b65-….jsonl + 9f451488-….jsonl (opus); <session>/subagents/agent-*.jsonl for 10 sessions + .fankeel/build/task-2026102*/relay/handoff/failed files (opus); scripts/task.js + scripts/await.js + lib/stages.js + lib/handoff.js (sonnet); hooks/hooks.json + .claude-plugin/plugin.json + hooks/*.js + hooks/compact.ts + lib/context.js (sonnet); skills/fankeel-plan/SKILL.md + skills/fankeel-build/SKILL.md + agents/fankeel-brain.md + .fankeel/profile.json (sonnet); .fankeel/build/ask/* prior briefs + docs/90-agent/reports + docs/90-agent/todo + git log (sonnet).
checklist: 1 198a8e58 nudges — answered (one real build stall, two post-close questions). 2 349c5d13/84774b47 — answered (build: background drive.js blocked on a gate; design: end_turn after judge; land: suite wait; land: weekly rate limit). 3 47bc7b65/9f451488 — answered (design-stage only; one end_turn-without-next-step, one tune.js wait not restarted; 9f451488 none). 4 task.js/await.js — answered (rules at lib/stages.js:685; await exits commit/handoff/lost/timeout, idle 180 s, timeout 1800 s). 5 hooks/compaction — answered (no main Stop hook; compact.ts silent at turn end; gate.away=ask HOLD ends a turn only after 要離開). 6 skills/brain/profile — answered (plan skill has no stop sentence; brain returns per commit/group by design, `waiting` ends its turn). 7 prior judgements/git log — answered (budget-1.md:12, brain-wakeup.md:33, await-* TODOs; no stall fix in the last 80 commits). 8 brain endings/relays — answered (76/76 handed back; 40 await stubs, several `lost` false alarms; relays are plan writers/mockup at 300k).

## Summary

**What the readers found, per path**

*Transcripts (readers 1–3, opus).* The nudge scan over the 10-15..10-22 sessions found seven typed "are you still running?" messages. Classified:

- `C:/Users/user/.claude/projects/F--ymlab-fankeel/198a8e58-f383-465a-8b51-3d93fb0706f6.jsonl:875` (build, 10-21 08:12Z): assistant `end_turn`, text only, replying to a stale task-notification at `:863` ("survey stage agent is waiting on its own background work") and saying it will do the build 收尾 "when the station remote session lands". No await.js, no Agent, no background Bash was pending (reader 1; three earlier awaits had finished at `:828/:843/:846`). User nudged at `:879` 2.5 min later; `:909` says 「剛才沒有代理在跑，我在等 station 遠端 session」 and only then dispatches the build brain (`:894`). The decision to wait on the other session traces back to `:742` and `:790` ("照你之前的決定，等它 land 後再做"), after the guard denial at `:774` ("build is a controlled stage — … its stage agent does the writing here"). Nothing was set to wake the session when the other session finished (it did at `:891`, 18 s before the nudge).
- `349c5d13-627f-44a9-8a0c-7e723fa347b4.jsonl:1488` (build, actually dated 2026-10-15T00:20Z by timestamp, not 10-20): `end_turn` replying to a stale implementer notification (`:1485`) while a background `drive.js` (`:1471`, task bam5ulbhg) ran. The nudge came 27 min later (`:1492`); `:1526` found drive.js alive with no claude child, and `:1513` shows the driven session's `build-pending.json` holding a "build 完成" gate nobody had answered. A background wait on a process that was itself waiting on a human — no notification could arrive. This build stage never dispatched a brain at all (all Agent calls `:566–1348` were implementers/reviewers/fixers).
- `84774b47-f96d-4790-ba7c-a868647e8a05.jsonl:102` (design, main session): `end_turn` text "judged: … 下一步依這個選擇寫 design，到這一站結束的 gate 再請你決定。" right after the judge's foreground result (`:83`). No tool call followed; nudge `:110` 1.5 min later; the session then went straight to the design gate (`:134`). `:1232→1236` is a legitimate background-suite wait (land); `:1538` is `stop_sequence` with `isApiErrorMessage` "You've hit your weekly limit" (land) — cause F, one case.
- `47bc7b65-af5d-4f30-9dc7-02592156bd57.jsonl:2821` (design): `end_turn` "專案頁已經在你的預設瀏覽器打開了…" with no next step after the mockup agent's notification (`:2771/:2782`); nudge "繼續" at `:2825`. `:3175→3179` is a design-only mechanism (`tune.js wait` returns after one request and was not restarted). `:2749→2753` was a legitimate background-agent wait. `:1220/:1240` were the user's own pause/resume. 9f451488 has no stall nudge.
- Plan: 349c5d13 (plan `:271`), 894981bb (plan `:139`), 739fa960 (plan `:649`) and 66a6563a show no nudge inside the plan stage. In 66a6563a the GP plan writer hit the 300k soft budget twice (`:408` relay-ad54c0d9 at 03:33Z, `:434` relay-a02fd8d7 at 03:55Z, 23 and 21 min after dispatch); the controller re-dispatched within 10 s (`:415`, 03:34:02Z). So the plan "agent" visibly stops and a new one starts — the likely source of the user's "plan stage agent 意外暫停" — but the session itself did not stall. Reader 8 confirmed every relay file under `.fankeel/build/task-20261021T024539/` and `task-20261021T084932/` was written by a general-purpose plan writer or a mockup agent at "300k soft budget", never by a brain.

*Stage-agent endings (reader 8, opus).* 76 brain runs across 10 sessions; every one returned a report path through `SubagentHandback` with `success:true`; no `stop_reason` other than `tool_use`/`end_turn`; no brain `Write` to a relay. One exception outside the question: 894981bb `agent-a5f8c6f51` (verify) ended on a Bash tool_use with no handback. Group brains return with no gate by design (`F:/ymlab/fankeel/skills/fankeel-build/SKILL.md:47`, spot-checked verbatim). Option A is therefore not supported for build in this window.

*await.js and its stubs.* `F:/ymlab/fankeel/scripts/await.js:57` idle 180 s / timeout 1800 s; exits on commit, handoff (mtime only, gate not checked), `lost` (transcript idle), `timeout`; `:183–184` print "dispatch a fresh one" / "run await again" (spot-checked). 40 `*-failed.md` stubs were written 10-20..10-22 (listed in my check); the 99-byte ones are `mode: timeout` (e.g. `.fankeel/build/task-20261021T084932/build-g9-failed.md`, agent a4417a69, 20:30Z), the 128-byte ones `mode: lost` (e.g. `task-20261021T060926/build-g3-failed.md` naming a265e778, which had already handed back g1 — a stale in-flight mark, cf. `docs/90-agent/todo/await-5.md:16`, `await-1.md:18`). In 47bc7b65 the ten g5–g14 timeouts fired at 5-min spacing while the build was already past those groups (awaits started `:3830/:3861/:3864/:3905`). These stubs did not stall anything, but each one wakes the controller with a notification that it answers with a 「舊通知，沒有新內容」 `end_turn` (198a8e58 `:840`, `:875`; 349c5d13 `:1488`) — exactly the turn shape in which cause G bites.

*Rules and hooks (readers 4–6, sonnet).* `F:/ymlab/fankeel/lib/stages.js:685` AWAIT_RULE (spot-checked): "After the dispatch, each SendMessage, and a no-path finish notification, run `node {{AWAIT}} --session {{SESSION}}` with Bash `run_in_background`, end your turn; never poll." `:665` in-flight rule "SendMessage it the user's new line; wait." `:652` COMMIT_RULE ends "No gate; wait." That is the whole inventory of "end your turn" instructions, and all three presuppose a brain or an await in flight. `.claude-plugin/plugin.json:11-214` registers SessionStart, UserPromptSubmit, PostToolUse, SubagentStart, SubagentStop, PreToolUse, SessionEnd — no Stop, PreCompact or Notification hook; the only `decision:'block'` on a stop is `hooks/agent-end.js:42` for subagents over RETURN_CAP. `hooks/compact.ts:171-179` compacts silently at `turn.complete` once tokens ≥ compact.at; it tells the model nothing (C ruled out; no compaction boundary sat within 60 lines of any nudge). `hooks/gate.js:161-163` HOLD (spot-checked) ends a turn deliberately only after the user picked 要離開 — not seen in these windows. Guard denials (`hooks/guard.js:114-124, 150-160, 183-209`) all name an alternative route; the collision text "Wait for that task, or ask that session to move off the file" is the one that, in 198a8e58, seeded a wait the rules never close. Plan skill: no stop/wait/end-turn sentence; gate is `AskUserQuestion` in the same turn (`skills/fankeel-plan/SKILL.md:399-403`). Build skill `:45-47`, `:572-588` say the stage does not stop. Brain `agents/fankeel-brain.md:231-239` (spot-checked) ends its turn with `waiting` while children run — that is what produced the "is waiting on its own background work" notification at 198a8e58 `:863`. Profile: `stage.agents` survey,build,verify; `compact.at` 350000; `gate.away` ask.

*Prior judgements/TODOs (reader 7).* `docs/90-agent/todo/budget-1.md:12` (spot-checked): a plan stage brain hit HARD at ~320k, wrote a relay, and "lib/stages.js 的控制器規則只說…等待，等不到任何東西" — the same shape as G, from 2026-10-02 when plan was a brain. `docs/90-agent/reports/2026-09-23-brain-wakeup.md:33` (spot-checked): hand-backs can drop, which is why await.js runs in the background; `:37` says whether a finishing background Bash wakes the controller was never measured — in these transcripts the notifications did arrive (198a8e58 `:828/:843/:846`, 47bc7b65 `:3866/:3870`). No commit in the last 80 touches the stall; 603a7f5e only changed await's gate printing.

**Spot-checks.** Every cited span said what its reader said. Two refinements: 349c5d13's build stall is dated 10-15 by timestamp (its file mtime is 10-20); and 198a8e58 `:863` shows the brain's `waiting` turn surfacing to the controller as a "stopped with background work" notification, which the controller treated as a report to answer.

**Ranked causes**

1. **G (top, build and main-session stages alike)** — the controller answers an asynchronous event (stale notification, judge/agent return, a cross-session lock) with a status line and `end_turn`, while stage work is still open and nothing is in flight to wake it. Occurrences: 198a8e58 `:875` (build), 84774b47 `:102` (design), 47bc7b65 `:2821` (design). Mechanism: `lib/stages.js:685/:665/:652` schedule a wake-up for exactly three situations; outside them nothing (no main-thread Stop hook in `.claude-plugin/plugin.json`) stops the model from ending its turn on "I will continue when X".
2. **B-variant** — a background wait whose completion cannot come: 349c5d13 `:1471-1526`, drive.js blocked on an unanswered gate in the driven session (27 min). Related noise: 40 await `timeout`/`lost` stubs in three days, several `lost` ones false (stale marks), each waking the controller into a 「舊通知」 turn — the breeding ground for cause 1.
3. **Plan-specific: budget relays, not stalls** — `hooks/budget.js:103` soft budget (300k) stops the GP plan writer; 66a6563a `:408`, `:434` (two relays, ~22 min each), re-dispatched within 10 s. Costs time and looks like a paused agent on the station, but needs no nudge. Fix lives in plan-writer briefing (already noted in `.fankeel/build/ask/2-stage-context-carry-brief.md:15`).
4. **F** — weekly rate limit, 84774b47 `:1538` (land), one case.
5. **Not supported in this window**: A (0/76 brains ended early), C (no compaction near a stop), D (denials routed around; the 198a8e58 collision text only contributed to G), E (no such rule sentence in plan or build skill).

**One change for the top cause (single build task).** Add a main-thread `Stop` hook (`hooks/stop.js`, registered in `.claude-plugin/plugin.json` next to `SubagentStop`, modelled on `hooks/agent-end.js:25-42` with its `stop_hook_active` once-guard): when the session's task has an open stage with open work, no gate is pending in the handoff/`*-pending.json`, and no await mark or live in-flight agent exists for this session (`lib/handoff.js` marks, sessions registry), return `{decision:'block', reason:'fankeel: <stage> is open and nothing is running — dispatch the next step, run await.js, or ask the gate; do not end the turn on a status line'}`. One hook file, one registration, one test; it covers plan (main session) and build (controller) identically and does not spend the 2400-char rule budget (`lib/stages.js:683-684`).

**Could not be determined.** Pauses the user noticed on the station page without typing a nudge are invisible to this scan; six recent sessions with 0-2 short user turns were not opened. Whether a `要離開` HOLD (gate.js:161) ever fired in the window was not grepped. The `lost` false alarms' root cause (stale in-flight marks) remains the open TODO it already was. Fact recorded: `.fankeel/build/task-20261022T025126/context.md` (1/40).
