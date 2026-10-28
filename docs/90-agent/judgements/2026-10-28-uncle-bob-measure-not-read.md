---
judged: 2026-10-28T13:01:15.617Z
model: fable
agent: fankeel-judge
task: "Uncle Bob 不讀碼但嚴密測量：fankeel 可參考什麼"
session: 3f466922-41a4-4dbf-b216-32de1ad4f316
stage: survey
---

# Brief 42 — Uncle Bob's "don't read, measure hard": what should fankeel take?

## Question

# Brief 42 — Uncle Bob's "don't read, measure hard": what should fankeel take?

html: yes

## Question

The user pasted a 繁體中文 summary of a video on Robert Martin (Uncle Bob)'s current AI-era workflow and asked: 「幫我分析看看 你覺得 我們有什麼東西可以參考」 — what in it should fankeel (this repo, a Claude Code plugin that runs tasks through survey/design/plan/build/verify/audit/land stages with subagents) borrow, and what it already does or should deliberately not do.

## The video's claims (from the user's paste — unverified as Uncle Bob's actual words; treat as the user's summary)

1. He no longer reads ~95% of AI-written code; human reading speed must not be the bottleneck.
2. Three machine checks replace reading:
   a. Unit tests as double-entry bookkeeping (code once, test once; mismatch = red).
   b. CRAP score (cyclomatic complexity × lack of coverage); threshold loosened for AI (no 5–7 concept working-memory limit), tightened again as soon as the agent starts "fix one, break another".
   c. Mutation testing — plant faults (flip comparisons), check the suite kills them; AI does in ~30 min what took a night.
3. He tried a multi-agent pipeline (spec / test / refactor / QA agents) and abandoned it within a month: handoffs leaked information and were slow. Now treats one agent as a senior engineer partner (a 45-min argument with Grok convinced him), plus architecture visualisation tools.
4. Clean Code principles (modularity, dependency management) still hold because bad code traps AI too; he dropped strict TDD order and accepts code-first-then-tests from AI.
5. Responsibility stays with the human who signs; he takes it at the layer of architecture, test strength and metric thresholds, not line reading. Contrast: Linus/kernel insist on human patch review; Simon Willison requires you can explain the code to someone.
6. Newcomers: hand-write code for a year first.
7. Preconditions for not reading: full machine check system, humans who read architecture diagrams, willingness to sign.

## Background in this repo (these decide the answer)

- Mutation testing already exists: `agents/fankeel-mutator.md`, and how verify uses it in `skills/fankeel-verify/SKILL.md` (search "mutat"). How many mutations, who picks them, is it per task or sampled, is there a kill-rate number recorded anywhere?
- Tests / evidence: `agents/fankeel-verifier.md`, `agents/fankeel-implementer.md` (test first?), `skills/fankeel-build/SKILL.md` (per-task review, TDD order?), `scripts/suite.js`.
- Complexity / coverage: search the whole repo for `complexity`, `coverage`, `c8`, `crap`, `cyclomatic`, `eslint` — is anything measured today? `package.json` devDependencies and scripts. Is there any size/complexity check (e.g. `scripts/residue.js`, `scripts/css-dead.js`, `scripts/design-lint.js`, `scripts/review-check.js`, `scripts/gate-check.js`)? Note the station.js split work (`git log --oneline -15`, task station-52) — a big file being carved up is exactly the "bad code traps AI" point.
- Multi-agent pipeline vs one senior agent: fankeel IS a multi-stage, multi-agent pipeline. Read `docs/03-decisions/2026-09-22-all-stages-brain-promoted.md`, `2026-09-20-survey-brain.md`, `2026-09-28-agent-lifetime.md`, `docs/90-agent/reference/subagents.md`, and the `stage.agents` profile key (`survey,build,verify` here). Are there recorded handoff-leak / context-carry problems (`.fankeel/build/ask/2-stage-context-carry-brief.md`, judgements on `stage-agent-pause`, `compact-before-build`)? Judge whether Uncle Bob's abandonment is evidence against fankeel's shape, or whether fankeel already differs in the way that matters (readers return only deciding lines; one implementer per task; handoff by file path).
- Human responsibility / gates: gates at stage end via AskUserQuestion; `docs/01-guide/concepts.md`. Does fankeel ask the user to read code, or to approve at the design/plan/evidence layer?
- Architecture visualisation: chartroom / mermaid judgements (`docs/90-agent/judgements/2026-10-25-mermaid-renderers-vs-chartroom.md`, `2026-10-27-gitdiagram-vs-design.md`) and the project map (`scripts/map.js`).
- Prior "outside thing vs ours" judgements — keep consistent or say why not: `docs/90-agent/judgements/2026-10-26-karpathy-skills.md`, `2026-10-22-graphify-knowledge-graph.md`, `docs/03-decisions/2026-09-24-optimise-own-first.md`.
- Sources ledger `docs/90-agent/reference/sources.md` and TODOs `docs/90-agent/todo/` — anything already queued about coverage, complexity or mutation kill rate?
- Cost constraint: every line in a per-turn rule rides every prompt; fankeel puts discipline in the stage skill or agent that needs it. A tool dependency (c8, a complexity linter) costs install weight in a plugin users install; prefer zero-dependency Node where possible (check what the repo already depends on).

## Options

A. Already covered — fankeel already measures enough; name where each of the three checks lives. No change.
B. Borrow named pieces — e.g. a coverage/complexity (CRAP-like) number per changed function in verify, a recorded mutation kill rate, a "tighten when fix-one-break-another" trigger, a stated "user signs at design/evidence layer, not code" principle in the guide. List each with target file and first concrete edit, ranked by value/cost.
C. Rethink the multi-agent shape toward one senior agent, because his pipeline failed.
D. Something else.

## What counts as an answer

One pick. Then a table: each of the video's points → fankeel today (path:line, or "absent") → take / already have / reject, with one-line why. For every "take", the first concrete step and its rough cost. Say explicitly whether point 3 (pipeline abandoned) is a warning for fankeel, with evidence from this repo. Anything not verified from files is labelled unverified.

## Shape

Six fields (`pick:` first), `## 白話` (≤600 chars, 繁體中文), then `## Summary` in 繁體中文 with the table; a ```chartroom fence is welcome if it makes the take/have/reject split clearer.

## Answer

pick: B — 借四件小東西（verify 記突變殺率、指南寫明關卡核准的是做法與證據、map 列最大檔、node 內建 coverage 只做零依賴試跑）；多 agent 架構不動，測試先寫不放鬆。
why: 三種機器檢查：2a 已有且比他嚴（agents/fankeel-implementer.md:12-14 測試先寫；skills/fankeel-build/SKILL.md:359-362 reviewer 每任務實跑一顆突變）；2c 有但每次只一顆、沒有任何殺率數字（agents/fankeel-mutator.md:17-21、:44-46；verify SKILL 全文無 kill）；2b 完全沒有（cyclomatic/crap/c8 零命中，package.json:7-13 零依賴，scripts 無 size/複雜度門檻）。
點 3 不是警訊：同一抱怨 fankeel 量過（.fankeel/build/ask/2-stage-context-carry-brief.md:7；docs/90-agent/judgements/2026-10-21-stage-context-carry.md:68 重讀非慢因），修法是帶事實、不是合併 agent；交接走路徑不走內容（docs/03-decisions/2026-09-20-survey-brain.md:23），與他的角色分工流水線不同形。
點 5 已是 gate 的做法（docs/01-guide/concepts.md:43 核准的是做法本身）但指南沒寫成原則，一句即可。
依 docs/03-decisions/2026-09-24-optimise-own-first.md:8，coverage 沒對到記錄過的問題、只能零依賴試跑；大檔列表對到 station.js 6,939 行事故（docs/90-agent/todo/station-52.md:9）。零依賴是硬規矩（judgements/2026-10-25-mermaid-renderers-vs-chartroom.md:58），所有 take 落在 skill/agent/guide/map，不進每輪注入。
would flip if: verify 的 brief 模板（lib/render.js:660 附近）或 evidence 檔其實已記「applied/killed」——take #1 變已有；或一次 trial 顯示 context.md 內嵌後交接仍丟使用者的決定——C 才有分量。
unread: brief 點名的檔案全部有 reader 開過。部分：docs/90-agent/reference/subagents.md:717-1024 只 grep 未讀；lib/reviewcheck.js 未開（review-check 三張表是否含大小）；sources.md:60 命中詞未解；REVIEWER-COST-260907 報告的數字未讀；node coverage 旗標未在本機實跑。
delegated: opus — agents/fankeel-mutator.md, skills/fankeel-verify/SKILL.md, agents/fankeel-verifier.md, lib/render.js:660(grep); opus — .fankeel/build/ask/2-stage-context-carry-brief.md, docs/90-agent/judgements/2026-10-21-stage-context-carry.md, 2026-10-22-stage-agent-pause.md, 2026-10-12-compact-before-build.md, docs/90-agent/todo/stage-2.md, docs grep; sonnet — agents/fankeel-implementer.md, skills/fankeel-build/SKILL.md, agents/fankeel-reviewer.md; sonnet — repo grep(coverage/complexity/c8/crap/cyclomatic/eslint), package.json, scripts/suite.js, tests/ scripts/ 清單; sonnet — scripts/residue.js, css-dead.js, design-lint.js, review-check.js, gate-check.js, git log -15, docs/90-agent/todo/station-52.md, docs/90-agent/plans/2026-10-28-station-shell-design.md, 行數統計; sonnet — docs/03-decisions/2026-09-22-all-stages-brain-promoted.md, 2026-09-20-survey-brain.md, 2026-09-28-agent-lifetime.md, docs/90-agent/reference/subagents.md, .fankeel/profile.json, docs/01-guide/profile.md; sonnet — docs/01-guide/concepts.md, judgements/2026-10-25-mermaid-renderers-vs-chartroom.md, 2026-10-27-gitdiagram-vs-design.md, scripts/map.js, lib/map.js, lib/chartroom/README.md, docs/90-agent/reference/plain-language.md; sonnet — judgements/2026-10-26-karpathy-skills.md, 2026-10-22-graphify-knowledge-graph.md, docs/03-decisions/2026-09-24-optimise-own-first.md, docs/90-agent/reference/sources.md, docs/90-agent/todo/ grep, scripts/context.js.
checklist: 1 mutator 每次幾顆/誰選/記殺數 — answered（一顆、caller 選、不記）；2 verify SKILL 突變規則與殺率 — answered（無計數、無殺率）；3 verifier 證據列與 coverage — answered（無欄位 schema、無 coverage）；4 implementer 測試先寫 — answered（是）；5 build 每任務 review/TDD — answered（reviewer 讀 pinned diff、測試先寫）；6 reviewer 讀法 — answered（對 claim 讀、非逐行）；7 repo grep 複雜度/覆蓋 — answered（零量測）；8 package.json — answered（零依賴、node>=22.5）；9 suite.js — answered（無 coverage 旗標）；10 五支 scripts 大小檢查 — answered（無）；11 git log/station-52 — answered（6,939→目標 1,500，理由結構性）；12 all-stages-brain — answered；13 survey-brain — answered；14 agent-lifetime — answered；15 subagents.md 交接形狀 — answered；16 stage.agents 值 — answered（survey,build,verify）；17 context-carry brief — answered；18 stage-agent-pause/compact-before-build — answered；19 concepts.md gate 核准什麼 — answered（做法，非碼）；20 mermaid 判決 — answered；21 gitdiagram 判決 — answered；22 map.js 內容 — answered（require 計數、無行數）；23 chartroom 格式/plain-language 規則 — answered；24 karpathy 判決 — answered；25 graphify 判決 — answered；26 optimise-own-first — answered；27 sources.md — answered（僅 mutation 三筆）；28 todo/ — answered（無 coverage/複雜度/殺率條目）；29 context.js 用法 — answered（已寫入三條事實）。

## 白話
選 B：借三、四件具體的小東西，多 agent 的架構不動。
Uncle Bob 的三種機器檢查，fankeel 已有兩種：每個任務先寫測試，審查者再故意弄壞一行、確認測試會變紅。這像會計的兩邊記帳，一邊錯了就對不起來。
缺的是數字。現在每個任務只種一顆壞種子，殺了幾顆沒人記下來；程式有多複雜、測試蓋到多少，也沒有任何程式在量。
先補最便宜的三件：verify 多記一行「種了幾顆、殺了幾顆」；指南多寫一句「你在關卡核准的是做法與證據，不是逐行讀碼」；專案地圖多列出最大的幾個檔案。
他放棄多 agent 流水線，對 fankeel 不是警訊。fankeel 量過同樣的抱怨：重讀不是慢的主因，修法是把事實帶到下一站，不是合併成一個 agent。
測試先寫這一條，不要跟他一起放鬆。

## Summary

影片內容是使用者的摘要，未對照 Uncle Bob 原話，以下七點一律當「使用者的摘要」處理（unverified）。fankeel 這邊的每一格都有 reader 回報的 path:line，九處抽查全部與 reader 所述相符。

### 逐點對照表

| 影片的點 | fankeel 今天 | 判定 | 一句理由 |
|---|---|---|---|
| 1 不讀 95% 的碼，人讀速度不能是瓶頸 | gate 核准的是「做法本身」與站的報告骨架（docs/01-guide/concepts.md:43、:49）；implementer 回傳路徑不回 diff（agents/fankeel-implementer.md:87-91；subagents.md:444-445）；reader 只回決定句（lib/render.js:529）。 | 已有 | 使用者在 fankeel 讀的是報告與證據表，不是碼；但 fankeel 多一層「agent 對著 claim 讀 diff」（agents/fankeel-reviewer.md:18-20），這是他用數字取代掉的那一層，fankeel 該留。 |
| 2a 單元測試＝複式記帳 | implementer 測試先寫（agents/fankeel-implementer.md:12-14）；每個新測試附 `red when:` 行（:87-91）；沒有 red-when 行就是 finding（skills/fankeel-build/SKILL.md:236-237）。 | 已有（且更嚴） | 他接受 AI 先碼後測；fankeel 要求先測且要寫出「什麼會讓它變紅」，比單純兩邊記帳多一筆核對。 |
| 2b CRAP（複雜度 × 未覆蓋） | 完全沒有：cyclomatic/crap/c8/nyc/istanbul/stryker 零命中；`complexity` 15 處全是散文；`coverage` 在程式裡只是文件分母（lib/stages.js:335）與忽略目錄（lib/tracked.js:136）；package.json:7-13 無任何 dependency；scripts 無 size/複雜度門檻（只有 reviewer 的「超過 1000 行先想砍」預設，agents/fankeel-reviewer.md:111-113）。 | 借一半（零依賴） | 複雜度工具不收：零依賴是硬規矩（judgements/2026-10-25:58）、也沒有記錄過的問題對得上（optimise-own-first.md:8）。覆蓋率可零成本試：engines `>=22.5`、本機 v24.21.0，node 自帶 `--experimental-test-coverage`（此旗標存在是我的知識，未在本機實跑）。 |
| 2c 突變測試，AI 30 分鐘做完 | 有：build 的 reviewer 每任務挑一條 red-when、在 scratch copy 實跑一顆突變（skills/fankeel-build/SKILL.md:359-362）；verify 由站 agent 派 fankeel-mutator（lib/render.js:660），一次只一顆（agents/fankeel-mutator.md:3、:36），回四行 before/mutated/restored/path（:44-46）；存活者寫進 context.md、gate 時路由回 build（verify SKILL.md:327-329）。 | 已有＋借數字 | 機制有，數字沒有：全 repo 無 kill 計數、無殺率；sources.md 只三筆 mutation 記錄（:56 REVIEWER-COST-260907、:130-131）；todo 371 條沒有一條談殺率。他的「門檻鬆緊」要先有數字才談得上。 |
| 3 多 agent 流水線一個月內放棄：交接漏資訊、慢 | fankeel 記錄過同一抱怨：「survey 掃完沒帶過去、每個 agent 重新查」（.fankeel/build/ask/2-stage-context-carry-brief.md:7、:13、:17）；判決 2026-10-21-stage-context-carry.md:65-68：承接機制「存在但空轉」（1,034 個派工 prompt 只 6.7% 帶事實），**實測重讀不是慢的主因**（plan brain 只 Read 8-9 次，時間花在生成 3,051 行 plan），選 D：brief 內嵌事實、各站補 `context.js add`，`stage.agents` 不動；todo/stage-2.md 已 done（2026-10-23）。 | 不是警訊，但是提醒 | 見下節。 |
| 4 Clean Code 原則仍成立；放棄嚴格 TDD 順序 | 模組化在實作中：station-52 把 6,939 行的 station.js 拆成 FK_* 模組，目標 1,500 行（todo/station-52.md:9、:11、:13），今 assets/station/station.js 4,021 行；理由寫的是結構性（每畫面一模組），**不是**「agent 讀不下」——brief 的「bad code traps AI」是推論，非記錄。TDD 順序：fankeel 要求先測（見 2a）。 | 前半已有；後半拒絕 | 放鬆先測會拆掉 red-when 行與每任務一顆突變的根基（reviewer 靠 red-when 挑突變）。 |
| 5 責任在簽名的人，層次是架構／測試強度／門檻，不是逐行讀 | gate 三選項：核准／留站／暫停（concepts.md:41-45），核准的是做法與報告；但 concepts.md 沒有任何一句談「誰為出貨負責」或「證據取代讀碼」（reader 搜尋 read/sign/evidence/責任皆無）。 | 借（一句） | 實作已是如此，差一句把它說成原則。 |
| 6 新手先手寫一年 | 無對應物。 | 不適用 | 這是對人的建議，plugin 管不到。 |
| 7 不讀的前提：機器檢查全套、人讀架構圖、願簽名 | 機器檢查：有測試、突變、adversary（verify SKILL.md:256「Could it have failed?」），缺覆蓋／複雜度。架構圖：`.fankeel/map.md` 有 require 計數（:94-99「required by 147」）無行數；docs 九張 Mermaid；判決 2026-10-27:67、:71 明確不畫常駐 architecture.board。簽名：gate。 | 已有／不再加 | 視覺化已判過兩次（10-25 選 A、10-27 選 E），不重開。 |

### 點 3 是不是警訊——明說

**不是他說的那種警訊。** 三個理由，都有 repo 證據：

1. 他的流水線是**角色**分工（spec / test / refactor / QA agent 接力改同一份產物），fankeel 是**站**分工加**任務**分工：站之間交接走檔案路徑不走內容（docs/03-decisions/2026-09-20-survey-brain.md:23：「貼內容等於把整站塞回主控的 context」），任務內是一個 implementer 建一個 plan task（subagents.md:104-109；但兩個 implementer 可並行，:432-436 舊禁令已解，所以是「一人一任務」不是「一次一人」）加一個 reviewer 對 pinned diff（build SKILL.md:328）。他抱怨的「交接漏資訊」在 fankeel 對應的是 context.md 承接——這一條 fankeel 自己量過、也修了（2026-10-21 判決選 D，stage-2 已 done）。
2. 「慢」這一條 fankeel 量到了反證：survey-brain.md:47-50 成本打平（1.05x／0.97x）、時間 1.4-1.6x，但 2026-10-21:68 明說「重讀不是慢的主因」，時間在生成。他說的「handoff 慢」在 fankeel 是「生成長文件慢」。
3. stage-agent-pause 判決（2026-10-22:99）：brain 本身 0/76 次停擺，停的是主控——交接沒丟資訊，是等待機制的問題，另修（scripts/await.js）。

**但它是一個提醒**：2026-10-21:66 記的「承接機制存在但空轉」（6.7%）正是他說的漏資訊；fankeel 的答案是「讓承接真的發生」，不是「只剩一個 agent」。他的「一個資深工程師夥伴」在 fankeel 對應的其實是站 agent（brain）——它就是那位資深者，reader/reviewer/mutator 是它的手，不是接力的下一棒。這一題不需要改形，需要的是下次 trial 看 context.md 內嵌後的帶入率有沒有離開 6.7%——這也是 would-flip 條件。

### 四件 take，依「價值／成本」排序，各附第一步

| # | take | 目標檔 | 第一個具體改動 | 成本 |
|---|---|---|---|---|
| 1 | verify 記突變殺率 | skills/fankeel-verify/SKILL.md 的 claim 表（:62-68 附近）＋ agents/fankeel-verifier.md:20-21 的列說明 | 加一列 `| Tests catch faults | mutations applied N / killed K / survived S，每個 survivor 一行 path:line | one mutation |`；verifier 的證據列多三個數字 | 低：約 5 行 markdown＋ tests/ 一條斷言；不進每輪注入 |
| 2 | 指南寫明「核准的是什麼」 | docs/01-guide/concepts.md:43 之後一段 | 由 fankeel-writer 寫一段：你在 gate 核准的是做法與證據表、不是逐行碼；選了核准就是簽名；想讀碼可以，但不是前提 | 極低：一段指南文字，零每輪成本 |
| 3 | 地圖列最大檔 | lib/map.js（內容邏輯在此，scripts/map.js:4-7 只負責寫出） | 在 `most required:` 之後加 `largest:` 五行（path 行數），零依賴 | 低：約 15 行 JS＋一條 map 測試；對到 station.js 6,939 行才被判決看見的事故（todo/station-52.md:9） |
| 4 | node 內建覆蓋率，**只做試跑** | scripts/suite.js（:17 取 package.json test 指令處） | 加 `--coverage` 選項，追加 `--experimental-test-coverage --test-coverage-include=<changed files>`，把每檔 line% 寫進 suite.json；先在一個真實 task 跑一次，看有沒有 reviewer 漏掉的未覆蓋改動行，有才正式接進 verify | 中：約 40 行 JS＋測試；無記錄過的問題對得上，照 graphify 判決的「有界零成本試跑」處理（2026-10-22:70） |
| （5） | fix round 迴歸即停 | skills/fankeel-build/SKILL.md:487 附近 | 一句：「fix round 讓上一輪綠的測試變紅，fix round 結束、帶 finding 到 gate」 | 極低，但價值未證：現有五輪上限＋ re-review 的 pass/fail 表可能已足夠；列為可選 |

### 拒絕清單

- C（改成單一資深 agent）：證據見上節；另外 2026-09-28-agent-lifetime.md:15、:20 量過 brain 換手的暖機成本（22-24k → 62-103k），fankeel 已在成本面做過這道選擇。
- 放鬆測試先寫：拆掉 red-when 與突變取樣的根基。
- 裝 CRAP／複雜度／coverage 工具（c8、eslint-complexity、stryker）：零依賴硬規矩；package.json 今天一個 dependency 都沒有。
- 架構圖工具：10-25、10-27 兩次判決已定，不重開。
- 把任何一條寫進每輪注入：karpathy 判決 :104「紀律放在需要它的 stage，不騎每一個 prompt」；per-turn block 已 2397/2400。

### 與既有判決的一致性

- optimise-own-first.md:8「對方有、fankeel 沒有」不是收的理由 → take #4 因此降為試跑、複雜度工具因此不收；take #3 對到 station-52 事故；take #1 對到 compact-1.md:14 那次「拿掉條件、九項測試仍綠」的存活者事故（有事故、沒數字）。
- graphify 判決「借想法不借工具、零 Python 零 hook」 → coverage 用 node 自帶旗標，不裝套件。
- karpathy 判決「已有實質者不給第二份」 → 點 1、2a、7 不加字。

### 抽查結果

九處全部相符：skills/fankeel-build/SKILL.md:358-362（reviewer 挑一條 red-when 實跑突變）、agents/fankeel-implementer.md:12-14（test first）、package.json:1-15（零依賴、engines >=22.5）、docs/90-agent/todo/station-52.md:9-13（6,939 行、目標 1,500、理由結構性）、docs/03-decisions/2026-09-20-survey-brain.md:22-23（交接走路徑）、docs/90-agent/judgements/2026-10-21-stage-context-carry.md:65-68（pick D、6.7%、重讀非主因）、docs/01-guide/concepts.md:41-45（核准的是做法）、docs/03-decisions/2026-09-24-optimise-own-first.md:8-16、lib/chartroom/README.md:14-26（board 格式）。

### 已寫入 context.md（session 3f466922…，task-20261028T124912）

三條：零量測／零依賴／node 版本；突變一顆一派、無殺率；gate 核准做法、交接走路徑、context-carry 判決選帶事實。

```chartroom
{"chartroom":1,"title":"Uncle Bob 七點 → fankeel 收不收","root":"main"}
{"view":"main","title":"Uncle Bob 七點 → fankeel 收不收","dir":"LR"}
{"node":"p1","in":"main","label":"1 不讀 95% 的碼"}
{"node":"p2a","in":"main","label":"2a 測試＝複式記帳"}
{"node":"p2b","in":"main","label":"2b CRAP 複雜度×未覆蓋"}
{"node":"p2c","in":"main","label":"2c 突變測試"}
{"node":"p3","in":"main","label":"3 棄多 agent 流水線"}
{"node":"p4","in":"main","label":"4 Clean Code 留、TDD 順序放鬆"}
{"node":"p5","in":"main","label":"5 人在架構/門檻層簽名"}
{"node":"p7","in":"main","label":"7 架構圖＋簽名前提"}
{"node":"have","in":"main","label":"已有：gate 核准做法與證據、測試先寫+red-when、每任務一顆突變、map.md+Mermaid"}
{"node":"take","in":"main","label":"借：verify 記殺率、指南寫核准的是什麼、map 列大檔、node 內建 coverage 試跑"}
{"node":"reject","in":"main","label":"不收：改單一 agent、放鬆測試先寫、裝 CRAP 工具、常駐架構圖"}
{"edge":"e1","in":"main","from":"p1","to":"have","label":"gate 看報告不看碼","arrow":"end"}
{"edge":"e2","in":"main","from":"p2a","to":"have","label":"先測＋red-when","arrow":"end"}
{"edge":"e3","in":"main","from":"p2c","to":"have","label":"一顆/任務","arrow":"end"}
{"edge":"e4","in":"main","from":"p2c","to":"take","label":"殺率沒記","arrow":"end"}
{"edge":"e5","in":"main","from":"p2b","to":"take","label":"零依賴才試","arrow":"end"}
{"edge":"e6","in":"main","from":"p2b","to":"reject","label":"不裝工具","arrow":"end"}
{"edge":"e7","in":"main","from":"p3","to":"reject","label":"量過：重讀非主因","arrow":"end"}
{"edge":"e8","in":"main","from":"p4","to":"reject","label":"TDD 不放鬆","arrow":"end"}
{"edge":"e9","in":"main","from":"p5","to":"take","label":"寫進指南","arrow":"end"}
{"edge":"e10","in":"main","from":"p7","to":"have","label":"10-25/10-27 已判","arrow":"end"}
```
