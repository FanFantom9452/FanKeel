---
status: current
---

# todo-check 驗行號，與 Sonnet 主控倍數的一次實測

兩件互不相依的事，同一個 task。TODO `## Ready` 另外兩條的處置見 §3。

## 1. todo-check 驗 `path:line`

- `scripts/docs-check.js` 匯出 `lineCount`（`PATHISH` 已經匯出），todo-check 直接用，不另寫一份行數計算。
- `scripts/todo-check.js` 讀每條 bullet 裡的兩種位置：反引號包住、符合 `PATHISH` 的 span，以及 markdown 連結的 target。行號（`:N` 或 `:N-M`）超過 `lineCount` 時報 `past end`，exit 1。
- 連結 target 帶 `:N` 時，先把 `:N` 拆掉再檢查檔案存不存在。今天整串被當成檔名，報的是 `dead link`，理由錯了。
- 不支援 `#L12`。docs-check 也不認這個寫法，TODO.md 現在也沒有人用；要支援是另一件事。
- `past end` 不看 role，所以放在整個連結迴圈之後，自成一個迴圈；同一條 bullet 的 `dead link` 與 `stale citation` 會先印。
- TODO.md 開頭「enforces all nine」的敘述跟著改成十條，並補上這一條在檢查什麼。

## 2. 倍數量測：一對，預算 $125

- 要填的格子：`docs/90-agent/reports/2026-09-21-long-task-projection.md` 的 `k`，也就是 Sonnet 主控在沒有站 agent 的那幾站，token 用量是 Opus 的幾倍（破平衡點 `k = 2.5052`）。
- harness 寫在 `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/ab.sh`，以 `docs/90-agent/reports/evidence/2026-09-20-survey-brain-ab/ab7.sh` 的 `arm()` 為底，去掉只有 survey-brain 那次實驗才要的複製插件與 patch。
- 兩個 arm 唯一的差別是主控的 `--model`：opus 對 sonnet。固定不動的有：同一個 task（就是 §1 本身）、同一個起點 sha、各自一個 worktree、同一份 survey 報告當輸入、route 走 `design,plan,build,verify`。
- headless 沒有辦法回答 gate，所以每一站用一次 `claude -p --resume` 推進，prompt 寫明「gate 選 option one」。arm 用 `--permission-mode bypassPermissions` 跑，這是舊 A/B 的做法，Bash 權限全開、只在 worktree 裡動。
- 成本讀 `--output-format json` 的 `modelUsage` 與 `total_cost_usd`。stream-json 會重複同一行，取最大值，不能加總。`duration_ms` 不可靠，不採用。
- 兩個 arm 合計超過 $125 就停，報告照實寫「超支中止」。
- 結果寫成新的 report 頁 `docs/90-agent/reports/2026-09-25-controller-multiplier.md`，寫進 `k`、兩邊的 `modelUsage`、起點 sha 與 harness 的 md5。投影那頁是 report role，不能改；新頁從自己這邊連回去。
- 只量了一個 task，`k` 只代表這一個 task。報告要把這一點寫在第一段。

## 3. TODO.md

- `〔docs〕todo-check 不驗行號` 與 `〔stage-agents〕量 Sonnet 主控倍數` 由交付它們的 task 刪掉。
- `〔quota〕7d 水位` 退回 `## Waiting`，新的 timing 是「TokenBar 寫出真實序列」。lifts when 寫明 `tokenbar-usage.jsonl` 現有的 347 行全部落在 09-22 的 15 分鐘內，是測試資料，而且 09-23 起就沒再寫入。
- `〔security〕` 不動，留在 `## Ready`。

## 4. 證明做完

- `tests/todo-check.test.js` 新增：bullet 帶 `` `scripts/todo-check.js` 指向第 99999 行 `` 時 exit 1、輸出含 `past end`；連結 `[x]` 也指向 `scripts/todo-check.js` 第 99999 行，也一樣；在範圍內的行號 exit 0。三條都要先紅後綠。
- artefact 這一格：報告頁裡的 `k`，要等於同頁兩個 arm 的 token 數相除。從頁面上把數字讀出來重算，要一致。
