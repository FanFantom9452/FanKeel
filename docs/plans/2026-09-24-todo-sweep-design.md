---
status: design-intent
---

# TODO 全清：Ready 五條 shrink ＋ Needs a decision 六條 — design

一句話：五條 shrink 各自收成一個共用函式，行為不變、整套測試前後都綠；六條決策照 2026-09-24 使用者在 design 關卡的六個答案落地，其中一條（共用詞彙）以決策關掉、不改碼。

依據：[survey 報告](../../.fankeel/build/task-20260923T194111/survey.md)（per-machine，未提交）。Waiting 不在範圍內。

## 1. profile 讀取

- `lib/profile.js` 新增並匯出 `profileFor(root, mine)`：`docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root` 加上 `read(projectRoot, mine.configDir || configDirOf())`，回傳 `read` 的結果。
- `hooks/gate.js`、`hooks/brief.js`、`hooks/resume.js`、`hooks/inject.js`、`hooks/guard.js` 五處改成呼叫 `profileFor`，各自的 try/catch 與失敗時的行為不動。
- survey 查到重複的其實只有兩行 wrapper，不是 TODO 原話說的整段讀取；函式就只收這兩行。

## 2. 原子寫入

- `lib/registry.js` 新增並匯出 `writeAtomic(file, contents)`：寫暫存檔，再 `renameRetrying`。`mkdirSync` 要不要做由呼叫端決定，因為 `scripts/station.js` 的第三處本來就不建目錄；實作時要先比對五處寫法，把這個差異保留下來。
- `lib/detail.js`、`lib/station.js`、`scripts/station.js`（三處）改成呼叫 `writeAtomic`。

## 3. parseArgs

- `scripts/layout.js` 與 `scripts/residue.js` 裡逐字相同的 `parseArgs` 收成一份（只收 `--root`），放在兩者都能 require 的地方，另一支改成引用它。

## 4. ledger 讀取

- `scripts/ledger.js` 的 `ranges` 與 `show` 共用的 ledgerPath＋讀檔＋`ledger.owns` 那段收成 `readOwnLedger(root, opts)`。

## 5. burnOf／clockOf

- `lib/registry.js` 新增 `forwardPair(pair)`，`burnOf` 與 `clockOf` 各自變成一行包裝。名字不能用 `spanOf`，`lib/usage.js` 已經有這個名字。
- 動手前先 grep 兩者所有的呼叫端（survey 標為 unknown）；匯出介面保持不變。

## 6. gate 題數

- `lib/handoff.js` 的 `gateProblem` 加一條檢查：`gate.questions.length` 不可以超過 4，超過時回 `{ at: 'questions', detail: ... }`，走現有的 deny 流程退回給站 agent。

## 7. 只換佔位題

- 佔位題的形狀定為：只有一題，`header` 等於目前的站名（不分大小寫）。
- `hooks/gate.js` 只在 `tool_input.questions` 是這個形狀時才替換；其他形狀的題原樣送出，並附一則 `systemMessage` 說明這次沒有替換（skipReason 加一種原因）。
- `lib/stages.js` 的 controller 規則（`controlFor`，目前寫「one placeholder question」）改成點名這個形狀：header 用站名。

## 8. brain 派工擋下

- 新增 PreToolUse 的 `Agent` matcher：`subagent_type` 去掉 `fankeel:` 前綴後是 `fankeel-brain`，而且目前這一站 `controlling(stage, values)` 為 false 時，回 deny，理由寫明這一站不在 `stage.agents` 裡、應該在 session 內直接做。
- 放在哪支 hook 由 plan 決定，選既有的一支，不另開新檔；manifest 加上這條 matcher。這條 hook 要等新開的 process 才會生效。

## 9. commit 攢批

- `agents/fankeel-brain.md` 與 `lib/render.js` 的 build brief：「每個 task 交一次，或整批交一次」改成硬規定，以 `ledger.js groups` 的一組為單位，整組做完才用 `---` 把各 task 串起來交一次 `commit <path>`。`scripts/commit.js` 不改。

## 10. 共用詞彙：關掉

- 不改碼。每次 prompt 只注入當前那一站的規則加上 `ALWAYS`，跨站重複的名詞在執行時不會重複付費，TODO 的前提不成立。原因寫進第 11 節的決策紀錄，再把 TODO 裡這一條刪掉。

## 11. method：從自己的問題出發

- 新增 `docs/decisions/2026-09-24-optimise-own-first.md`：對照外部 repo 時，從 fankeel 自己的問題出發，對方的做法只作參考，不問「收哪幾條」。第 10 節那條關掉的理由也記在這裡。
- `CONTRIBUTING.md` 加一行，指向這份紀錄。
- `docs/decisions/2026-09-24-skill-repos.md` 與 `docs/reports/2026-09-24-ponytail-remainder.md` 裡還沒收的候選，逐條對到 fankeel 自己的問題（現有的 TODO 條目或已知事故）：對得上的寫成 TODO 條目，對不上的在決策紀錄裡寫「不問」和原因。這兩份原頁是 decision／report 角色，不修改。

## 12. 收尾

- `TODO.md` 移除這 11 條；第 11 節對上的候選照規則加成新條目。
- `docs/subagents.md` 描述 gate 的那一列補上題數上限、只換佔位題、brain 派工擋下三件事。
- `todo-check.js`、`docs-check.js` 與整套測試都綠。

## 怎麼算做完

- 第 1–5 節：整套測試在改動前後都綠，每條 shrink 的淨行數為負。
- 第 6 節：新測試用 5 題的 gate，改動前 `readGate` 會回傳 gate，改動後回 `invalid: 'questions'`。
- 第 7 節：新測試用 header 不等於站名的題，改動前會被替換，改動後原樣送出。
- 第 8 節：新測試在不受控的一站派 `fankeel-brain`，改動前會放行，改動後 deny。
- 產物：`TODO.md` 過 `todo-check.js`；Needs a decision 剩 0 條，Ready 只剩第 11 節新加的條目。

## 沒驗證

- `Agent` 工具的 PreToolUse matcher 名稱是 `Agent`，還是舊名 `Task`（或兩者都要寫）：要在 build 用一個新開的 process 實測。
