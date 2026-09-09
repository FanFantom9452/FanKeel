---
status: current
last_verified: 2026-09-09
source_of_truth: lib/profile.js, scripts/judge.js, agents/fankeel-reader.md, agents/fankeel-judge.md, lib/stages.js, lib/render.js
---

# 少問已知的答案：profile、一次性判斷、結構唯讀的讀者

一個 ask，四個問題：design 要不要 mockup 步驟、station 能不能先設定偏好、
會問人的階段內問題能不能先交給一個 Fable 一次性 agent 並留下可追溯的文件、
唯讀讀者為什麼還會去改檔。落地在 2026-09-09 的 `profile-judge-reader` 分支，
spec 與十個 task 的 plan 在 `docs/archive/`。

> **補記（2026-09-10）**：判官的觸發方式在隔天被推翻——四個 stage 的條件規則與
> `judge.enabled` 都刪了，改成使用者自己叫的 `/fankeel-ask`。下面「條件規則」與
> `fankeel-judge` 兩條裡關於「什麼時候會被叫到」的部分，讀作那天的記錄；今天的
> 答案在[廣告與工具的差別](2026-09-10-judge-to-ask.md)。其餘照舊。

## 決定了什麼

- **profile 兩層檔、三層生效值。** `<project>/.fankeel/profile.json` 進版本控制、
  `<configDir>/fankeel/profile.json` 是機器預設，逐鍵合併，專案 > 機器 > 內建，
  每個值記得自己來自哪一層（`lib/profile.js`）。七個鍵：`land.integration`、
  `land.push`、`land.archivePlan`、`guard`、`dispatch.floor`、`judge.enabled`、
  `judge.model`。`task.js profile show|set|suggest` 是唯一的寫入口。
- **答過的問題不再問。** land 的 menu 規則讀 `{{PROFILE_LAND}}`：有答案就照做、
  一行說明；archive plan 的規則依 `land.archivePlan` 二選一注入；`start` 把
  非內建的 `guard` 寫進 entry。這不繞過不變量 6——profile 是使用者寫下的常設
  指示，`start` 是在執行它。
- **條件規則。** `lib/stages.js` 的規則可帶 `when: '<key>'`（前綴 `!` 取反），
  `rulesFor` 依生效值過濾。今天只有 judge 那條用它，掛在 survey／design／plan／
  build 四個 stage；design 的 mockup 規則之後接同一個機制。
- **`fankeel-judge` 一次性判斷。** plugin 自帶的 agent，`model: fable`，工具只有
  Read／Grep／Glob／Bash，回四個欄位（pick／why／would flip if／unread），
  不追問、不寫檔。`scripts/judge.js record` 把 brief 與答案逐字寫進
  `docs/judgements/`（role `report`，新 bucket），並在 `docs/README.md` 的
  Judgements 表加一列。它只接**階段內**的澄清與選擇，stage gate 永遠不交給它。
- **`fankeel-reader` 結構唯讀。** 同一組工具清單讓 Edit／Write／NotebookEdit
  無法呼叫，不靠散文。survey／verify／audit 的讀者一律 `subagent_type:
  fankeel-reader`，model 讀 `dispatch.floor`。MCP 不做：它只加新工具，減不掉
  subagent 既有的 Edit／Write。
- **station 是設定面。** Overview 每個 registry 的卡後面一張專案 profile 卡、
  機器預設一張卡；serve 模式每列 `<select>` 加按鈕 POST `/profile`
  （403／400／404／409／303），靜態頁印可複製的 `task.js profile set` 指令。
- **`.fankeel/` 的壽命寫成一張表**（`docs/documents.md`）：docs.json 與
  profile.json 提交，sessions／map／build／index.html＋station 忽略；
  `docs/judgements/` 在 `.fankeel/` 之外、提交。

## 途中改掉的兩件事

- **每個 prompt 不帶 `profile:` 行。** spec 寫要，build gate 量到無 profile 的
  區塊離 2400 只剩 3–34 字，七鍵全設的一行 146 字，兩者無法並存；改成只有
  resume 區塊帶、`task.js profile show` 印值，cap 測試改成帶七鍵 profile 渲染。
- **profile 卡與快速套用鍵的位置。** spec 寫 detail 面板與機器卡；plan 的
  Task 8 把專案卡接進 registry 的卡、把快速套用鍵放在每張專案卡的標頭
  （`applyMachineControl` 只在 scope 為 `project` 時拼進去），機器卡只顯示。
  verify 與 audit 各抓到一次頁面沿用舊說法，修在 1fce98c 與 ec02303。

## 驗過什麼

- 新 process（`claude -p --plugin-dir`）派 `fankeel-judge`：在 claude-fable-5-1
  上跑完、回四個欄位；派 `fankeel-reader`：回報工具只有 Read／Grep／Glob／Bash、
  沒建檔。裸名與 `fankeel:fankeel-*` 都可解析。
- 十個 task 各一個 verifier 與 adversary（sonnet，Workflow）；程式碼沒有一列失敗，
  被打掉的全是證據方法。audit 讀了九個 pair，沒有兩頁在事實上相互矛盾。

## 留下的

- `dispatch.floor` 只有 skill 文字讀它，沒有程式碼強制（TODO：Needs a decision）。
- design 的 mockup 步驟另開任務（TODO：Ready）。
- 落到 `docs/judgements/` 的第一筆真實判斷還沒有——這條路徑只在測試與探針裡走過。
