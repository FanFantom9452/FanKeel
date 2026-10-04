---
status: current
last_verified: 2026-10-05
source_of_truth: lib/station.js, lib/serve.js
---

# /fankeel hook 逾時：為什麼 buildDirs 不穿 junction、ensureServe 留 250ms

## 決定

- `buildDirs`（`lib/station.js`）不再用 `readdirSync(..., { recursive: true })`，改成自己逐層走目錄，並吃 `gather` 的 `until`：時限用完後目錄仍列出，檔數為 0。
- `ensureServe`（`lib/serve.js`）的探測時間下限從 1ms 改成 250ms。

## 為什麼

- `.fankeel/build/` 底下有指向 `~/.claude/projects` 的 Windows junction，`recursive: true` 會穿過去數整棵樹，`station.write` 因此沒有上限，hook 逾時。
- `inject.js` 在 `write` 之後才呼叫 `ensureServe`，期限常已用完，1ms 的探測會把活著的 station 誤判為沒在跑。
- 時限用完後各目錄顯示 `files: 0` 而沒有截斷標記，是設計接受的取捨。

## 沒做的

- 兩個本機 junction 沒有拆，由使用者自行 `rmdir`（不加 `/s`），另記在 TODO。
- `station.write` 低於 1500ms 的目標沒達成：實測 1505 到 1698ms，因為 `write` 以同為 1500ms 的 `DETAIL_BUDGET_MS` 呼叫 `gather`。門檻與預算怎麼訂，另記在 TODO。
