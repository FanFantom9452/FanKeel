---
status: current
last_verified: 2026-10-05
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；儀器與原始記錄在 docs/90-agent/reports/evidence/2026-10-05-compact-probe/
---

# mod 自動壓縮的 headless 探針：(b) 不成立，headless 不允許 `$.session.compact`（n=1）

結論先講：`hooks/compact.ts` 在 headless（`claude -p`）下載入成功、`turn.complete` 也觸發、門檻壓到 1 時 mod 決定壓縮，但 `$.session.compact` 被 Claude Code 拒絕，訊息是 `not available in a headless (-p / SDK) session yet: compaction here runs inside a turn (a /compact prompt)`。所以 (b) 不成立，transcript 沒有 `trigger` 為 `plugin` 的 `compact_boundary`。(c) 在這個條件下沒有意義：兩臂的 `PROBE-RESULT` 都正常送到，但中間沒有發生壓縮。headless 證明這條路走不通，要證明壓縮得用互動式 session。每項 n=1，HEAD 是 9ccf2a67，Claude Code 2.1.289。證據在 `docs/90-agent/reports/evidence/2026-10-05-compact-probe/`（下稱 evidence 目錄），行號是 evidence 目錄下 `test/debug.log` 與 `test/transcript.jsonl` 的行號。

| 項目 | 判定 | 依據 |
| --- | --- | --- |
| (a) 載入，且 command hook 也還在跑 | 成立 | `debug.log:121` `hooks module fankeel@inline loaded (worker, environment 1, tier user); events: turn.complete`；transcript 的 `FANKEEL` 計數 test 2、control 2 |
| (b) 從 `turn.complete` 壓縮成功 | 不成立 | `debug.log:323` `fankeel compact: 35148 tokens >= 1, compacting`，`debug.log:326`、`355`、`357` attempt 1 至 3 都 `rejected: HooksError: fankeel: $.session.compact: not available in a headless (-p / SDK) session yet`；`compact_boundary` 在 transcript 零行，含 `plugin` 的計數 0 |
| (c) 背景 agent 回報壓縮後照常送到 | 無從判定 | 沒有壓縮發生。`stream.jsonl:18` 有 `PROBE-RESULT PROBE-VALUE-test-1791202392008`，等於 `probe.txt`，但這只說明沒壓縮時回報照常送到 |
| 對照組（不設門檻） | 如預期 | control 的含 `plugin` 的 `compact_boundary` 計數 0，`PROBE-RESULT PROBE-VALUE-control-1791202411198` 在 `stream.jsonl:18`，`debug.log` 沒有 `fankeel compact:` 列，兩臂 exit 0 |

mod 的重試行為在 headless 下成立：同一輪 attempt 1 至 3 間隔約 1 秒，第二輪 `debug.log:399` 再試一次，每次都被捕捉、不影響 session，符合「出錯 exit 0」的規定。
