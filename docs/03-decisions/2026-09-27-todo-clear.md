---
status: decision
last_verified: 2026-09-27
---

# TODO 全清（09-27）：決策紀錄

一句話：這一輪走完七站。plan 和 design 站的規則改成讀 `docs.json` 的 plan 桶，不再寫死 `docs/plans/`；wizard 的 `auto` 選項補上 mockup 畫過的外開圖示；fankeel 第一次深度巡檢跑完並記錄，修掉四個發現。Trovara 的 docs 搬移照使用者的話延後，等他在另一台電腦測。

design 見 [../99-archive/2026-09-27-todo-clear-design.md](../99-archive/2026-09-27-todo-clear-design.md)，計畫見 [../99-archive/2026-09-27-todo-clear.md](../99-archive/2026-09-27-todo-clear.md)。

## 定了什麼

- plan 路徑是 render 時算的，不是寫在規則裡：`lib/render.js` 的 `planDir()` 讀 `role: plan` 的桶，沒宣告時退回 `docs/plans`，由 `{{PLAN_DIR}}` 帶進規則。template 不做替換，所以 template 裡只寫 `<plan path>`。
- 深度巡檢放在這個 task 的 `audit` 站跑，不寫成 build 的 task。47 組對讀、121 頁分四批、三個 code 視角、一個 adversary。
- adversary 擊倒唯一的刪減提案：四份 `git()` 包裝的 maxBuffer 和回傳形狀都不同，合併不是單純去重。
- 決策紀錄被推翻時不加 `superseded_by`，在被推翻的句子後面加括號註記（`docs/90-agent/reference/documents.md` 的規矩）；09-04 station 設計的「不常駐 server」照這樣處理。

## 量到什麼

- `npm test` 2063 過、0 失敗；`docs-check`、`todo-check`、`skills-check` exit 0。
- adversary 的對照：在 `station.md` 和 `pipeline.md` 各查 5 個現在式的斷言，10 個都成立。

## 在哪裡回頭

- build 站 agent 重派 implementer 失敗時，留下一個沒有 brief 的 `general-purpose` agent，它自己 commit 了兩個 task，又自作主張改了 23 個 Waiting 戳記（`f603b590`）。內容對，但越過了 controller 的 `commit.js`。使用者核可保留。
- build 第一次送 commit 時整套測試有 4 個紅（export 沒人用、registry 沒重生、斷言舊字、沒用 `tests/tmp.js`），controller 先跑整套才擋下來。
- build 的 review 沒抓到 `subagents.md` 四行還寫 `docs/plans/`，是深度巡檢找到的。
- 巡檢時交給 reader 的 pair 清單，共用檔那一欄是空的（腳本取錯欄位）；reader 自行推出共用檔，一位改用 `sweep()` 重算。shrink 視角只抽樣，沒讀 `task.js`、`ledger.js`、`station.js` 等六個大檔。
