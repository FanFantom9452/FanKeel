---
status: decision
last_verified: 2026-09-21
---

# 受控站推到 build 與 verify — 決策紀錄

[2026-09-20-survey-brain.md](2026-09-20-survey-brain.md) 只做了 survey。這一輪把 build 與 verify 也接上 stage agent
的路，先讓 hooks 與程式同步、補上量 context 的工具，並把首頁 profile 卡改成能一鍵套用的快速設定。工作直接在 `main`
上做（使用者同意），路線七站全走、verify 走了兩圈，計畫提交之後到收尾前共 30 個 commit。
設計見 [../archive/2026-09-21-controlled-stations-design.md](../archive/2026-09-21-controlled-stations-design.md)，
計畫見 [../archive/2026-09-21-controlled-stations.md](../archive/2026-09-21-controlled-stations.md)。
**主控用 Sonnet 是前提，品質由 stage agent（Opus）負責**，所以這個任務量的是 context，不是品質。

## 一、定案

| 問題 | 定案 | 為什麼 |
|---|---|---|
| 先發版還是先寫 | 先發 0.75.0，內容是 `main` 上已有的 commit，不是這個任務的成果；不 push | hooks 一個 process 只讀一次清單，裝機版是舊的，`stage.agents` 的陣列對正在跑的 hook 不生效；版號由使用者定 |
| brain 能派哪些 agent | `lib/stages.js` 的 `STAGE_AGENTS` 一張表，`renderBrainBrief` 讀它：survey 派 reader、reviewer；build 加 fixer 與 implementer；verify 加 verifier、fixer 與一個做 mutation 的 implementer | 主控那半邊早就通用，缺的是 brain 那半邊只寫死兩個名字；build 用 Agent 分回合派，不開 Workflow |
| 怎麼量 context 回收 | `scripts/ctx.js`：每回合 context（input＋cache read＋cache creation，同一個 requestId 只算一次）、峰值、每個關卡當下的值、各 subagent 的 token 合計，`--compare` 並排兩個 session | 上一輪只有一支寫死五個 session id 的腳本；報告裡的百分比是錢的佔比，不是 context 的佔比 |
| 首頁 profile 卡 | 每個鍵一句 `desc`；三個習慣預設（手動／平衡／省 context）一次 POST 全套用，寫進這張卡自己的那一層；空值把鍵從那一層清掉（`profile.unset`）；`POST /profile` 改由 `parseValue` 驗，所以 `survey,build,verify` 不再被 400 | 現值原樣送出原本會 400；預設「手動」要把鍵清回 (ask)，不做逐列清除鈕 |
| 受控 build 誰提交 | **controller 依 brain 的回傳提交**：brain 寫 commit 檔（路徑、空行、訊息）並回傳 `commit <檔>`，controller 跑 `scripts/commit.js "<檔>"`，把它印出的 `<base>..<sha>` 原樣回給 brain | brain 被禁 `git commit`／`add`／`checkout`，controller 只派工，沒人能提交。使用者在 build 關卡從三個做法裡選了這個（另兩個：brain 依 brief 提交、build 與 verify 維持不受控），這是我當時不建議的那個，代價是 controller 每個 task 多一次 Bash 與一次 SendMessage，會吃掉一部分回收，A/B 要把它算進去 |
| verify 的 mutation 誰做 | 一個 implementer（模型用 `dispatch.floor`）套 mutation、跑測試、還原 | brain 沒有 Edit、也不能 `git checkout` |
| 進入受控站時 controller 拿到什麼 | `task.js stage` 現在也印 controller 區塊（`start` 與 `task` 本來就印），`stage` 與 `task` 都從記錄裡的 project 與 configDir 讀 profile，跟 hooks 一樣 | 接縫審查找到：只有 `start` 與 `task` 印，所以 controller 用選項一進 build 時手上還是上一站的規則，看不到提交的接力規則 |
| build 裡 `in-session` 的 task | 交給 `dispatch.floor` 的 implementer | brain 沒有 Edit、controller 被擋，沒人能做 |

## 二、沒做的，以及為什麼

- **裝機版沒有換。** `installed_plugins.json` 釘在 0.74.0 的 `a6a3da7`，那個 commit 不在 origin 上，而 push 被使用者拒絕；所以
  「裝機版 `lib/` 等於倉庫、新 terminal 裡 `controlling('build', …)` 為真」這條判準**沒達成**。`stage.agents` 名 build 或
  verify，在重裝並開新 terminal 之前，對執行中的 hooks 沒有效果。這個任務自己就是在舊 hooks 下跑的，所以 build 與 verify
  在這個 session 裡都不是受控的。
- **brain → controller → brain 的提交來回沒有實跑過**，A/B 也沒有（那是 bypassPermissions 的腳本，停下來問）。只有 `commit.js` 本身
  在含空格路徑的 repo、Git Bash 與 PowerShell 都跑通，以及兩端文字各有測試。
- 「受控 build 與 verify 沒跑過的地方」一節記在 [../subagents.md](../subagents.md)：stage agent 沒有 `AskUserQuestion`、`Edit`、
  `SendMessage`；插話會起第二個 brain；profile 在站執行中被預設卡改掉；gate 檔沒有新鮮度；replay 看不到 `commit.js` 的提交；
  worktree 不處理。brain 不自己提交只靠 prose，沒有 hook 擋。
- 預設卡都寫 `guard: ask`，套在 `guard: deny` 的專案上會把它降下來（卡片上寫明了）。
- 設計頁寫 `POST /profile` 成功得 200，程式與測試是 303。

## 三、量到的

沒有量到受控 build 或 verify 的 context（原因見上）。能當基準的是這個 session 自己：舊 hooks、三站都在主控裡做，
`scripts/ctx.js` 在 2026-09-21 20:47 讀到 349 回合、峰值 631,471（第 349 回合）、49 個 subagent、65,924,255 個 token
（那之後 session 又跑了 verify 第二圈、audit 與 land，沒有再量）。這是**沒受控**的
七站 architectural 任務在 Sonnet 主控上的樣子；受控之後要拿同一支腳本、同一種任務對比。

## 四、怎麼審的（給下一個想省 context 的人）

每個 task 與每個 fix 各一個 reviewer；整支分支審兩次，之後多一次專找「為只有 survey 受控而寫的程式」的接縫審查——
前面每一輪只看 diff，接縫審查才找到上面第六條。verify 走了兩圈（第一圈八個 verifier 加一個 adversary，找到五處測試「改了仍綠」，
第二圈驗它們的 fix），audit 的 26 條既有漂移經 adversary 攻過一遍後一句一句更正。全套 1735 個測試。
