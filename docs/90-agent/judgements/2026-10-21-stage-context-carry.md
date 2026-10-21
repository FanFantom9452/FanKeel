---
judged: 2026-10-21T05:10:47.015Z
model: fable
agent: fankeel-judge
task: "分析 PLAN 站為何寫很久，評估 brain 派多個 agent 平行寫 plan"
session: 4907a1ed-c140-4a6b-a2d9-debc550d17d0
stage: survey
---

# Brief — should every stage run as a brain with a curated context carried from the stages before it, so agents stop re…

## Question

# Brief — should every stage run as a brain with a curated context carried from the stages before it, so agents stop re-reading?

## The question

The user asks (verbatim, Traditional Chinese):

「應該要接上去會不會比較好？ 不然我們survey 掃描完沒有帶過去 每個agent要重新查詢 不就失去意義了嗎 應該是大部分內容先讀 然後讓Agent 減少自己去讀取 思考一下我們工作流分stage的意義」

and, interrupting before dispatch:

「每個stage都思考看看 這樣主sessions 是haiku sonnet opus 就可以完全沒有差異 因為都是brain agent 還有特定的context 比較好控制內容」

In English: the point of splitting work into stages is that survey reads once and later stages build on it. If what survey (and design) learned is not carried forward, every downstream agent re-reads the repo and the stage split loses its meaning. The user wants, for **every stage**, a design where most content is read up front and handed down, so dispatched agents read as little as possible themselves — and where every stage runs as a `fankeel-brain` with its own controlled context, so the main session's model (haiku / sonnet / opus) makes no difference: the main session only relays paths and asks gates.

## Context from the previous judgement in this task

`docs/90-agent/judgements/2026-10-21-plan-stage-duration.md` (filed this task) found: plan time over 40 min came from delegated plan writers each reading design + 397-line skill + code from zero (64–107 tool calls each, 10–41 min per writer), hitting the 300k budget and relaying; parallel part-writers did not beat the main session's 33–35 min and cost 5–7× cacheRead. Those writers were ad-hoc general-purpose agents with no shared prefix and no `context.md`. The one plan stage-agent run (8846548c, brain opus xhigh) took 55 min + 29 min relay.

## What already exists (verify, do not assume)

- `context.md` per task: `lib/handoff.js:107-112` (path), `scripts/context.js add "<fact>" --at <path:line> --session <id>`. Survey SKILL says `context.md` "is what every later brief carries" (`skills/fankeel-survey/SKILL.md:319-320`); design adds to it (`skills/fankeel-design/SKILL.md:256`); every agent file tells its agent to add facts (`agents/fankeel-reader.md:70-72`, implementer, writer, mutator, mover, brain `:61-65`). `lib/render.js:706-713` renders a context.md block into briefs; `lib/render.js:177-181` a `facts:` line.
- Build's shared prefix: `ledger.js --plan <f> brief --group <N> --prefix` = context.md + group Files/Interfaces with path:line + "rules you cannot infer"; every implementer prompt opens with it (`agents/fankeel-brain.md:115-122`, `agents/fankeel-implementer.md:12-25`). Relay re-dispatch uses the same prefix + relay path.
- Stage agents: profile `stage.agents survey,build,verify` (design, plan, audit, land run in the main session). Controller rules in `lib/stages.js` (`controlRules`); brain pinned sonnet, controller passes `model: opus` for design/plan (`docs/90-agent/reference/subagents.md:803-813`, decision `docs/03-decisions/2026-09-22-brain-on-sonnet.md`). Survey's handoff `.fankeel/build/task-<started>/survey.md`.
- Budget/relay: `hooks/budget.js` SOFT/HARD (`docs/90-agent/reference/subagents.md:791-801`).
- Main-session-model independence: check whether the controller rules already make the main session a pure relay for stages in `stage.agents` (guard refused this controller's own writes in survey today), and what still depends on the main model on stages not in `stage.agents`.

## What to find out

1. Per stage (survey, design, plan, build, verify, audit, land): what it reads, what it hands forward (file, context.md facts, handoff), what the next stage actually consumes, and where downstream agents re-read things an upstream stage already read. Use real recent tasks: count how many `context.md` facts exist per task, and whether later briefs/prompts actually carried them (grep subagent transcripts under `C:/Users/user/.claude/projects/F--ymlab-fankeel/<session>/subagents/` for the context.md block or `facts:` line). Measure re-reading: same file Read by survey and again by design/plan/build agents in one task.
2. Is `context.md` too thin to replace reading (facts are one-liners with path:line) — what would a "carried read pack" need (excerpts? a map of files with line ranges? interface signatures?) and how big can it get before it costs more than re-reading (every dispatched agent pays it as prompt; cache only shares identical prefix)?
3. Every stage as a brain: what blocks design, plan, audit, land from being in `stage.agents` today (gate/AskUserQuestion, mockup, user dialogue in design, land's integration decision, commits)? What did the measured stage-agent runs cost vs main-session runs?
4. Does it make the main model irrelevant? List what the main session still does when every stage is a brain (relay, gate copy, await, compaction), and whether haiku can do it reliably (gate verbatim copy is checked by `hooks/gate.js`).
5. Risks: brain context growth/relay on long stages, loss of user dialogue in design, cost.

## Options to weigh

A. Yes, all stages as brains, plus a per-stage "carried pack" built by the previous stage (extend context.md / ledger prefix to design and plan); main session becomes model-agnostic relay.
B. Carry-forward yes, but only some stages as brains (e.g. plan and verify/audit; design keeps the main session for dialogue; land stays main for integration decisions).
C. The carry-forward mechanism already exists and is just not used/enforced — fix enforcement (briefs must embed context.md; writers forbidden to re-read listed files) before moving more stages.
D. Mix — say which first, with numbers.

## What counts as an answer

A pick, a per-stage table (stage · reads · hands forward · re-read observed · should it be a brain · what pack it should receive), the concrete first change to make (files/functions), and a trial that would show it worked (metric: downstream tool calls / Read count per agent, stage wall clock, cacheRead) with adopt/drop thresholds.

## Answer shape

The judge's six fields with `pick:` first, then `## Summary` in 繁體中文.

## Answer

pick: D — 先做 C（brief 內嵌 context.md 事實內容而非路徑、plan 加共用 prefix、各站補 `context.js add` 與「已列檔不重讀」規則），`stage.agents` 先不動；再用一次 trial 逐站決定 plan → audit/land → design 要不要改 brain。
why: 承接機制存在但空轉：最近 6 個 task 的 context.md 只有 2 與 8 條，其餘 4 個沒有；16 個 session 的 1,034 個派工 prompt 只有 69 個（6.7%）帶事實，全是 implementer 的 ledger prefix，reader/reviewer/brain/judge 為零。
一般 brief 只放 context.md 的路徑不放內容（lib/render.js:820-822 註解 "by path only"）；plan/build/verify/audit/land 的 SKILL.md 無 context.md 一字；reviewer/verifier/judge 的 agent 檔無 add 指令。
實測重讀不是慢的主因：8846548c（survey/design/plan 皆 brain）design 73 次讀取中 23 次、plan 146 次中 29 次碰到 survey 讀過的檔；plan brain 各只 Read 8–9 次，卻花 55+29 分 vs 主 session 33–35 分——時間在生成 3051 行 plan。
程式碼已允許任何站進 stage.agents（lib/profile.js:196-207）；現值 survey,build,verify 是「無理由的經驗值」（lib/profile.js:558）；guard.js:150-181 加 gate.js 逐字比對已讓受控站的主 session 成為純 relay，所以「主模型無差異」只在受控站成立，design/plan/audit/land 今天仍靠主模型。
design 有 4 個對話點（D:54-56、:210、:134-155、:258），在 brain 裡每個都是 handoff→gate→SendMessage 一次往返；design/audit/land brain 從未量過時間。
would flip if: trial 中 plan brain 拿到 prefix 後淨時間 ≤ 40 分（≤ 1.2× 主 session）且零 relay → 直接把 plan 加進 stage.agents（往 A 走）；
或 8846548c 的 design brain（主 jsonl :384 起）量出 gate 往返 ≤ 6 次且不慢於主 session design → design 也進。
unread: 無——brief 點名的每個路徑都派了 reader；reader 自述未讀片段：survey SKILL:1-295、design:1-51/81-130、build:70-139/335-660、verify:79-150、audit:48-195、land:164-224、agents/fankeel-brain.md:130 之後、hooks/budget.js:78 之前；8846548c 的 design/verify/audit/land brain 時間與 cacheRead 未量。
delegated: sonnet — lib/handoff.js, scripts/context.js, lib/render.js, scripts/ledger.js | sonnet — skills/fankeel-survey/SKILL.md, skills/fankeel-design/SKILL.md, skills/fankeel-plan/SKILL.md | sonnet — skills/fankeel-build/SKILL.md, fankeel-verify, fankeel-audit, fankeel-land SKILL.md | sonnet — lib/stages.js, lib/profile.js, .fankeel/profile.json, hooks/guard.js, hooks/gate.js, hooks/budget.js, lib/context.js, agents/fankeel-brain.md, docs/90-agent/reference/subagents.md, docs/03-decisions/2026-09-22-brain-on-sonnet.md | sonnet — agents/fankeel-{reader,implementer,writer,mutator,mover,reviewer,verifier,judge,brain}.md | sonnet — docs/90-agent/judgements/2026-10-21-plan-stage-duration.md, .fankeel/build/task-*/ (6 dirs), .fankeel/map.md (headings only) | opus — C:/Users/user/.claude/projects/F--ymlab-fankeel/<16 sessions>/subagents/*.jsonl 首則 prompt | opus — C:/Users/user/.claude/projects/F--ymlab-fankeel/8846548c-…jsonl 與其 94 個 subagents/*.jsonl 的 Read/Bash 讀取
checklist: 1 承接機制程式碼 — answered | 2 survey/design/plan SKILL — answered | 3 build/verify/audit/land SKILL — answered | 4 stage.agents 控制、guard、gate、budget — answered | 5 agent 檔 add-facts 與不重讀規則 — answered | 6 前次判決數字與 task 目錄事實數 — answered | 7 派工 prompt 是否帶 context.md — answered | 8 跨站重讀量測 — answered（Read 精確、Bash 計數偏高）

## Summary

### 一、各 reader 的發現（含 path:line）

**1. 承接機制在程式碼裡長什麼樣（sonnet）**
- context.md 一個 task 一份，放在 handoff 旁：`F:/ymlab/fankeel/lib/handoff.js:110-113`；只有 `scripts/context.js` 會寫。格式 `- <fact> — <path:line> @ <short sha>`（`scripts/context.js:6`），完全重複會丟、同 fact+at 新 sha 會覆蓋（:44-45），上限 `CAP = 40` 條、舊的先掉（:24, :46-47）。
- 事實以「內容」被嵌進 prompt 的地方只有一處：build 的 `ledger.js --plan <f> brief --group <N> --prefix`，由 `scripts/ledger.js:473-509` 的 `prefix()` 組出 `## Task context`（原文 context.md，:503-504）＋`## Group N — Files and Interfaces`（:496-506）＋`## Rules you cannot infer`（:507，內文 :154-163）；輸出刻意不含時間戳或 id 以便 cache 共用（:469-472）。沒有任何大小上限（只受 40 條事實限制）。
- 一般 subagent brief（reader/judge/reviewer/implementer/verifier/writer/mockup 共用的 `renderBrief`）在 `lib/render.js:822` 呼叫 `pushContext`；brain brief 在 :594。`facts: <path> (<n>)` 行（:182-187）是給主 session 的 stage rules，不是 subagent brief。brief 上限 `BRIEF_MAX = 9500` 字元（:736），`fit` 先丟最舊事實（:752-760）。
- design、plan、verify、audit、land 都沒有等價的共用 prefix（grep `prefix` 無相關命中）。

**2. survey / design / plan 的 SKILL（sonnet）**
- survey 交出：report（path:line findings、planned/not built、class、route，S:408-421）寫到 `task-<started>/survey.md`，以及 context.md（S:317-321 原句：「`context.md` is what every later brief carries; a fact left out of it is read again by design, by plan and by every implementer」）。沒有「不重讀」規則。
- design 讀 `.fankeel/map.md`（D:195-205）和使用者；SKILL 裡 grep 不到要讀 survey.md 或 context.md 的指令。交出 spec（`## N.` 第一層 bullet 是 promise，D:213-217, :231-234）或 `task-<started>/design.md`（D:239-245）、mockup（D:89）、context.md（D:255-256）。需要使用者的點有四個：一次一題（D:54-56）、每節問一次是否成立（D:210）、mockup tune loop（D:134-155）、「請使用者讀完再等」（D:258），最後 gate（D:273）。
- plan 透過 `**Spec:**` 行讀 design（P:63, :73-75）、`map.js` 產生的 constraints（P:79-95）、既有程式碼模式（P:104）；沒有讀 context.md/survey.md 的指令，**也沒有 `context.js add` 指令**。交出 plan 檔（Files/Interfaces/Dispatch/Coverage，P:127-131, :179-182, :194-231, :325-343），plan 本身帶程式碼、每個 code fence 標檔名（P:289-305）。implementer「只看到自己的 task」（P:184-185）。沒有「不重讀」規則。

**3. build / verify / audit / land 的 SKILL（sonnet）**
- 四份 SKILL.md 都沒有 `context.md` 字樣，也沒有「不重讀」規則。
- build 讀 ledger（show/init/groups/scan/hands/ready，:67-246）；implementer 收到「三樣東西、沒有別的」（:212-214），brief 由 `ledger.js brief <n>` 產生（:217-226）。需要主 session 的點：在 main 上開工要問一次（:53-55）、`Dispatch: user` 的 task 由握有 AskUserQuestion 的 session 跑（:191-196）、Workflow tool 由 controller 開（:323-328）。
- verify：verifier 收 range＋task 文字＋map 路徑（:192-195）；adversary 收路徑不收貼文（:259）；「What you do not dispatch is this stage」（:168-169）。
- audit：`:251-254`「What you do **not** dispatch is this stage. A subagent receives the brief and nothing else… the judgement, the findings and the question at the end stay here」；「Never move a document unasked」（:296-300）；gate 三選項（:339-343）。
- land：整合決定是使用者的（:15-16, :328），menu 是 merge/PR/keep（:331-333），profile `land.integration`/`land.push` 設了就自動答（:323-326）；retro 只在使用者說 yes（:266-267），「A land brain sends it only when its brief carries that yes; otherwise its gate carries the offer」（:275-276）。

**4. stage.agents 控制、guard、gate、budget（sonnet）**
- 允許值：7 個 canonical stage 的任意子集，或 false/true/all（`lib/profile.js:196-207`，清單 :74）。現值 `["survey","build","verify"]`（`.fankeel/profile.json:6-10`），preset 註解寫「empirical choice, no reason recorded」（`lib/profile.js:558`）；lean=false（:553）、full=all（:563）。
- 沒有任何程式碼或文件明文擋 design/plan/audit/land 進 stage.agents。`controlRules` 只對 design/plan 加 `model: opus`、對 build/design/plan 加 commit relay（`lib/stages.js:718-720`）。brain 的 agent 檔本來就寫到 audit（mover）與 land（mover、retro）（`agents/fankeel-brain.md:3`）。
- 受控站的主 session 職責（`lib/stages.js:705-726`）：派一個 brain、prompt 只是站名（:718）；`commit <file>` 時跑 commit.js 再 SendMessage（:652）；背景跑 await.js、結束回合、不輪詢（:685）；印回傳路徑、讀 handoff 最後的 `json gate`、AskUserQuestion 逐字（:723）；relay 路徑→派新 brain（:723）；`task.js stage`（:724）；其他答案 SendMessage（:725）。controller 的 Edit/Write/寫入 Bash 會被拒（`hooks/guard.js:150-160`）。
- gate 逐字比對：`isDeepStrictEqual(asked, filed)`（`lib/handoff.js:463-466`）；符合就清 in-flight（`hooks/gate.js:406-408`）；不符且 header 等於站名、重疊超過門檻才拒（:337-360, :38-40）。
- 預算 SOFT=300000 / HARD=450000（`lib/context.js:48-49`）；SOFT 只提醒寫 relay（`hooks/budget.js:98-106`），HARD 拒所有工具只留 `.fankeel/build/` 下的 Write/Edit 與 SubagentHandback（:82-95）。
- brain-on-sonnet 決定：使用者只要關鍵點用 Opus（:8, :18）；design/plan 例外因為其輸出是後面每站消費的判斷（:19-20）；**沒有任何 sonnet brain 的量測**，所有數字都是 Opus（:24, :26）。

**5. agent 檔的 add-facts 與不重讀（sonnet）**
- 有 add 指令：reader（:68-72）、implementer（:24-28）、writer（:24-27）、mutator（:20-23）、mover（:22-25）、brain（:57-61，**只限 survey 或 design 站**）。
- 沒有：reviewer、verifier、judge。
- 最接近「不重讀」的只有 writer：「Read a file yourself only for a fact neither of those holds」（fankeel-writer.md:22）；implementer 只有「Files 沒列的檔回 `blocked:`，不去找」（:21-22），沒說 prefix 裡有的不必再讀；brain.md:64-65 說「the stages after you start from `context.md` rather than reading the same files again」是目標敘述，不是對誰的指令。

**6. 前次判決與 task 目錄（sonnet）**
- 前次判決 J（`docs/90-agent/judgements/2026-10-21-plan-stage-duration.md`）：主 session 單人 plan 淨 33 分（91cb51ef，Write 8.6 分、其他生成 23.2 分、thinking 78k）與 35 分（9e59e535）（J:82-85, :58）；cacheRead 7.4M / 26.8M（J:94）。委派 writer：e2d126e8 reviewer 77 次工具呼叫中 30 次 Read（J:98）；45487ab9 四個 opus 片段 writer 27–41 分、cacheRead 51.3M、338 requests；9f451488 六個 writer、cacheRead 56.8M、377 requests（J:90-94）；「平行 part writer 每個 10–41 分、64–107 次工具呼叫、多為 Read」（J:100）；平行 cacheRead 是單人的 5–7 倍（J:94）。brain run 8846548c：plan brain 55 分＋relay 29＋reviewer 2.7，共 84 分，plan 3051 行/14 task（J:88, :106）。
- 最近 6 個 task 目錄：`task-20261021T024539` context.md 2 條；`task-20261020T183037` 8 條；其餘 4 個（024807、160900、124214、134844）**沒有 context.md**。survey.md 46–80 行。context.md 事實與 survey.md 的 path:line 完全不重疊（0/10、0/2）——兩者承載的是不同東西。
- `.fankeel/map.md` 159 行。

**7. 派工 prompt 有沒有帶 context.md（opus）**
- 16 個 session、1,034 個 subagent 首則 prompt：**69 個（6.7%）帶事實，全部是 implementer 的 `## Task context` 區塊**；reader、reviewer、verifier、fixer、brain、judge、mockup、general-purpose 一個都沒有。
- 8846548c 有 18 條可用、傳 0；91cb51ef 18 條、傳 0（當時 prefix 尚未存在，約 10-19 之後才有）。45487ab9 29/38 implementer 帶；9f451488 16/42；66a6563a 9/13；94618e2b 8 個有區塊但 6 個是 "none yet"；739fa960、b7a7d8d4 全部 "none yet"（context.md 空或目錄不存在）。
- brain 的 prompt 長度 6–31 字元（只有站名），完全沒帶東西。
- 有帶的例子：`C:/Users/user/.claude/projects/F--ymlab-fankeel/45487ab9-c8fc-44c7-a0db-d46d41bb4796/subagents/agent-a0a6a26d09ecaa5dc.jsonl:1`；沒帶的例子：`C:/Users/user/.claude/projects/F--ymlab-fankeel/4907a1ed-c140-4a6b-a2d9-debc550d17d0/subagents/agent-a157da6bb76ce5345.jsonl:1`（本任務的 reader）。

**8. 跨站重讀量測（opus，task-20261008T155402 = 8846548c，survey/design/plan 皆 brain、build 在主 session）**
- 站界（主 jsonl `C:/Users/user/.claude/projects/F--ymlab-fankeel/8846548c-26e8-4b4a-a6cd-c8d649c9de33.jsonl` 行號）：survey Skill :56、survey brain :140、design brain :384、plan brain :561、plan relay :669、build Skill :1062、verify Skill :4298。
- 只算 Read tool：survey 8 次/8 檔；design 7 次（1 次碰 survey 集合）；plan 27 次/15 檔（0 碰 survey、3 碰前站）；build 76 次/31 檔（0 碰 survey、24 碰前站）。
- 加計 Bash 的 cat/sed/grep（偏高，grep 到路徑也算）：survey 48；design 73（23 碰 survey）；plan 146（29 碰 survey、63 碰任一前站）；build 1354（161 碰 survey、437 碰前站）。
- 重讀最多的檔：`scripts/bench.js` 2/3/5/83、`lib/bench.js` 3/2/4/65 ——是這個任務**正在改的檔**，build 讀它們是必要的。`.fankeel/map.md` 2/2/3/2、`hooks/guard.js` 1/2/3/0。
- 每個 agent 的 Read：兩個 plan brain 各 9 與 8 次（prompt 點名的檔 0–1 個）；13 個 implementer min/median/max 1/3/6、共 39 次，其中 23 次是自己 prompt 裡點名的檔；34 個 reviewer 共 16 次。
- SKILL.md 讀取：只有各站 brain 讀自己那份（survey 1、design 1、plan 2 因 relay）；implementer 0 次。
- 重讀例子：survey.md 主 session 在 :345 Read，design brain 在 `…/8846548c-…/subagents/agent-a922420e42f426031.jsonl:14` 再 Read；design.md 主 :526、plan brain `…/subagents/agent-a45b1252f91424483.jsonl:21`——這兩個是 handoff 檔，被下一站讀**正是承接在運作**，不是浪費。

### 二、抽查結果

八處都開了：`F:/ymlab/fankeel/lib/render.js:816-824`、`F:/ymlab/fankeel/skills/fankeel-survey/SKILL.md:317-321`、`F:/ymlab/fankeel/skills/fankeel-audit/SKILL.md:251-254`、`F:/ymlab/fankeel/hooks/guard.js:150-181`、`F:/ymlab/fankeel/agents/fankeel-brain.md:57-66`、`F:/ymlab/fankeel/.fankeel/build/task-20261020T183037/context.md`（8 條）、45487ab9 implementer prompt 的 `## Task context` 區塊、8846548c 主 :345 與 design brain :14 的 Read file_path 都是 `task-20261008T155402/survey.md`。全部與 reader 所述相符。

**一處需要更正 reader 1**：它說 `renderBrief` 在 render.js:822「嵌入內容」，但該處註解（:820-821）寫的是「The task's verified facts, **by path only**: a subagent that needs one reads the file, and one that does not pays nothing for it」。reader 7 的實測（965 個非 implementer prompt 零事實行）與註解一致，所以採註解：一般 brief 只給路徑。這點直接決定了 pick——機制「存在」的只有 build prefix 那一段，其餘站是路徑一行。

### 三、每站表

| 站 | 讀什麼 | 交出什麼 | 觀察到的重讀 | 該不該 brain | 該收到的 pack |
|---|---|---|---|---|---|
| survey | map.js/survey.js 輸出、patrol 的 todo（S:336-363） | survey.md 46–80 行；context.md（S:317-321，實測 0–8 條，多數 0） | —（第一站） | 已是（profile） | 已有 map 摘要 |
| design | map.md（D:195-205）、使用者對話；brain 實際會 Read survey.md | spec/design.md promise 清單、mockup、context.md（D:255-256） | 73 次讀取 23 次碰 survey 集合（Read 精確 1/7） | **先不要**：4 個對話點各一次 relay 往返，8846548c 跑過一次（:384）但沒量時間 | survey.md 全文＋context.md 內容＋map 的 pages 清單（≈150–250 行） |
| plan | design（Spec 行）、constraints、程式碼；**沒有 context.md 指令** | plan 1000–3000 行（帶程式碼）、Files/Interfaces/Dispatch；**不寫 context.md** | 146 次讀取 29 次碰 survey、63 次碰前站；brain 各 Read 8–9 次；ad-hoc writer 64–107 次工具呼叫 | **trial 後再決定**：唯一量測 84 分 vs 主 33–35 分，且撞 300k relay | 決定性的 `prefix --stage plan`：context.md＋design promise 清單＋survey findings＋constraints 區塊 |
| build | ledger（plan）；implementer 收 prefix＋brief | ledger complete/fix/ruling、review-n.txt、`done: n of m` | implementer Read median 3，23/39 是 prompt 點名的檔；437 次「重讀」是正在改的檔 | 已是 | 已有 prefix（ledger.js:473-509），但 context.md 空時就是 "none yet" |
| verify | ledger ranges、verify-map、lenses、自跑 build/test/lint | held/did-not-hold 表、adversary | 未量 | 已是 | verifier/adversary brief 加 context.md 內容（小） |
| audit | docs-check/residue/knip/deptry/docs-audit | findings、routed、TODO | 未量 | **可試（第二順位）**：brain.md:3 已涵蓋 mover；gate 三選項＋「never move unasked」剛好是 handoff-gate 模型 | docs-audit 輸出路徑＋context.md |
| land | suite.js、skills-check、todo-check、notes、profile | record.js、todo done、`task.js land merge/pr/keep` | — | **可試（第三順位）**：L:275-276 已寫 land brain；但 controlRules 的 commit relay 只列 build/design/plan（stages.js:718-720），land brain 的 commit 路徑未驗證 | suite 紀錄路徑＋notes |

### 四、為什麼是 D（C 先、再逐站試）而不是 A

使用者的前提「survey 掃完沒帶過去，每個 agent 重新查」**一半對**：context.md 幾乎是空的（6 個 task 裡 4 個沒有），一般 brief 只給路徑，plan 站既不讀也不寫 context.md，reviewer/verifier/judge 從不記錄——所以就算 survey 認真記了，也只有 build 的 implementer 會收到。這部分是 C。

**另一半不對**：量得到的重讀量不是時間去向。8846548c 的 plan brain 只 Read 8–9 次就花了 55 分再 relay 29 分；前次判決也量出主 session 單人 plan 的 33 分裡 Write 8.6 分、生成/思考 23 分。慢在「plan 必須帶滿版程式碼」（P:289-305）的生成量，帶再多 pack 也不會讓 3051 行寫得更快。前次判決裡 64–107 次工具呼叫的 writer 是 general-purpose、沒有 brief、沒有 prefix 的 ad-hoc agent——那是「沒用機制」，不是「機制不存在」。

**全站 brain 的部分**：程式碼早就允許（`profile.js:563` 的 full preset 就是 all），守衛與 gate 比對也已經讓受控站的主 session 退成純 relay，所以「主模型無差異」在技術上可達。但：(1) 唯一量過的非 survey/build/verify brain（plan）比主 session 慢 2.4 倍並撞 relay；(2) design 在 brain 裡每個問題都要 handoff→gate→SendMessage 一次往返（stages.js:725 有這條路，但沒量過幾次）；(3) sonnet brain 完全沒數據（決定 :24-26）；(4) land brain 的 commit relay 規則不在 controlRules 名單。沒有先補 pack 就把站搬進 brain，只會讓每站都從零讀 SKILL（300–800 行）＋handoff，重現 plan 的 84 分。

### 五、第一步改動（檔案／函式）

1. `F:/ymlab/fankeel/lib/render.js:820-822` `renderBrief` 的 `pushContext`：改成嵌入事實**內容**（現在是路徑），由既有 `fit`（:752-760，BRIEF_MAX 9500）兜底——一次改到 reader/reviewer/verifier/writer/judge/mockup 所有 brief。`renderBrainBrief` :594 同步；但 brain 實際收到的 prompt 只有站名（stages.js:718，實測 6–31 字元），所以要另外確認 SubagentStart hook 或 brain 自己讀 `task-<started>/context.md` 的路徑是否存在（本次未查）。
2. `F:/ymlab/fankeel/scripts/ledger.js:473-509` `prefix()` 泛化成 `--stage plan|design`：context.md 原文＋design 的 `## N.` 第一層 bullet（promise 清單）＋survey.md 的 path:line findings＋constraints 區塊；維持決定性輸出（:469-472）讓所有 plan reader/reviewer/writer 共用 cache 前綴。
3. 規則補齊：`skills/fankeel-plan/SKILL.md` 加 `context.js add` 指令（今天沒有）與「prefix 裡有的 path:line 不再開檔」；`agents/fankeel-reviewer.md`、`fankeel-verifier.md` 加 add-facts 行；`agents/fankeel-brain.md:57` 的「On a survey or a design stage」改成每站；`skills/fankeel-build/SKILL.md`、verify、audit、land 加一句 context.md。
4. `.fankeel/profile.json` 的 `stage.agents` **不改**。

### 六、Trial 與門檻

一個 ≥ 8 task 的真實任務，走 survey→design→plan（主 session）→build，用 `scripts/conversation.js` 與本次 reader 7/8 的方法量：

| 指標 | 今天 | adopt（繼續往 brain 搬） | drop |
|---|---|---|---|
| plan 開始時 context.md 事實數 | 0–8 | ≥ 10 | < 5（survey 沒記，先修 survey） |
| plan/verify 站 subagent prompt 帶事實比例 | 非 implementer 0%、整體 6.7% | ≥ 90% | < 50% |
| plan 站 subagent 對 context.md 已引 path:line 的 Read | 29（含 Bash） | 0–3 | ≥ 15 |
| plan 淨時間（主 session） | 33–35 分 | ≤ 35 分且 cacheRead ≤ 1.5× 單人（≤ 11M/40M） | ≥ 45 分 |

第一輪過了才做第二輪：`stage.agents` 加 `plan` 跑同規模任務——adopt 若 plan brain 淨時間 ≤ 40 分（≤ 1.2× 主）且零 relay；drop 若 ≥ 50 分或任何 relay。第三輪 audit/land brain：adopt 若 handoff 的 gate 與 SKILL 輸出形狀一致、guard 零次拒絕 controller 寫入、land 的 commit 有走到 commit.js。design 最後：先量主 session design 的時間與問題數（今天沒有基準），再試 brain，adopt 若 gate 往返 ≤ 6 次且不慢於主。

### 七、主模型會不會真的無差異（問題 4）

受控站下主 session 只做：派 brain（stages.js:718）、commit.js relay（:652）、背景 await.js（:685）、印路徑＋逐字 gate（:723）、`task.js stage`（:724）、SendMessage 答案（:725）；Edit/Write 被 guard 拒（guard.js:150-160）；gate 抄錯會被 gate.js 的 `isDeepStrictEqual` 擋下（handoff.js:463-466）。這些 haiku 做得到，而且錯了有 hook 接。**但**今天 design/plan/audit/land 不在 stage.agents，主模型在那四站仍是作者——這才是使用者感受到「主 session 模型有差」的來源，而不是 relay 本身。全站 brain 後品質就落在 brain 模型：pin sonnet、design/plan 用 opus（controlRules），沒有 sonnet 數據。

### 八、風險（問題 5）

- brain context 成長→relay：plan brain 在 55 分撞 300k SOFT 後 relay 29 分，relay 後只重讀到 Task 4；每站 brain 都要先載 SKILL 300–800 行。
- design 對話：4 個問點在 brain 裡各一次往返；mockup tune loop（D:134-155）由 `tune.js wait` 驅動，是否能在 brain 內跑完本次未查。
- 成本：平行 writer cacheRead 5–7× 單人（J:94）；pack 每個 agent 都付一次 prompt，只有決定性前綴能共用 cache——所以 pack 必須是 ledger 那種無時間戳的格式。
- pack 大小：一般 brief 9500 字元由 `fit` 兜底；prefix 無上限，只靠 40 條事實限制，survey.md＋context.md＋map 摘要合計 < 300 行是安全範圍。

### 九、沒查到的

- SubagentStart hook 是否替 brain 注入 context（brain prompt 只有站名）。
- `agents/fankeel-brain.md:130` 之後是否有站別拒絕；`hooks/budget.js:78` 之前。
- 8846548c 的 design brain 時間、gate 往返次數、cacheRead；verify/audit/land 站的重讀數。
- reader 8 的 Bash 計數把 grep/git diff 提到的路徑也算讀取，偏高；Read tool 的數字才是精確的。
- reader 7 的「可用事實數」是今天的 context.md，不是派工當時的。
