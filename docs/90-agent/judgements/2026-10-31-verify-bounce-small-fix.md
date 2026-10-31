---
judged: 2026-10-31T21:50:04.913Z
model: fable
agent: fankeel-judge
task: "評估 verify→build 回跳：小修正能否在 verify 就地修完"
session: 3af3bdca-4521-4699-a40a-7e4e547c9b2a
stage: survey
human: no
---

# Brief 46 — verify 回跳 build：小修正為什麼不就地修完

## Question

# Brief 46 — verify 回跳 build：小修正為什麼不就地修完

## 問題

近期 session 裡常見這種路線：build → verify → 退回 build → 再 verify。有些退回的原因只是很小的改動：檔案飄移（文件某行和程式不再相符、行號或路徑過時）、一行的小修正。使用者想知道：

1. 這類小修正在 verify 站裡就地修完，會違反 fankeel 現行哪一條準則（skill、stage rule、hook/guard、gate）？還是準則其實允許、只是 session 沒有用？
2. 如果要讓小修正更快（例如 verify 直接派 fankeel-fixer 修，或「快速回 build、修完自己走回 verify 不停下來問」），哪個做法對、界線在哪？

## 選項

- A. 維持現狀：凡要改程式或文件都退回 build，理由是 verify 必須是「沒改過的東西的證據」。
- B. verify 已允許就地修（例如 fankeel-fixer 修文件/一行修正），問題在 session 沒照做 —— 修 skill 文字或規則讓它照做即可。
- C. 新增一條「快速回跳」：小修正自動 build→修→verify，不經 gate、不問使用者，有明確的大小界線（例如 fixer 的 <3 檔、無測試需求）。
- D. 其他判官看出的做法。

## 背景

- fankeel-fixer 的描述：處理 verify 與 audit 的死引用、錯句，與 reviewer 已點名的小程式修正；拒絕動到 3 個以上檔案；不能跑 Bash。
- verify 站由 fankeel:fankeel-brain 站 agent 跑（profile `stage.agents survey,build,verify`）。
- 使用者想知道的是「實際發生了什麼」加「準則怎麼說」，請用近期 session 的實證。

## 要讀的路徑

- `skills/fankeel-verify/SKILL.md`、`skills/fankeel-build/SKILL.md` 與它們引用的檔案
- `agents/` 下 fankeel-brain、fankeel-fixer、fankeel-verifier 的定義
- `hooks/guard.js`（站別寫入限制）、`scripts/task.js` 的 `stage` 指令（回跳的規則與 gate）、stage rule 注入處（`lib/` 下）
- 近期 session：`.fankeel/sessions/*.json`（route、stage 歷程、notes），`.fankeel/build/task-*/` 下的 verify.md / build 交接檔與 gate 區塊；`.fankeel/build/ask/measure-sessions.js` 或 `scripts/conversation.js` 可讀逐字稿
- `docs/90-agent/` 下關於 verify / build 分工的設計紀錄與 judgements

## 什麼算答案

- 找出近期至少幾次 verify→build 回跳，每次的退回原因與改動大小（檔數、行數），標出哪些算「小修正」。
- 指出阻止就地修的是哪一條具體文字或程式（path:line），或指出沒有這條、是 session 自己保守。
- pick 一個選項，說清楚小修正的界線，以及要改哪些檔案。

## 答案的形狀

七個欄位（pick 在內）、`ask human:` 最後，然後 `## 白話`（≤600 字），然後 `## Summary`。白話與 Summary 用繁體中文。

html: yes

## Answer

pick: B — verify 的規則「已經」允許就地派 fankeel-fixer 修純文件錯誤（skills/fankeel-verify/SKILL.md:124-128），但同一份 skill 的 :326-332 與注入的站規 lib/stages.js:334 又說「每個 fix 都是 build 的」，文字自相矛盾；session 都照嚴的那條走。對齊文字、訂出界線即可，不加自動回跳。
why: verify SKILL.md:124-128 明文：只有文件錯、無測試需求 → 派 fankeel-fixer（≤2 檔）、再跑 docs-check；lib/stages.js:757 與 docs/90-agent/reference/subagents.md:730 都把 fixer 列在 verify 可派的 agent 裡。
但 SKILL.md:326-332「so does every fix… a page found false… routed to build」與 stages.js:334「a fix is build's commit… never verify's」反向；沒有任何 hook/guard 擋 verify 寫檔（guard.js:150-157 只擋 controlled stage），task.js:1006 對第二次回跳只警告不擋。
實證：task-20261031T152138/verify.md:12「依規則回 build 修，verify 不動檔」、task-20261030T071915/verify-2-answer.md:13「改文字的小修，要走 build 的 commit 與 reviewer」；逐字稿裡 verify 階段從未提到 fixer。
近三週 6 次回跳有 3 次是純文件 ≤3 檔 ≤8 行（078d096b、87b721d4、91984952），每次仍付一次 brain 重派、reviewer、6000+ 測試 fast suite、約 10 輪、16–38 分鐘。
C 被 SKILL.md:309-311「never an automatic lap back」與 :330-332 的 09-06 五個無審查 fix 事故排除；gate 必須由 controller 問使用者（brain.md:12-13）。
would flip if: 若 land skill 不能收 verify 留下的未 commit 文件改動、且使用者拒絕讓 verify 下一個純文件 `Fix:` commit → 回 A，改由 build 收尾的 docs-check 更早抓飄移。
若近期回跳的小修多數其實是程式（非文件）→ 仍是 B 但受惠很小，界線不可放寬到程式。
unread: 無未開的具名路徑；但 `.fankeel/build/ask/measure-sessions.js` 跑不起來（:6 DIR 寫死 `C:/Users/Owner/...`，本機是 `user`），85216cfe 與 5b773eed 兩個最新回跳 session 本機無 .jsonl 逐字稿只讀到 gate；SKILL.md:154 引的 docs/90-agent/reports/2026-09-07-join-pair.md 與 land skill 不在 brief 內未讀。
delegated: skills/fankeel-verify/SKILL.md + lib/stages.js:322-346 (sonnet)；skills/fankeel-build/SKILL.md + rationale.md (sonnet)；agents/fankeel-brain.md、fankeel-fixer.md、fankeel-verifier.md (sonnet)；hooks/guard.js、scripts/task.js cmdStage、lib/stages.js、lib/render.js、lib/registry.js、lib/guard.js (opus)；.fankeel/sessions/*.json + measure-sessions.js (sonnet)；.fankeel/build/task-*/verify*.md、build-*.md + git log --numstat (sonnet)；docs/90-agent/** (sonnet)；scripts/conversation.js 逐字稿 6ff5bdb2、33a02218 + sessions gates (opus)
checklist: 1 verify skill 是否允許改檔／派 fixer、退回條件與 gate — answered（允許 :124-128；矛盾 :326-332；gate 無選項清單 :349-350）
2 build skill 從 verify 退回怎麼重進 — answered（:527-531 當一列 task 走完整 loop；無捷徑；fixer 規則 :506-511）
3 brain／fixer／verifier 定義 — answered（brain 不能 Edit 但可派 fixer :95-103；fixer ≤2 檔無 Bash :18-36；verifier 只寫證據檔 :39-40）
4 guard.js／task.js stage／lib 站規 — answered（無 verify 寫檔封鎖；回跳自由、二次只警告 task.js:1006；站規 stages.js:334 vs 可派清單 :757）
5 sessions json 近期回跳與理由 — answered（10-11 起約 65 個 session 有 verify>build，理由在 gates[].descriptions；measure-sessions.js 不可執行）
6 task-*/ 交接檔的回跳理由與改動大小 — answered（6 次，3 次純文件小修，表見 Summary）
7 docs/90-agent 設計紀錄與 judgements — answered（無任何 judgement 決定過此題；subagents.md:730 列 fixer 於 verify；judgements/2026-10-15-agent-effort-usage-render.md:76 fixer 在 verify 已被派 121 次）
8 逐字稿回跳當下有無考慮就地修 — answered（兩個有逐字稿的 session 都沒提 fixer；gate 只給 Go on／Back to Build；一次回跳約 10 輪）
ask human: nothing

## 白話

選 B：規則其實早就允許 verify 站把「只有文件寫錯」的小毛病就地請修補員改掉，問題是同一本規則的另一段又說「所有修改一律退回 build」，兩段打架，session 自然挑嚴的那條走。
好比驗收員發現說明書少打一個字：手冊第一頁說「驗收員可以直接改錯字」，最後一頁卻說「任何改動一律退回工廠」，結果每次都退回、重開產線、全套重測。近三週六次退回有三次就是這種幾行文字的小修，每次卻多花約十輪對話、重跑六千多個測試、十幾到四十分鐘。
做法：把兩段文字對齊，明訂界線——只限文件頁、最多兩個檔、不需要測試、改完重跑文件檢查就是證據；程式（連註解）、排版、要補測試的，仍退回 build。不建議「自動回跳不問人」，因為以前就出過沒人審的修補釀禍。

## Summary

### 一、準則怎麼說（八份讀取的結果與抽查）

**verify skill 自相矛盾。** 讀取者在 `skills/fankeel-verify/SKILL.md` 找到一條「允許」與一段「禁止」，我開檔抽查兩處都屬實：

- 允許：`skills/fankeel-verify/SKILL.md:124-128`「A false page with nothing else to fix is a fix with no test cycle of its own: dispatch `subagent_type: fankeel:fankeel-fixer` with the page and the exact correction, never more than two files at once. It returns which lines changed, and this stage re-runs `docs-check` itself once it returns — a code fix that needs its own red-then-green cycle is `build`'s」。
- 禁止：`skills/fankeel-verify/SKILL.md:326-332`「Anything unfinished returns to `build` — and so does every fix. **This stage commits nothing.** A defeated row, a test that should have reddened and did not, a page found false: each is routed to `build` at the gate, where the fix gets BASE, the parent's commit, one reviewer over its range and a `Fix:` line in the ledger. On 2026-09-06 five fix commits landed during this stage with no reviewer」。
- 「a page found false」同時出現在兩段，一段叫派 fixer，一段叫退回 build。文字沒有調和。另外 `:309-311`「never an automatic lap back」、`:37`「a fix with its own review range is build's commit, never verify's」。
- gate 選項：skill 沒有列出選項清單，只有 `:349-350` 模板「adversary: <the claim it defeated → build…> then AskUserQuestion」；`:282` 唯一限制是不得用「back to build」當 render 跳過的藉口。沒有任何「小修」專用路徑；「dead reference」「one-line」「行號」零命中。

**注入站規與可派清單也矛盾。**（opus 讀取者；我抽查 `lib/stages.js:334`、`:757`、`scripts/task.js:1006` 屬實）

- `lib/stages.js:334` 注入 verify 的規則：「Anything half-built sends this back to build; a fix is build's commit with its own review range, never verify's.」
- `lib/stages.js:757` verify 站 agent 可派：reader、reviewer、render-reviewer、verifier、**fankeel-fixer**、mutator。
- `lib/render.js:679` brain 的 brief 拿到同一條 :334 的文字；`render.js:660` 另加「You cannot edit or restore a file. To apply a mutation... send fankeel-mutator」，可派清單來自 `agentsFor`（含 fixer）。
- `hooks/guard.js`：**沒有** verify 專屬的寫檔封鎖。唯一站別規則是 `guard.js:150-157` controlled stage（controller 不得寫、由站 agent 寫），對每一站一樣；`WRITE_TOOLS` 在 `:29`，唯一豁免路徑 `.fankeel/build/ask/`（`:36-40`）。子 agent（有 agent_id）不受此限。
- `scripts/task.js` cmdStage（`:929-1043`）：verify→build 自由，不需 gate 紀錄；`:1006-1008` 第二次回跳只加一行警告「second return to build from verify — name what verify caught that build's review did not」，`:1012` 註明「warned, never blocked」；無 quick/small-fix 路徑；計數在 `lib/registry.js:633-641` `returnsTo`。

**agents 定義。**（我抽查 `agents/fankeel-fixer.md:18-36` 屬實）

- `agents/fankeel-brain.md:3` 描述：verify 站派「verifier, fixer and mutator」；`:4` 工具無 Edit；`:95-103` fixer/verifier/mutator 只在 brief 列出時可派；`:124-125`「The agents you dispatch may edit and run tests; you do not」；`:126-129` Write 只給 handoff 檔（build 站多一個 commit 檔）；`:184-187` 拒絕 git commit 等；`:191-194` 不寫 source/test；`:12-13` controller 負責問使用者；`:213-215` verify 退回來的 bare `build` 以 `build close` 處理。
- `agents/fankeel-fixer.md:18-24`：接「a reference page's dead path or stale quote, a false sentence a reviewer or the audit adversary already found, a one-line code correction with no test cycle」；需要 red-then-green 的是 build 的；`:28-30` 無 Bash；`:34-36` 三檔以上整件拒絕、兩檔以內可。描述 `:3` 明名「verify's and audit's dead references」。
- `agents/fankeel-verifier.md:39-40` 只寫證據檔、不碰樹。

**build skill 的重進路徑。**（我抽查 `skills/fankeel-build/SKILL.md:506-531` 屬實）

- `:527-531`「A fix that came back from `verify` is a row of this loop. `verify` commits nothing; … here it gets what a task gets: BASE…, the implementer resumed or the fix made in-session, the parent's commit, one reviewer on the template above over `BASE..<sha>`」；`:533-540` ledger `fix` 行需 `--range`。無縮短路徑；`:45-47` 不中途停問、做完才問一次；收尾 `:542-577` 要跑 fast suite、全枝 review、docs-check；`:549-551` fixer 回合只動 `.md` 不必重跑 suite，動 `skills/`、`agents/` 要跑全套 fast。
- `:506-511` build 內 fixer 規則與 verify `:124-128` 幾乎同文。
- docs-check 三層（`:554-568`）：moved 由 `docs-moved.js` 自動改；其他 gone/moved/past-end/orphan 一輪 fixer；誤報記 ruling。這是使用者 2026-10-02 自己定的規則（`docs/90-agent/todo/build-3.md:18`）—— 文件飄移由 fixer 一輪、不另派 reviewer，使用者已接受過。
- `skills/fankeel-build/rationale.md:248-256`：build 收尾加 docs-check 的原因就是 verify 曾因「a dead `TODO.md` link, then 35 moved line numbers」退回兩次。

**docs/90-agent 無人裁過此題。** `docs/90-agent/reference/subagents.md:730`（我抽查屬實）寫 verify 站派「a render reviewer, a verifier, a fixer and an implementer」；`judgements/2026-10-15-agent-effort-usage-render.md:76` 用量表「fixer | build:521, verify:121, audit:78」—— fixer 在 verify 實際上被派過 121 次；`judgements/2026-09-10-verifier-agent.md:75`「不改樹」只限 verifier 這個 agent；`reports/2026-10-09-workflow-review.md:58-62` 歷史上 298 個 task 退回 119 次；`reference/improvement-brief.md:1032` 目標是「把 verify 的檢查往 build 搬」；`plans/2026-11-01-todo-patrol.md:15`「verify 只暫時改它做 mutation，改完還原」。沒有任何 judgement 或 decision 說「verify 不得改檔」。

### 二、實際發生了什麼

**近三週 6 次回跳（task 交接檔 + `git log --numstat`，四個 commit 我親自覆核數字）：**

| task | 退回原因 | gate 給的選項 | 修改大小 | 小修？ |
|---|---|---|---|---|
| 20261031T165533 | 「盤點計畫」寫 15 個任務，實際 23（verify.md:1） | Back to Build (Recommended)／Stay／Go to Audit／暫停（verify.md:28） | 87b721d4：3 檔 +4/-4（design.md、seven-stages.html、plans/…） | 是，純文件 8 行；但 3 檔，fixer 一次會拒 |
| 20261031T152138 | what-runs.md:49 舊說法 + hooks/pane.ts:622 註解（verify.md:12） | Go to Land／Back to Build (Recommended)／暫停（verify.md:27） | 078d096b：2 檔 +3/-3 | 是，6 行；其中一處是程式註解 |
| 20261030T183210 | scripts/weekly.js:233 無正向測試（verify.md:1） | Back to Build (Recommended)（verify.md:30） | cdbc7bfd：1 檔 +29（測試） | 否，要補測試 |
| 20261030T071915 第 1 輪 | 測試強度缺口 + station.md 說法（verify.md） | Back to Build | 多個 commit，數百行 | 否 |
| 20261030T071915 第 2 輪 | station.md:96、reference/station.md:190 與程式不符、過長句（verify-2.md:39） | Back to Build (Recommended)／Go to Audit | 41cb8194 等 4 個 commit，約 9 檔 +17/-15，全文件（含 skills/fankeel-build/SKILL.md） | 文件為主但分 4 個 commit |
| 20261030T071915 第 3 輪 | reference/station.md:1016-1017 錯句 + 缺 5 卡測試（verify-3.md:16） | Back to Build (Recommended)（verify-3.md:29） | 764ada57 2 檔 +7/-2、122e30d0 +36 測試、d90000e0 +1/-1 | 文件半邊小、測試半邊不小 |
| 20261031T192645 | seven-stages SVG 窄版字 6-7px、.gate.zero 對比、圖例文字（verify.md:9） | Back to Build (Recommended)／Go to Land | 91984952：1 檔 +4/-4 | 是，8 行；但屬排版（render），不是錯句 |

**sessions json（10-11 起約 65 個 session 有 verify>build，推算值）**：理由只存在 gate 的 `gates[].descriptions`。純小修類：`546aef3d…json:745`「station.md 有三處行號引用錯了（886、1016、759），要由 build 修並審查」、`4c96ec5b…json:792`「enforcement.md:26 …要跳脫成 `\|`」、`c7256bd4…json:892`「改 render.js 第 25 行起的註解（目前字面上說反了）」、`94d22511…json:668` 行號衝突；真正有範圍的：`24cb0bb1…json:825` 手機頁加入口並補測試、`94e42e71…json:984` 改 launched() 加兩個測試。`5b773eed…json:505`（我抽查屬實）「修兩處小項…各有自己的 review 範圍，再回 verify」。

**逐字稿（只有 6ff5bdb2、33a02218 兩個 session 本機有 .jsonl）**：
- 33a02218 第二次回跳 gate：「這是改文字的小修，要走 build 的 commit 與 reviewer，之後再回 verify」—— 我在 `.fankeel/build/task-20261030T071915/verify-2-answer.md:13` 核到原句（讀取者引的是 conversation.js 的行號，sessions/*.json 內 grep 不到，但交接檔有）。verify 階段逐字稿零次提到 fixer；gate 問了兩次（第一次太長被退）；移動 verify 16:20 → build 16:34 → verify 16:58，約 10 輪、一次新的 brain 派遣、high reviewer 找四點、fast suite 6093 測試——為了一次文字修正。
- 6ff5bdb2：verify 21:16 → build 21:43 → verify 21:59，11 輪、brain 重派、reviewer clean、fast suite 6089——為了 29 行的一個測試（這一件本來就該回 build）。
- `task-20261031T152138/verify.md:12`（我抽查屬實）直接寫「依規則回 build 修，verify 不動檔」：session 是照「規則」走的，而它讀到的規則是 :326-332 與 stages.js:334，不是 :124-128。

### 三、結論與界線

1. **阻止就地修的不是 hook、不是 guard、不是 task.js**，是三處文字：`skills/fankeel-verify/SKILL.md:326-332`（「so does every fix… a page found false → build」）、`:37`、`lib/stages.js:334`（「never verify's」）。它們把 `:124-128` 已開的門又關上了，而站 agent 的 brief 只拿到 :334 這條（`render.js:679`），沒拿到 :124-128。
2. **B 成立，但不是「session 沒照做」那麼簡單**：是規則兩頭講、session 挑嚴的。C 不成立：`:309-311` 明禁自動回跳、`:330-332` 記錄 09-06 無審查 fix 事故、brain.md:12-13 要 controller 問使用者；而且被排除的三件（補測試）本來就該回 build。A 是現狀，代價已量到（三次純文件小修各付約 10 輪與一次 6000+ 測試）。
3. **小修界線（建議）**：verify 就地派 fankeel-fixer 只限 (a) 文件頁（docs/、README）的錯句、死路徑、過時行號——不含 `skills/`、`agents/`（build SKILL.md:549-551 規定動這些要跑全套）、不含程式（連註解，152138 的 pane.ts:622 那種仍回 build）、不含排版/render（192645 那種要 render-reviewer 重拍）；(b) 一次 ≤2 檔（fixer.md:34-36），超過就回 build；(c) 不需測試；(d) 改完 verify 自己重跑 docs-check 綠作為證據，並寫進報告與 gate 的 next。三件小修裡 152138、165533 半符合（一個含程式註解、一個 3 檔），要靠界線擋住，不是放寬。
4. **一個現行文字沒講的洞：誰 commit。** `:124-128` 讓 fixer 改檔，`:327` 又說「This stage commits nothing」，brain 不能 git（brain.md:184-187）。要在實作 B 時定下：要麼 controller 在 verify 下一個純文件 `Fix:` commit（鏡射 build 的 docs-check 第二層：fixer 一輪、無另派 reviewer，使用者 10-02 已接受），要麼讓改動未 commit 地帶進 land —— 後者要讀 land skill 才知道能不能收，本 brief 未涵蓋。我傾向前者，因為界線已縮到純文件且 docs-check 是機械檢查。

### 四、要改的檔案（B）

- `skills/fankeel-verify/SKILL.md:326-332` —— 從「routed to build」清單拿掉「a page found false」或加「except the fixer case at :124-128」；補上誰 commit。
- `skills/fankeel-verify/SKILL.md:124-128` —— 加上第三節的四條界線與紀錄方式。
- `skills/fankeel-verify/SKILL.md:349-350` 輸出模板 —— 加一行 `fixed here: <page:line>, docs-check: <結果>`，讓 gate 看得到就地修。
- `lib/stages.js:334` —— 站規改成「a fix is build's commit… except a false docs page (≤2 files, no test) sent to fankeel-fixer here with docs-check re-run」。
- `lib/render.js:660` —— brain 的 verify 附註「You cannot edit… send fankeel-mutator」旁加「a false page: send fankeel-fixer」。
- `agents/fankeel-brain.md:126-129`、`:191-194` —— 若採「verify 下 commit」，verify 站也要像 build 一樣允許寫 commit 檔供 controller 提交。
- `hooks/guard.js`、`scripts/task.js` —— 不必動。

### 五、沒查到／沒能查的

- `measure-sessions.js:6` DIR 寫死 `C:/Users/Owner/...`，本機跑不起來；它只數 backward pair，不給理由。
- 85216cfe、5b773eed 兩個最新回跳 session 本機無 .jsonl 逐字稿，只讀到 gate；commit 與回跳的對應靠時間與 subject，不是交接檔明記。
- `~65` 個回跳 session 只細看了 9 個 gate；10-11 之前未掃。
- land skill 如何處理 verify 留下的未 commit 改動未讀（不在 brief）。

context.md 已加兩筆（F:/ymlab/fankeel/.fankeel/build/task-20261031T213610/context.md）：verify skill :124 的允許與 :326/stages.js:334 的矛盾；三次純文件回跳的 commit 大小與每次成本。
