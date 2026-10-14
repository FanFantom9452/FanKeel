---
status: design-intent
---

# TODO 全表盤點（10-15 第三輪）：gate 框拖曳縮放、drive.js 交棒、0.80.0 格式盤點、兩個量測 — Design

這次盤點，使用者在 survey 的關卡說「全部列出來給我 我要做 不要管成本」，所以 session 做得了的全部排進來：Ready 的「gate 通知框可拖曳縮放」與「drive.js 寫不進 handoff」，Needs a decision 的「升級技能要不要補步驟」（使用者選先盤點格式變化），Watch 的「兩個 hook 逾時」與「station-data 加伺服端快取」各自的量測，以及把「接縫 profile 中途翻轉」改標 ready。「快速設定重新設計」使用者選下一輪進 design，這次不動。要使用者親手在 Desktop 或終端機做的 Ready（子代理 brief 改走 spawn、Desktop 真機看壓縮視窗、實測安裝版 mod 啟動就載入、面板真機沒看完的四件事、終端啟動讀遠端狀態）不在本計畫裡。

class 為 bounded：每一條都改既有流程。gate 框是前端，build 與 verify 會跑 render review。

## 1. gate 框拖曳縮放

- gate 浮動面板 `.fkp` 拖標題列 `.fkh` 移動、拖右下角的把手 `.fkr` 改變大小，滑鼠與觸控都可（pointer events，`touch-action:none`）。
- 位置與大小是 `{x, y, w, h}`（像素，從視窗左上角算），存在 `localStorage` 的 `station.fkBox`，重新整理後還原。
- 面板永遠被拉回視窗內：拖動時、視窗縮小時、讀回的舊值放不下時都一樣；寬至少 260、高至少 160。
- 雙擊標題列回到預設的右下角，並清掉存的值。
- 每 3 秒的重畫會整個重建 `#fk`，所以位置寫在 `floatHtml` 產生的 `style` 裡，拖到一半重畫也不會跳回去；回答 gate 的輪詢與送出不變。
- `docs/90-agent/reference/station.md` 的 Answering a gate from the page 補上這項行為。

## 2. drive.js 寫得進 handoff

- 先用一支 probe 實測：`claude -p --permission-mode acceptEdits` 在三臂（不加旗標、`--settings` 帶 allow 規則、`--allowedTools`）下各寫一次 `.fankeel/build/` 底下的檔，看哪一臂寫得進去。
- `scripts/drive.js` 的 `argsFor` 加上寫得進去的那一臂的旗標；`--permission-mode acceptEdits` 不變，仍然不用 `bypassPermissions`。
- 三臂都寫不進去時不改 drive.js，probe 的結果寫進 drive.md；把 handoff 搬到非點開頭的目錄，由 land 用 `todo.js new` 另開一條 TODO。
- 改好後由使用者在 Desktop 另開一個只有 build、verify 兩站的小任務，這個 session 用 `--max-rounds 2 --max-usd 2` 重跑一次，結果寫進 drive.md。

## 3. 0.80.0 到現版的專案檔案格式盤點

- 盤點 0.80.0（90bd950b）到現版之間，專案自己的 `.fankeel/profile.json`、`.fankeel/docs.json`、TODO、`.fankeel/render.json` 每一項格式變動，逐項寫明今天的程式讀舊格式會不會壞，寫成一份報告。
- 讀程式得到的結論是沒有一項舊格式會被拒絕或讀錯，所以 `scripts/upgrade.js` 不加步驟；這個結論由一條測試鎖住：一個帶著 fankeel 自己 repo 在 0.80.0 時那份 profile.json 與 docs.json 的專案，今天讀進來全部值都在、`upgrade.js` 說 nothing pending。
- 若檢查 `lib/render.js` 時發現 `render.json` 有舊格式會壞的變動，報告照實寫；在 `upgrade.js` 補只印不改的步驟由 land 用 `todo.js new` 另開一條 TODO，不在本計畫裡做。

## 4. 兩個量測

- 寫 `guard-probe.cjs`，對 `hooks/guard.js` 餵三種 PreToolUse Bash payload（唸、寫、commit），每種跑五次，印中位數與最大值。
- 重跑 `docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs` 五輪，取 `== cold` 區塊的 `wall` 最大值。
- 對 `/station/station-data.js` 先閒置 3 秒再 curl，重複五次，取中位數。
- 三個數字與門檻（guard 與 cold 的最大值低於 5000ms、station 的中位數低於 1 秒）寫成一份報告；過了門檻的條目在 land 結案，沒過的條目留著並寫明數字，修法另開。

## 5. 接縫「profile 中途翻轉」改標 ready

- 條目改成 `state: ready`，拿掉 `group`、`timing`、`stamp`，正文補一行 10-15 的決定。

## What proves it done

| test | how |
|---|---|
| gate 框的位置會被拉回視窗內 | `tests/station-float-box.test.js`：`fkBoxClamp` 把超出右邊、下邊、比視窗大、比最小值小的框都拉回來；`floatHtml` 帶框時輸出 `position:fixed;left:…` 與兩個把手。 |
| 拖曳、縮放、重新整理、視窗縮小 | `tests/station-float-drag.test.js`：在 vm 裡用頁面自己的 pointer 監聽器拖標題列與把手，`#fkp` 的 style 跟著動，放開後 `station.fkBox` 存進 localStorage；帶著存值重新開機、把視窗縮小再觸發 resize，框被拉回視窗內。 |
| drive.js 帶著放行旗標 | `tests/drive.test.js` 的 argsFor 測試多一條 pair 斷言。 |
| 0.80.0 的專案今天讀得進來 | `tests/upgrade-080.test.js`：profile 的每個值 `sources` 都是 `project`，docs.json 的每個 bucket 都留著，`upgrade.run` 回 `nothing pending.` 與 code 0。 |
| 量測有數字 | 報告 `docs/90-agent/reports/2026-10-15-hook-and-station-timing.md` 寫著三個數字與原始資料的路徑。 |

## Files

| file | change |
|---|---|
| `assets/station/station.js` | 框的純函式、`floatHtml` 的第七個參數、拖曳與 resize 的監聽器 |
| `assets/station/station.css` | 標題列游標、右下角把手 |
| `tests/station-float-box.test.js` | 純函式與 `floatHtml` 的測試 |
| `tests/station-float-drag.test.js` | vm 裡的拖曳測試 |
| `docs/90-agent/reference/station.md` | Answering a gate from the page 補一段 |
| `docs/90-agent/reports/evidence/2026-10-15-drive-allow/probe.cjs` | 三臂 probe |
| `scripts/drive.js` | `argsFor` 加放行旗標 |
| `tests/drive.test.js` | pair 斷言 |
| `docs/90-agent/reference/drive.md` | probe 結果與重跑結果 |
| `docs/90-agent/reports/2026-10-15-upgrade-080-inventory.md` | 格式盤點報告 |
| `tests/upgrade-080.test.js` | 0.80.0 專案的讀取測試 |
| `docs/90-agent/reports/evidence/2026-10-15-hook-timing/guard-probe.cjs` | guard 的計時 |
| `docs/90-agent/reports/2026-10-15-hook-and-station-timing.md` | 量測報告 |
| `docs/90-agent/todo/stage-agents-5.md` | 改標 ready |

## Unverified

- `--settings` 的 allow 規則與 `--allowedTools` 能不能蓋過 Claude Code 對 `.fankeel/` 的 sensitive file 判斷，沒人量過；2026-09-28 的 allow-rule probe 是在 `auto` 模式下跑的，有沒有規則都寫得進去，所以不算數。
- `lib/render.js` 自 0.80.0 以來的 diff 沒逐行讀過，`render.json` 的格式有沒有變還沒確認。
