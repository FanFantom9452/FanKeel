---
judged: 2026-10-25T18:08:05.126Z
model: fable
agent: fankeel-judge
task: "Mermaid 渲染器（Ply／Beautiful Mermaid／官方）對比 Chartroom：框架該用哪個"
session: 084e9936-a15b-4a76-992e-6fb0b2e72c60
stage: build
---

# Brief 33 — 主訊息下那張勾選清單是 plan 嗎？stage 自己拆 plan 的事，我們控制得了嗎？

## Question

# Brief 33 — 主訊息下那張勾選清單是 plan 嗎？stage 自己拆 plan 的事，我們控制得了嗎？

## Question

使用者在 Claude Desktop 截圖，圈起主 session 回覆下方的勾選清單：
「問判官並歸檔 ✓ / survey 站跑完、過 gate ✓ / design：兩輪 mockup、開 gate.station、過 gate ✓ / build 站（站 agent）⟳ 1 running task / verify 站 ○ / land 站 ○」。
右側 fankeel 面板同時顯示 route 3/5 與 agents（Build sta… 底下有子 agent），notes 有 build 的 ruling。

他問：
1. 這張清單是 plan 嗎？是模型自己寫的嗎？
2. 之前不是說過 stage 自己拆 plan（build 有 ledger、分組）嗎？為什麼清單上 build 只有一格？
3. 還是這個我們沒辦法控制？

## 先前的判決（先讀，不要重做）

- `docs/90-agent/judgements/2026-10-16-desktop-task-list.md` — 清單是宿主（Desktop）畫的，主 session 用 `mcp__ccd_turn__update_plan` 填。
- `docs/90-agent/judgements/2026-10-25-host-task-list-stages.md` — pick A：不做；細部進度留在 fankeel 的 ledger／Pane／監控站；若要收斂，只在 `lib/stages.js` controlRules 加一句「清單以 route 站名或 plan `## Task N:` 標題填、每條 `commit.js:` 行 advance 一格」，不碰 brain。would flip：宿主會把子 agent 的 update_plan 畫在主訊息下。

這次要補的是**這一個實例**：本 task 是 `bounded`（route survey,design,build,verify,land，沒有 plan 站、沒有 plan 檔），build 站 agent 卻分了多組（主 session 已收到 5 次 `commit build-g1-commit.md`，ledger 有 group 1–6）。所以：

- build 的「組」從哪來——bounded 沒有 plan 時，brain 是照 design.md 的檔案表自己拆的嗎？那份拆法存在哪（ledger？`.fankeel/build/task-20261025T163643/` 下的檔）？
- 這個拆法有沒有在任何地方被使用者看見／核准？design gate 核准的是 design.md，不是分組。
- 主 session（controller）能不能、該不該把 ledger 的組同步進宿主清單（10-25 判決留的那一句 controlRules 有沒有做）？

## 事實（主 session 提供）

- 主 session 本 turn 的清單是自己用 `update_plan` 寫的六格，按 route 站名寫，build 一格；controller 規則只叫它「dispatch / relay a path / ask」，沒有叫它同步 ledger 組。
- 每次 build agent 回 `commit <file>`，主 session 跑 `scripts/commit.js`、SendMessage 回結果，清單不動。
- 子 agent 沒有 `update_plan`，它們的進度只在 fankeel 面板（agents 列）與監控站。

## Paths to read

- `lib/stages.js`（controlRules、build 規則，bounded 無 plan 時 build 怎麼取任務；找 10-25 判決那一句是否已落地）
- `skills/fankeel-build/SKILL.md`（design 檔案表當任務、ledger、groups）
- `scripts/ledger.js`（`groups` 指令）、`.fankeel/build/task-20261025T163643/`（實際 ledger／groups 檔）
- `hooks/wrap-up.js`、`scripts/escape-scan.js`（判決提到的 update_plan 唯一觸點）
- `.fankeel/build/task-20261025T163643/design.md`（被拆的來源）

## What counts as an answer

直接回答三問：(1) 清單是什麼、誰寫的；(2) build 的分組從哪來、存在哪、使用者在哪看得到；(3) 哪一部分我們控制得了（controller 規則可以要求同步清單）、哪一部分控制不了（宿主只畫主 session 的 update_plan）——並給一個 pick：維持現狀，或落地 10-25 判決那一句（給出要改的檔與一句規則），或別的。

## Shape

六個欄位（`pick:` 先），之後 `## Summary`，繁體中文。

## Answer

pick: 維持現狀（10-25 判決 A）——不落地那句 controlRules；清單是宿主畫、主 session 自填的六格，build 一格是對的，因為 bounded 無 plan 時 fankeel 根本沒有「組」可同步。
why: `lib/stages.js:705-726` controlRules 無 update_plan／清單字樣，10-25 那句未落地；主 session 的六格是它自己按 route 站名用 `update_plan` 填的，規則只叫它 dispatch／relay／ask（:706）。
bounded 無 plan ⇒ 無 ledger、無 groups：`skills/fankeel-build/SKILL.md:91-98`、`:164`；任務 = `design.md:12-21` 檔案表 8 列，逐列跑；task 目錄無 progress.md／groups／plan.md，grep `group` 零命中——「ledger 有 group 1–6」在 repo 找不到依據。
`build-g1-commit.md` 的 `-g1` 是檔名機制（`lib/handoff.js:100` 用 in-flight mark 的 group 取名），不是分組；5 個 commit 對 8 列不是一對一，「每條 commit.js: 行 advance 一格」會讓六格清單錯位衝過 build。
子 agent tools 白名單無任何 mcp 工具（`agents/fankeel-brain.md:4`），宿主只畫主 session 的 update_plan——這部分控制不了；細粒度已在 Pane／監控站 agents 列。
would flip if: 宿主會把子 agent 的 update_plan 畫在主訊息下；或 bounded 也把 design 檔案表 init 成 progress.md（有列級 ledger），那時「每列 complete advance 一格」才有一對一對應，值得在 COMMIT_RULE（`lib/stages.js:652`）後加一句。
unread: nothing（brief 列的路徑全由 reader 讀過；另補查 `agents/fankeel-brain.md`、`lib/handoff.js`、`scripts/await.js`、task 目錄 ls）
delegated: lib/stages.js（opus）；skills/fankeel-build/SKILL.md（sonnet）；scripts/ledger.js + .fankeel/build/task-20261025T163643/（sonnet）；hooks/wrap-up.js + scripts/escape-scan.js + 全 repo grep update_plan + agents/*.md tools（sonnet）；.fankeel/build/task-20261025T163643/design.md（sonnet）；docs/90-agent/judgements/2026-10-16-desktop-task-list.md + 2026-10-25-host-task-list-stages.md（sonnet）
checklist: 1 lib/stages.js controlRules／build 取任務 — answered；2 SKILL.md 無 plan 拆法與分組 — answered；3 ledger.js groups — answered；4 task 目錄 ledger／groups 檔 — answered（不存在）；5 wrap-up.js／escape-scan.js update_plan 觸點 — answered；6 design.md 檔案表 — answered；7 兩份先前判決 — answered；補：「group 1–6」出處 — 未能驗證（見 Summary）

## Summary

### 三問直答

**(1) 這張清單是什麼、誰寫的。**
是 Claude Desktop 宿主畫在主訊息下的任務清單，由主 session 自己用 `mcp__ccd_turn__update_plan` 填——這與 10-16 判決（`docs/90-agent/judgements/2026-10-16-desktop-task-list.md:62`）和 10-25 判決（`2026-10-25-host-task-list-stages.md:80`）相同。它不是 fankeel 的 plan：本 task 是 `bounded` route（`lib/stages.js:500-502`：「Design happens in chat: no spec or plan file — only a handoff」），沒有 plan 站、沒有 plan 檔。fankeel 沒有任何規則叫主 session 這樣填：`lib/stages.js:705-726` controlRules 零個 `update_plan`／清單字樣（reader A grep + 我抽查 :705-726 確認），全 repo 的 `update_plan` 命中只有 `scripts/escape-scan.js:20`（掃描桶）、測試、與兩份判決／todo 文件（reader D；`hooks/wrap-up.js` 只鉤 `wrap_up`，:4）。所以六格「問判官／survey／design／build／verify／land」是主 session 把 route 站名抄進宿主清單——是模型自己寫的，但格式是宿主的。10-25 判決建議的那句「清單以 route 站名或 plan `## Task N:` 標題填、每條 commit.js: 行 advance 一格」（`:79`）**沒有落地**（controlRules 無此句；reader A 標 absent，我抽查 :705-726 同意）。

**(2) build 的「組」從哪來、存在哪、使用者在哪看得到。**
- 規則面：`skills/fankeel-build/SKILL.md:91-94`「With no plan file there is no ledger and nothing to `init`. The rows of `design`'s file table are the tasks instead」；`:96-98`「The rows run in order, one at a time. Nothing groups them: `groups` reads only `## Task` headings, never a file table」；`:164`「Where there is no plan there are no groups.」`scripts/ledger.js:220-226` 的 `groupsReport` 讀的是 plan 檔，沒有就 `fail('No plan at ...')`（抽查成立）。
- 實物面：`.fankeel/build/task-20261025T163643/` 只有 `build-g1-commit.done.md`、`build.md.await`、`context.md`、`design.md`、`review-1..5.txt`、`suite.json/tap`、`survey*.md`——**沒有** progress.md、groups 檔、plan.md；目錄內 grep `group` 零命中；`.fankeel/**/*.json` 也沒有這個 task id。所以「ledger 有 group 1–6」這個主 session 提供的事實，在 repo 裡找不到載體；最接近的對應是 `review-1.txt`…`review-5.txt` 五份審查與 git log 五個 commit（43a355de→2be12555），即「五個 pass、每 pass 一到數列」。我無法確認主 session 看到的「1–6」是面板 agents 列（implementer/reviewer 子 agent 數）還是別的；這是本判決未能驗證的一點。
- 拆法的來源就是 `design.md:12-21` 的檔案表：8 列、欄位只有 `file | change | dispatch`，每列 `implementer, sonnet`，沒有順序／分組欄（reader E；我抽查 :11-21 成立）。brain 逐列跑，拆法 = 表的列序；沒有另一份「分組文件」。
- `build-g1-commit.md` 的 `-g1`：`lib/handoff.js:87-91,100` 的 `fileFor(..., '-commit.md', lap, group)` 以 in-flight mark 的 group 取名；`agents/fankeel-brain.md:202-205` 說 commit 路徑「named in your brief」。它是檔名機制，不代表 brain 把檔案表拆成「第 1 組」；同一個名字被用了 5 次就是「每次 commit 都是同一個 mark 的檔」。至於這個 mark 為何帶 group=1（await 檔卻是無 -g 的 `build.md.await`），我沒追到 hooks/brief.js——標為未查。
- 使用者在哪看得到／核准：**沒有**。design gate 核准的是 design.md 整份（`design.md:7` 兩次修正、`:35` gate.station=300），檔案表是其中一節，所以「拆法」其實已隨 design.md 被看過；但「哪幾列併成一個 commit」是 brain 跑時決定、只在 commit 訊息（`build-g1-commit.done.md:1-5` 列出三個路徑）和 Pane／監控站 agents 列出現，沒有 gate。SKILL.md `:45-47` 只有站末一個 gate；group brain「returns with no gate」。

**(3) 哪部分控制得了、哪部分控制不了。**
- 控制得了：主 session 的 `update_plan` 內容。controlRules 是我們的字，可以加一句要它用什麼填、何時 advance；controller 唯一的醒來點是 `commit <file>` → `COMMIT_RULE`（`lib/stages.js:652`：跑 commit.js、SendMessage 結果、「No gate; wait」）。
- 控制不了：子 agent 的進度畫不進那張清單。`agents/fankeel-brain.md:4` 與所有 agent 的 `tools:` 都是內建工具白名單、沒有 `mcp__ccd_turn__*`（reader D；10-25 判決 `:82`、`:137` 同樣說宿主會不會畫子 agent 的呼叫在 repo 側無法驗證）。
- 為什麼這次仍選「不落地」：那句的 advance 條件是「每條 commit.js: 行一格」。本例清單是六個站名，五個 commit 若各 advance 一格會把清單衝過 build 到 land；若改成以檔案表 8 列填 items，commit 又不是一列一個（第一個 commit 就涵蓋 vendor + diagram.js 兩列），仍對不上。bounded 無 ledger，controller 沒有「第 n 列 complete」的訊號可對齊。2400 字上限（`lib/stages.js:683-684` 註解）也要拿別的字去換。結論：build 一格、旁邊 `⟳ 1 running task` 其實是宿主清單在無 plan 時能給的最誠實粒度；細節走 Pane／監控站（10-25 判決 `:130`）。

### 抽查結果
- `lib/stages.js:652,678,705-726`：COMMIT_RULE、BUILD_GROUP_RULE、controlRules 內容與 reader A 所述一致；無 update_plan。
- `skills/fankeel-build/SKILL.md:91-98,164`：原文與 reader B 引述一致。
- `scripts/ledger.js:217-228`：groupsReport 讀 plan、無 plan 即 fail——一致。
- `scripts/escape-scan.js:20`：TOOLS 含 update_plan——一致。
- `design.md:12-21`：8 列、三欄、無分組——一致。
- `2026-10-25-host-task-list-stages.md:79-84`：pick／would-flip 原文——一致。
- 補查 `agents/fankeel-brain.md:200-211`、`lib/handoff.js:78-100`、`scripts/await.js:284-293`、task 目錄 `ls -la`、`git log`：確認 `-g<N>` 命名機制與五個 commit。

### 若日後要收斂（不是本次 pick）
最小改法在 `lib/stages.js:652` COMMIT_RULE 尾端加一句，例如「`; update_plan: mark this stage's item running, never advance past it`」——只保證 build 格顯示進行中、不錯位；真正的列級進度要等 bounded 也有 progress.md（design 檔案表 init 成 ledger）才有一對一的 advance 依據。

### 未做
依派工訊息「read only, touch nothing」，我沒有執行 `context.js add`；下列事實若 verify／land 需要，請主 session 自行記：bounded 無 plan ⇒ 任務 = design.md 檔案表 8 列、無 ledger／groups（`skills/fankeel-build/SKILL.md:91`）。
