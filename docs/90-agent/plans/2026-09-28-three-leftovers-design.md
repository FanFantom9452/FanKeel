---
status: design-intent
last_verified: 2026-09-28
---

# 三件收尾：spawnDepth 時序實測、relPath 評估、trim-order 測試

session 2a5345e2-0a44-46de-b339-a410b570f4f1 的 design，route 沒有 design 站，範圍在 survey 的 gate 由使用者核可（三項一起進 plan）。它描述的是要做成的樣子。
survey：`.fankeel/build/task-20260928T074550/survey.md`。

## 1. trim-order 測試

- `tests/registry.test.js` 加一則：`addNote(root, SID, 'x ')` 之後 `addNote(root, SID, 'x')` 回 `true`（`update()` 對已存在的值回成功，同 `addClaim`），`notesOf` 只留 `['x']`。這釘住 `addNote` 先 `trim` 再交給 `appendUnique` 比對的順序（`lib/registry.js` 的 `addNote`）。
- `TODO.md` 刪掉 `## Ready` 裡以 `〔tests〕` 開頭、講 `appendUnique` 的那條。

## 2. relPath 評估，連同審 `lib/guard.js` 那 +8 行

- 審查結論：ac58fc9b 加在 `relPath` 上面的那段註解說「14 個檔手寫 `path.join(...).replace(/\\/g, '/')`，換成 `relPath` 不保行為」，框架錯了。那 14 個檔裡的 `replace(/\\/g, '/')` 幾乎都在正規化已經是相對的字串，或組出絕對路徑，跟 `relPath` 算的不是同一件事；真正在算「相對專案根」的只有 `scripts/tune.js` 的 `/__live/request` 那行 `path.relative(root, file).replace(/\\/g, '/')`。
- `scripts/tune.js` 那行改呼叫 `lib/guard.js` 的 `relPath(root, file)`。`file` 由 `resolveInside(root, page)` 得來，一定在 root 之內，所以換了行為不變。
- `lib/guard.js` 刪掉那段 14 檔的註解，`relPath` 的註解留原本前三行。
- `TODO.md` 刪掉 `## Ready` 裡以 `〔trim〕` 開頭的那條。

## 3. spawnDepth 讀檔時序實測

- 用 headless `claude -p` 掛一個只記錄的 `SubagentStart` hook，派一個會再派子 agent 的 agent（深度 2），記下 hook 觸發當下 `agent-<id>.meta.json` 在不在、內容、以及之後多久出現。
- 腳本、hook、原始輸出與 `provenance.txt` 放 `docs/90-agent/reports/evidence/2026-09-28-spawndepth-timing/`。
- 報告 `docs/90-agent/reports/2026-09-28-spawndepth-timing.md`，登入 `docs/README.md`。
- `TODO.md` 的 Watch「spawnDepth 讀檔時序未證實」：檔案在 hook 觸發時已存在且帶 `spawnDepth` → 整個 timing 刪掉；不在 → 那條移到 `## Needs a decision`，連到報告。

## What proves it done

| check | how |
|---|---|
| trim-order | 新測試在 `addNote` 改成用未 trim 的字串比對時變紅，還原後綠 |
| relPath | `tests/tune.test.js` 綠；`grep` 不到那段 14 檔註解 |
| 時序 | evidence 裡有深度 1 與深度 2 各至少一筆 hook 紀錄，報告的結論能從那些紀錄讀回 |
| 全套 | `npm test` 綠 |
