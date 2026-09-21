---
status: archived
last_verified: 2026-09-21
---

# 受控站推到 build／verify：先發版、再量、首頁快速設定

這頁描述要做成的樣子，不是現在的樣子。它接在
[2026-09-19-stage-agents-design.md](../plans/2026-09-19-stage-agents-design.md) 後面，只處理那頁「未決」
留下的第二條：build／verify 也交給站 agent，並且量主控 context 到底有沒有回收。

**主控用 Sonnet 是前提，不是變數。** 品質由站 agent（Opus）負責，主控只轉路徑、問關卡，所以
這個任務量的是 context，不是品質。

## 現況（survey 讀過的，附行）

- 主控那半邊對 build／verify 已通用：survey 讀到時 `controlRules` 不含站名（§5 之後多了 build 專屬的一條），
  `tests/stages.test.js:874` 已斷言 build 受控。
- brain 那半邊沒有：`lib/render.js:412` 只點名 `fankeel-reader` 與 `fankeel-reviewer`。
- 裝機版比倉庫舊：`lib/` 有五個檔不同，裝機的 `lib/stages.js:598` 仍是
  `CONTROLLED = ['survey']`，所以 `stage.agents` 的陣列對正在跑的 hook 不生效。
- 量測沒有工具：`docs/reports/2026-09-20-survey-brain-ab.md:9` 量到的是主控 context 在有派工的
  組反而變大；7.0%／63.9% 是錢的佔比，不是 context 的佔比。
- 首頁 profile 卡已能設定（`POST /profile`），缺說明；而且現值 `survey,build,verify`
  原樣送出會 400，因為 `scripts/station.js:541` 用 `spec.values.includes()` 驗，
  `stage.agents` 的 `values` 只有 `false, true, all`。

## 1. 先發版，hook 才跟得上程式

- 發布的是**已經在 `main` 上的東西**（自上一個 `chore:` 之後 159 個 commit），不是這個任務的成果；
  這個任務自己的成果照 `docs/development.md` 的規矩，是它最後一件事。
- 照 `docs/development.md` 的八步：先跑全部檢查為 0，`version.js --changes` 列出內容，
  **版號由使用者定**，再 `node scripts/version.js <x.y.z>`，commit `chore: <x.y.z> — …`，`npm test`。
- push 另外問。現況：裝機版標的 `a6a3da7` 是本地 merge、不在 origin 上，所以先前有一條本地安裝路，
  本頁沒有查出它是什麼；不擅自 push，也不擅自改 marketplace 設定。
- 完成的判準：`diff -rq <裝機版>/lib lib` 為空，而且新開的 terminal 裡 `controlling('build', …)` 為真。

## 2. brain 半邊：每站可派的 agent 是一張表

- `lib/stages.js` 加一張 `STAGE_AGENTS`：survey → reader、reviewer；build → reader、reviewer、fixer，
  外加帶 model 的 implementer；verify → reader、reviewer、verifier、fixer（§5 之後 verify 也有 implementer）。
- `renderBrainBrief` 讀這張表，不再寫死兩個名字；`controlRules` 不動（§5 之後 build 的 `controlRules` 多一條提交規則）。
- build 的組在 brain 裡用 Agent 分回合派（一回合最多四個），**不開 Workflow**。
  因此這個任務**不做**「由 script 從 plan 產生 workflow」：主控 context 的回收來自站 agent 吞掉中間過程，
  與 Workflow 無關；那條 TODO 留著，等量測顯示 brain 自己的 context 撐不住再做。

## 3. 量測：一支腳本，不是一份報告

- `scripts/ctx.js <transcript|session-id>` 印主 session 每回合的 context（input＋cache read＋cache
  creation，同一個 requestId 只算一次）、峰值、每個關卡當下的值、與各 subagent 的 token 合計。
- `scripts/ctx.js --compare <a> <b>` 並排兩個 session。
- 實跑 A/B 是 bypassPermissions 的腳本，**build 站不自己跑**，跑之前停下來問。

## 4. 首頁 profile 卡

- `lib/profile.js` 的 `KEYS[key]` 加 `desc`（一句話）；`profile show` 與站上都印它，`lib/station.js`
  的 `serialize` 也要帶出（`gather` 與 `serialize` 是兩個 builder，頁面讀的是後者）。
- `POST /profile` 改用 `profile.parseValue` 驗；預設「手動」要把鍵清回 (ask)，所以新增 `profile.unset`，不做逐列的清除按鈕。
- 三個習慣預設（手動／平衡／省 context），一次 POST 全套用，先驗全部再寫（現有行為）。
  - 手動：所有 `land.*` 與 `class.default` 清成 (ask)，`stage.agents` = false，`guard` = ask。
  - 平衡：`land.integration` = merge、`land.push` = false、`land.archivePlan` = true、`guard` = ask、`stage.agents` = survey，`class.default` 不動。
  - 省 context：平衡，再把 `stage.agents` 設成 survey,build,verify。
- 預設寫進**這張卡自己的那一層**：專案卡寫 `.fankeel/profile.json`，machine 卡寫機器層。專案層蓋過機器層（`lib/profile.js` 的 `read`），所以在 machine 卡套「手動」不會改變已經有專案值的專案；專案卡上「清成 (ask)」是把那個鍵從專案檔拿掉，值落回機器層或 builtin。mockup 把兩層畫成一張 machine 卡、又顯示 project 來源，這一點以本條為準。
- `stage.agents` 維持 `<select>`，現值不在三個固定值時當額外選項（現有行為）；送出改由 `parseValue` 驗，所以不再 400。七站 toggle 不做。
- `profile show` 的表格欄寬跟著最長的值，不再把 `survey,build,verify` 與來源層黏在一起。
- 畫面只取 mockup 上方的「快速設定」三張卡與「套用」；mockup 在 .fankeel/build/2026-09-21-controlled-stations/mockup.html，不提交（那個目錄在 gitignore 下）。下方的逐列設計不做，見「不做的」。

## 5. 受控 build 的提交與 verify 的 mutation（build 收尾時使用者定的）

build 的整支分支 review 找到：brain 被禁 `git commit`、`git add`、`git checkout`，而 controller 只派工與發問，所以受控的 build 沒人能提交，受控的 verify 沒人能套 mutation。使用者在 build 關卡選了「controller 依回傳提交」。

- 受控的 build 由 controller 提交：brain 寫一個 commit 檔（每行一個路徑、一個空行、訊息）並回傳 `commit <檔>`，controller 跑 `scripts/commit.js <檔>`，再用 SendMessage 把它印出的 `<base>..<sha>` 原樣回給 brain，那就是該 task 的 reviewer 釘住的範圍；失敗時是一行 `commit.js: <原因>`，brain 依原因修檔重來（同一個錯誤兩次就停站），或直接停站。
- `scripts/commit.js` 只提交檔內列的路徑（`git commit -o`），其餘已暫存或未提交的留在原處；無空行、無訊息、或 git 拒絕的路徑（repo 外、不存在、像旗標），都回 1 且不動 HEAD。
- controller 每個 task 因此多一次 Bash 與一次 SendMessage，會吃掉一部分 context 回收；另外兩個做法是 brain 依 brief 提交、build／verify 維持不受控，A/B 要把這個成本算進去。
- verify 的 brain 也不能編輯或還原檔案，所以 `STAGE_AGENTS` 的 verify 多一個 implementer，專門套 mutation、跑測試、還原。

## 檔案與派工

| file | change | dispatch |
|---|---|---|
| scripts/version.js（跑它，不改它） | 使用者定版號後設十三處 | in-session — 一個指令，且版號是使用者的話 |
| lib/stages.js、lib/render.js | `STAGE_AGENTS` 一張表，brain brief 讀它 | implementer, sonnet |
| scripts/ctx.js、tests/ctx.test.js | 新增：per-turn context 與 compare，附手算峰值的 fixture | implementer, sonnet |
| lib/profile.js、scripts/task.js | `desc`、`PRESETS`、`unset`；`profile show` 欄寬 | implementer, sonnet |
| scripts/station.js、lib/station.js | `POST /profile` 用 `parseValue`、清回 (ask)；`serialize` 帶 `desc` | implementer, sonnet |
| assets/station/station.js、assets/station/station.css | 卡上方加三張預設卡與一個「套用」，逐列只多一欄說明 | implementer, sonnet |
| tests/profile.test.js、tests/station-cli.test.js、tests/station-view.test.js | 先紅再綠的測試 | 隨各自的 implementer |
| docs/plans/2026-09-19-stage-agents-design.md | 「build 的 workflow 由 script 產生」那句改記為本頁取代 | in-session — 一行編輯 |

## 不做的

- 由 script 從 plan 產生 workflow：見第 2 節。
- 首頁整頁改成三欄的完整工作站、並把 profile 的逐列設計併進去：進 TODO，要先量現在首頁的版面，這一輪的 survey 只讀了 profile 卡。mockup 下方的逐列「將改為」標記、每列「清成 (ask)」、七站 toggle 與「套用後」狀態都屬於那一條。

## 完成的判準

- `POST /profile` 送 `stage.agents=survey,build,verify` 得 200；現在是 400（`tests/station-cli.test.js`）。
- 每個 `KEYS` 都有非空 `desc`；現在沒有（`tests/profile.test.js`）。
- **產出物那一列**：把站頁 render 出來，DOM 裡有說明的列數等於 `Object.keys(KEYS).length`，
  且每列顯示的值等於 `task.js profile show` 對同一個鍵印的值——同一個來源派生的兩個數字要一致。
- `scripts/ctx.js` 對一份手算過的 fixture，峰值等於手算值。

## 未驗證

- 裝機版怎麼在**不 push** 的前提下拿到新碼：沒有查出 `a6a3da7` 是怎麼裝進去的。發版那一步先問，不猜。
- 受控 build 的提交來回（brain → controller → brain）沒有端到端跑過，只有腳本與兩邊文字的測試；controller 每個 task 多兩個回合的成本待 A/B 量。
