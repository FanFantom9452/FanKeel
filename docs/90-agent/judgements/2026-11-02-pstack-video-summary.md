---
judged: 2026-11-02T10:02:52.402Z
model: fable
agent: fankeel-judge
task: "深度分析 PStack 影片摘要：哪些是 10-18 判決沒涵蓋的、fankeel 該取什麼"
session: af33d828-463f-40e0-85b0-2567bd01b39b
stage: design
human: yes
---

# Brief: a video's account of pstack — what it adds beyond the 10-18 judgement, and what fankeel should take now

## Question

# Brief: a video's account of pstack — what it adds beyond the 10-18 judgement, and what fankeel should take now

## Question

The user pasted a Chinese video summary of pstack (Lauren Tan / "poteto"'s open
pstack, cursor/plugins) and asked for a deep analysis. fankeel already filed a
source-read comparison on 2026-10-18
(`docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md`, 240 lines, every
pstack file read by readers) and took decisions from it (e.g.
`docs/03-decisions/2026-10-19-no-unattended-gate.md`,
`docs/90-agent/reports/2026-10-19-memory-vs-pstack.md`).

Answer: **does the video surface anything the 10-18 judgement missed or got
wrong, and of everything in it, which one or two things should fankeel act on
next (with the file they land in) — versus what stays rejected or is already
there?** Also say where the video misstates pstack (names, numbers, mechanics),
so the user does not reason from a garbled source.

## The video summary (verbatim, the user's paste, condensed headings)

1. Background: Luren (SpaceX AI, Grokbot) merged 2,500 PRs in a month (~80/day,
   ~20 while asleep). Bottleneck is human verification, not writing code.
2. `Pstack` skill detects models and routes: grunt work (code, tests, search) to
   cheap fast Grok; deep thinking (architecture, copy, judging) to Claude Opus.
   60 skills: 24 principle skills, 30+ tool skills. Potato Mode = site foreman
   with 23 SOP playbooks (bug fix, feature, perf) dispatching skills.
3. Potato Mode three phases:
   - Plan: HOW skill (read modules, global view), WHY skill (git history,
     tickets, Notion, chat — why a guard exists), Sharpen (rewrite prompt from
     expert view, add acceptance criteria).
   - Build: Architect (skeleton first; "the next AI copying one file blindly is
     still correct"), Arena (several models design, merge best), TDD red→green.
   - Review/verify: Create Verification (app-driving SOP, screenshots/video as
     evidence), Blast Radius (risk tiering of review), Interrogate (cross-family
     models review). Overnight: the writer of a PR never merges it; Swarm (~10
     independent cloud verifiers, all pass → auto-merge); "Me Your Work"
     (decision log, next day another model flags risks); Correct (turn a mistake
     into a lint rule / CI gate, not a doc line).
4. Factory: a non-coding orchestrator splits work to workers + verifiers; Gbot
   watches Slack/email 24h, reproduces vague complaints in the cloud, files
   tickets; a patrol AI scans for bad patterns daily, fixes root causes in batch.
5. pstack vs "MAT (Mapple Coconut)": MAT = align requirements up front by Q&A +
   human gate before merge, cheaper, for 0→1; pstack = automated multi-model
   acceptance after building, for big legacy bugfix/refactor/perf, more tokens.
   Use MAT first, hand clear work to pstack.
6. Trust ladder: (1) watch where one AI fails, (2) turn corrections into rules
   or hooks/linters, (3) demand evidence with every delivery, (4) parallel 2-3
   tasks, separate doer from reviewer across models, (5) overnight tasks with
   black-and-white acceptance, PR only, no merge, (6) then auto-merge + intake.

## Options

For the "act next" pick, one of:
- A. A concrete adopt/adapt the 10-18 judgement did not already decide (name the
  fankeel file and the smallest change).
- B. Re-open something 10-18 or a later decision rejected, because the video
  shows a reason it lacked (say which decision file and why it now flips).
- C. Nothing new to act on — the video is a lossy retelling of what 10-18
  already covered; say which existing fankeel TODO/decision each point maps to.
Plus a short map: video point → 10-18 row / fankeel file / misstatement.

## Background

fankeel (`F:/ymlab/fankeel`) is a Claude Code plugin: task registry, staged
route (survey/design/plan/build/verify/audit/land), user gates via
AskUserQuestion that are never auto-answered (decision 10-19), stage agents,
read-only reader fan-out, implementer/reviewer/verifier/mutator/fixer/writer
agents, one-shot judge, ledger, collision guard, station, profile keys. The
local pstack clone at `F:/ymlab/_ext/cursor-plugins` is **gone**; the 10-18
judgement and its delegated list are the source-of-record for pstack facts. If
a reader must check pstack itself, it may WebFetch
https://github.com/cursor/plugins (read only, run nothing).

## Paths to read

- `docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md` — whole, the
  comparison table and summary especially.
- `docs/03-decisions/2026-10-19-no-unattended-gate.md`,
  `docs/90-agent/reports/2026-10-19-memory-vs-pstack.md`,
  `docs/90-agent/reports/2026-10-19-two-candidate-trial.md`,
  `docs/90-agent/reference/sources.md` (pstack rows).
- `docs/90-agent/todo/` — grep pstack / swarm / blast / interrogate / evidence /
  correct / lint / overnight / nightly; plus `docs/90-agent/todo/README.md` or
  index if any; any `docs/judgements` from 45-ci-cd-nightly, 44-anthropic-review
  -practice, 42-uncle-bob briefs under `.fankeel/build/ask/` and their filed
  judgements in `docs/90-agent/judgements/`.
- fankeel itself where a point maps: `skills/fankeel-verify/SKILL.md`,
  `skills/fankeel-build/SKILL.md`, `agents/fankeel-reviewer.md`,
  `agents/fankeel-verifier.md`, `skills/fankeel-ask/SKILL.md`,
  `skills/fankeel-land/SKILL.md`, `hooks/` names.

## What counts as an answer

- Every claim that "fankeel already does X" cites file:line.
- Every "10-18 already covered" cites the row/line in that judgement.
- Misstatements in the video are named against pstack's real names/contents
  (from 10-18's delegated readings or the GitHub repo), not from memory.
- The pick is one change small enough to be the next fankeel task, or C.

## Answer shape

The judge's usual seven fields, `ask human:` last, then `## 白話` (≤600 chars,
繁體中文), then `## Summary` holding the video-point map as a table.

html: yes

## Answer

pick: A — add a `## Blast radius` lens: `lib/lenses.js` counts, for each file the range changes, how many other files require/import it (git grep) and, over a profile threshold, prints the lens with the caller list; `skills/fankeel-verify/SKILL.md:269-271` names it beside Silent failure/Comment so the adversary's brief carries the callers. One lens, one test, two files.
why: pstack's `blast-radius` skill was read on 10-18 but got no comparison row — it appears only in the delegated list (judgement:110), so risk-tiered review was never judged, not rejected. fankeel tiers review only by declared class (`dispatch.floor` "opus at least if architectural", verify:165) and by profile flag (`sensitive.review`, verify:273-275); nothing measures the change's fan-in. Everything else the video names is a 10-18 row (#1,2,3,7,8,9,10,13,14,15,17,19,21,29 at judgement:170-211), a later decision (no-unattended-gate:8,20; two-candidate-trial:53; anthropic-review:66-69), or already in fankeel (evidence per claim verify:14,44; separate reviewer build:421; test-first implementer.md:12-14; parallel implementers build:280; confirmer on a different model verify:320-323). B is not warranted: the video gives no reason 10-19 lacked, and its own "MAT first, pstack after" framing puts fankeel's up-front-alignment-plus-gate shape on the recommended side.
would flip if: `lib/lenses.js` already computes fan-in under another name (I did not open it) → C; or the user has a concrete overnight case now (decision 10-19:29 says reopen then) → B.
unread: https://github.com/cursor/plugins (names were confirmable from the 10-18 record); `lib/lenses.js` body; `agents/fankeel-retro.md` (second candidate below rests on it); `.fankeel/map.md`.
delegated: opus → docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md (whole); sonnet → docs/03-decisions/2026-10-19-no-unattended-gate.md, docs/90-agent/reports/2026-10-19-memory-vs-pstack.md, docs/90-agent/reports/2026-10-19-two-candidate-trial.md; sonnet → docs/90-agent/reference/sources.md, docs/90-agent/todo/ (grep); sonnet → .fankeel/build/ask/{42,44,45}-*-brief.md, docs/90-agent/judgements/2026-10-28-uncle-bob-measure-not-read.md, 2026-10-29-anthropic-review-practice.md, 2026-10-29-ci-cd-nightly.md (grep/head); sonnet → skills/fankeel-verify/SKILL.md, agents/fankeel-verifier.md; sonnet → skills/fankeel-build/SKILL.md, agents/fankeel-reviewer.md; sonnet → skills/fankeel-ask/SKILL.md, skills/fankeel-land/SKILL.md, hooks/*, .claude-plugin/plugin.json; sonnet → grep pstack across docs/ skills/ agents/ hooks/ lib/ scripts/ + git log.
checklist: 1 10-18 names/counts/rows/summary — answered; 2 no-unattended-gate scope — answered; 3 memory-vs-pstack — answered; 4 two-candidate trial — answered; 5 sources.md pstack rows — answered (one row, no author); 6 todo grep — answered (nine pstack TODOs, all done; no blast/swarm hit); 7 briefs 42/44/45 + judgements — answered; 8 verify/verifier evidence, adversary, model rule — answered; 9 build/reviewer TDD, separation, model — answered; 10 ask/land/hooks — answered; 11 later pstack mentions — answered (chartroom 10-19:28 defers to 10-18; no new verdicts).
ask human:
  - q: 現在有沒有一個具體的「過夜／離開時仍要繼續跑」的案子？
    option: 有，而且常發生 → pick 變 B：依 decision 10-19:29 開新條目重議 gate 代答
      pro: 決定檔自己寫了「有具體案例再重議」，影片的第 5–6 階正是這個方向。
      con: 要改 hooks/gate.js 的去重、交回複製檢查與 resume 三條流程，且失去 gate 作為核准點。
    option: 沒有，目前都是本機 commit、人在場 (assumed)
      pro: 10-19 決定維持，blast-radius lens 是純新增、不碰 gate。
      con: 影片最醒目的「睡覺也在 merge」一段對你就只是參考，不會落地。
    reason: 這是使用者的工作習慣，倉庫裡只有 10-18 判決 :232 的推測「記憶顯示本機 commit、不走 PR」，沒有檔案能證明現在還是如此。

## 白話

結論：這支影片講的 pstack，九成在 10-18 那份判決裡已經逐條比過、決定過；唯一真的漏掉的是「爆炸半徑」——改一個被很多檔案引用的檔，審查要跟著看得更廣。建議下一個小任務就做這個：像消防隊到場先看這棟樓連著幾戶，fankeel 在 verify 派對手審查員之前，先用 git 數一下改到的檔被幾個檔案引用，超過門檻就把那些呼叫者列進審查員的簡報。其他像「睡覺自動合併」「多模型擂台」，10-19 已經以成本和閘門理由拒過，影片沒給新理由，不翻案。另外影片把幾個名字講歪了：Potato 其實是 poteto-mode、「Me Your Work」是 show-me-your-work、Gbot 在紀錄裡對不到（最接近的是 benny 和 Cursor 的 Bugbot）；「2,500 PR」「SpaceX AI」「Grok 做粗活」在紀錄裡都查不到，別拿來當依據。

## Summary

### 0. Spot-checks

One span per reader, all matched. Judgement:110 is the only line in the 10-18 file that mentions `blast-radius`, `sharpen` or `tdd` (grep over the whole file returned only :110). Judgement:129 (31 slash + 24 principle + 2 agents, no hooks), :131 (poteto-mode 149 lines, 23 playbooks, routes to architect/swarm/arena/interrogate), :139 (swarm = N cloud workers returning PASS/ISSUES/BLOCKED; arena default opus+grok with a cross-family judge; interrogate one reviewer per model, opus+grok, findings not auto-applied), :141 (`correct` ladder 架構→型別＋lint→測試→文件, rules↔enforcement table), :145 (benny: Slack triage + reproduce-and-fix, draft PR only, never merge), :149 (Claude Code port drops grok/gpt, every review falls back to one model), :182 (show-me-your-work TSV, another family reviews the log) — all as reader 1 reported. Decision 10-19:8,14-16,20,29; trial :46-53; todo/gate-13.md `state: done`, `disposition: abandoned`; anthropic-review :66-70; verify:165, :269-275, :320-323; build:421-422; reviewer.md:5 `model: sonnet`; land:338-348; chartroom-mermaid-station:28; implementer.md:12-14 ("build it, test first") — all verbatim as reported. `lib/lenses.js` exists (Glob).

### 1. Video point → pstack record → 10-18 row → fankeel → verdict

| # | Video says | pstack per 10-18 record | 10-18 row | fankeel today | Misstatement? | Status |
|---|---|---|---|---|---|---|
| 1 | "Luren (SpaceX AI, Grokbot)", 2,500 PRs/month, 80/day | Judgement names no author or employer; "poteto" appears only in `poteto-mode`/`poteto-agent` (:129,:131). No PR count anywhere (:151: "pstack 沒有任何 token 數字") | — | — | Author/affiliation/PR count not in record; cannot confirm or deny. Treat as the video's claim, not pstack's | unverifiable |
| 2a | Pstack routes grunt → cheap Grok, deep thinking → Opus | setup-pstack writes `~/.cursor/rules/pstack-models.mdc` per role (:119); arena and interrogate default opus+grok as *peers* for cross-family diversity (:139); advisor uses grok-4.6 (:157); Claude Code port drops grok entirely (:149) | #29 D (:198), #7 C (:176) | profile.json overrides agent models (#29) | Garbled: the record shows cross-family pairing, not a cheap/expensive tier | already (D) |
| 2b | 60 skills: 24 principle + 30+ tool | 31 slash + 24 principle + 2 agents (:129) | #5 C (:174) | 4 ALWAYS rules + calibration; audit deletes unowned rules | ≈ right (57) | rejected (C) |
| 2c | "Potato Mode", 23 SOP playbooks | `poteto-mode`, 23 playbooks (:131,:133) | #3 B (:172) → todo/build-11 done | design criteria table + implementer bug-fix section; kind-lenses | Name garbled | adopted (B, done) |
| 3a | HOW / WHY / Sharpen | `how`, `why`, `sharpen` (:110,:186-187) | #18 D (how), #17 B (why → history lens, todo/survey-3 done); `sharpen` no row | survey+explain; ask brief has "what counts as an answer" (ask:62-66) but no rewrite step | Names right | how D, why done; sharpen route-equivalent (survey→design→plan is the sharpen) |
| 3b | Architect skeleton-first; Arena merge-best | `architect`, `arena` opus+grok (:139) | #7 C (:176); trial 10-19:53 "不訂成固定步驟" | build has no skeleton-first rule; order is dependency-only (build:253-259) | Right | rejected by default; re-try only per trial :53 |
| 3c | TDD red→green | `tdd` (:110) | no row | implementer.md:12-14 test first; build:241-245 one red-when line per new test; uncle-bob 10-28:65 "already present and stricter" | Right | already |
| 3d | Create Verification, screenshots/video as evidence | `create-verification-skill` (+maintain, +formal) (:143) | #10 A (:179) → todo/verify-3 done | `.fankeel/verify/` feature files + verify-map.js (verify:199-213); render-reviewer shoots pages (verify:277-287); evidence = raw output (verify:72,77-78) | Right | adopted (A, done) |
| 3e | Blast Radius risk-tiering | `blast-radius` read by an opus reader (:110) | **no row** | class-based floor only (verify:165); `sensitive.review` flag (verify:273-275); lenses by range (verify:269-271); 10-29 anthropic-review :69 rejected only *human* sign-off tiers | Right | **gap → pick A** |
| 3f | Interrogate cross-family review | interrogate opus+grok, four buckets (:139) | #8 D, #9 B (:177-178) → todo/reviewer-1 done | adversary four questions + lenses (verify:252-263); confirmer on a different model (verify:320-323); build's reviewer pinned sonnet regardless of implementer (build:421-422, reviewer.md:5) | Right | already; same-model implementer/reviewer at build is a secondary candidate (see §3) |
| 3g | Writer never merges; Swarm ~10 verifiers all pass → auto-merge | babysit "絕不 merge" (:133); shipping = one independent verifier per PR, lead lands bottom-up (:133); swarm = N parallel workers, PASS/ISSUES/BLOCKED (:139); benny draft PR only (:145) | #19 B (:188), #21 C (:190), #1 C (:170) | land: integration is the user's decision (land:343-348), profile `land.integration/land.push` can pre-answer (land:338-341); verifier forbidden `git merge` (verifier.md:32); `ci-status.js` read-only (land:417-420) | Conflates swarm with the shipping playbook; "~10", "auto-merge" not in record | rejected (C) / watch-PR option B unadopted (user does not use PRs, judgement:232) |
| 3h | "Me Your Work" decision log, another model flags risks next day | `show-me-your-work` TSV, another family reviews (:182) | #13 D (:182) | ledger rulings, decisions, judgements | Name garbled | already |
| 3i | Correct: mistake → lint/CI gate, not a doc line | `correct` ladder 架構→型別＋lint→測試→文件, rules↔enforcement table (:141) | #15 A (:184), #14 B (:183) → todo/land-4 done | hooks/ enforce (16 scripts: gate, guard, dispatch-gate…); retro proposes skill/CLAUDE.md diffs (land:270-291) | Right | adopted; the *ordering* (mechanical before prose) in retro is unverified (§3) |
| 4a | Factory: non-coding orchestrator → workers + verifiers | sister plugin `orchestrate` (:156): Planner/Subplanner/Worker/Verifier, cloud agents, no "ask human" rule, no fan-out cap | #23 D, #25 B, #27 D (:192-196) | task.js + ledger.js; dispatch.inflight 8 hook-enforced; await.js synthetic handoff (todo/await-8 done) | Right in shape; it is not pstack proper | already / fankeel better |
| 4b | "Gbot" watches Slack/email 24h, reproduces, files tickets | `benny` Slack automations (:145); "Bugbot" is Cursor's PR bot (:135) | #20 C (:189) | none | "Gbot" matches nothing; email not in record | rejected (C, Cursor-only) |
| 4c | Patrol AI scans daily, fixes root causes in batch | nearest: maintain-verification-skill daily (:143) + `correct` (:141) | #10 A, #15 A | audit's 14-day map reconciliation (judgement:221); todo patrols exist | "patrol AI" not in record | already |
| 5 | pstack vs "MAT (Mapple Coconut)" | not in record; not a pstack concept | — | fankeel *is* the "align up front + human gate" shape (survey/design/plan + gates, decision 10-19:20) | Unverifiable | by the video's own rule fankeel sits on the recommended side; no action |
| 6 | Trust ladder 1-6 | not in record as a ladder; 07-overnight guide (:190) | steps 5-6 = #1/#21 C; step 4 = #7/#8 | steps 1-4 present: evidence per claim (verify:14,44), separate reviewer (build:336,421), parallel 2-8 (build:280), corrections → hooks (#15 done) | video's synthesis | 1-4 already; 5-6 rejected (decision 10-19) |

### 2. Why A, and why this A

The 10-18 judgement is thorough (42 rows, :170-211; A 2 / B 14 / C 13 / D 13, :213) and every later file defers to it (chartroom 10-19:28 "do not redo it"; memory-vs-pstack :9; gate-13; land-4; nine TODOs all `state: done`). The video is a retelling of pstack's README/guide layer with names garbled; it adds no fact about pstack the record lacks except what it cannot support (author, PR counts, Grok-as-grunt). Of the pstack skills the readers opened on 10-18, three got no row: `tdd` (fankeel already stricter), `sharpen` (fankeel's route is the sharpen), and `blast-radius` — the one with no fankeel counterpart beyond a declared class and a profile flag. The 10-29 anthropic-review judgement rejected risk-based *human* sign-off (:69) for a single user; it did not consider a machine-computed fan-in that only widens what the reviewer reads. fankeel's own direction (judgement:217: rules enforced by script, not prose) and its existing lens machinery (verify:269-271) make this a small, deterministic addition: one lens, one test, two files. It also fits the user's two prior picks (uncle-bob B "borrow measurement, not architecture"; anthropic B "only what has own evidence").

### 3. Second candidate, not picked

Same-model implementer and reviewer at build: reviewer.md:5 pins `sonnet`; a `Dispatch: implementer, sonnet` task is then reviewed by the same model, which verify:320-323 already calls "shares its blind spots" for the confirmer. The smallest change would be one sentence at build:421-422 (pass a model other than the Dispatch line's). Not picked because the trial :49 could not observe a same-family effect, 10-18 #7 rejected on cost, and the 10-29 pick B (incident-replay eval from the 11 verify returns) is the right place to measure first whether same-model review missed those. Also unverified: whether `agents/fankeel-retro.md` prefers a hook/test over a prose edit (pstack `correct` ladder, judgement:141); if it does not, that is a one-line addition — a reader should open it before a TODO is written.

### 4. What stays rejected or already there

Rejected and unchanged: auto-answered gates / overnight (#1, #21; decision 10-19:8,20 — reopen only on a concrete case, :29); multi-candidate design as a fixed step (#7; trial :53); Bugbot/Slack intake (#20); 24-principle catalogue (#5); transcript-to-memory auto-write (#31, memory-vs-pstack :32). Already there: evidence per claim, render evidence, mutation rows (verify:62-72), separate adversary + different-model confirmer, test-first, parallel fan-out with a hook-enforced cap, user-decided integration with PR option, decision records, history lens, kind-lenses, rules↔enforcement table.

### 5. Misstatements to correct before reasoning from the video

"Potato Mode" → `poteto-mode`; "Me Your Work" → `show-me-your-work`; "Gbot" → not in record (benny / Cursor's Bugbot); "60 skills" → 31 + 24 + 2 agents; "grunt → Grok, deep → Opus" → record shows opus+grok as cross-family peers, and the Claude Code port has no grok at all; "Swarm ~10 verifiers → auto-merge" → swarm is parallel workers; the shipping playbook has one verifier per PR and babysit/benny never merge; "SpaceX AI", "2,500 PRs", "MAT (Mapple Coconut)", "patrol AI", email intake → not in the record, unverifiable here.

```chartroom
{"type":"board","title":"影片六點 → 10-18 判決 → fankeel 現況"}
{"type":"row","cells":["影片","pstack 真名","10-18","fankeel","狀態"]}
{"type":"row","cells":["Potato Mode 23 SOP","poteto-mode / 23 playbooks","#3 B","kind-lenses (build-11 done)","已採"]}
{"type":"row","cells":["Create Verification","create-verification-skill","#10 A","verify feature map (verify-3 done)","已採"]}
{"type":"row","cells":["Blast Radius","blast-radius","無列","class floor + sensitive.review","缺口 → 選 A"]}
{"type":"row","cells":["Arena / Interrogate","arena, interrogate (opus+grok)","#7 C / #8 D","adversary + 異模型 confirmer","已有 / 拒"]}
{"type":"row","cells":["Swarm 自動 merge","swarm; babysit 絕不 merge","#1 #21 C","gate 必問 (決定 10-19)","拒"]}
{"type":"row","cells":["Correct → lint 不寫文件","correct 階梯","#15 A","hooks + 規則↔強制表 (land-4 done)","已採"]}
{"type":"row","cells":["Me Your Work","show-me-your-work","#13 D","ledger ruling / judgements","已有"]}
{"type":"row","cells":["Gbot / Factory","benny / orchestrate","#20 C / #23 D","—","拒 / 已有"]}
```

## 人類的回答

answered: 2026-11-02T10:03:33.661Z

| 題目 | 判官假設 | 回答 | 分支 |
|---|---|---|---|
| 現在有沒有一個具體的「過夜／離開時仍要繼續跑」的案子？ | 沒有，目前都是本機 commit、人在場 | 有，而且常發生 | pick 變 B：依 decision 10-19:29 開新條目重議 gate 代答 |
decision: 照 有，而且常發生 → pick 變 B：依 decision 10-19:29 開新條目重議 gate 代答

