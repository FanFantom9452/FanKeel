---
status: decision
last_verified: 2026-09-29
---

# TODO 全表盤點（09-29 第二輪）：決策紀錄

一句話：一個 session 一打 `/fankeel` 就在 registry 寫一筆沒有 task、stage 為 `init` 的 entry，同台其他 session 從那一刻就看得到它；另補三個測試缺口，並把 advisor、model 兩筆待決定條目了結。

design 見 [../99-archive/2026-09-29-todo-patrol-2-design.md](../99-archive/2026-09-29-todo-patrol-2-design.md)，計畫見 [../99-archive/2026-09-29-todo-patrol-2.md](../99-archive/2026-09-29-todo-patrol-2.md)，現行說明見 [../90-agent/reference/registry.md](../90-agent/reference/registry.md) 與 [../90-agent/reference/collisions.md](../90-agent/reference/collisions.md)。

## 為什麼

`collisions-1` 問同台 B 為什麼不知道 A 在做什麼，三個候選成因查過：兩個 registry 只在第一個 session 開在子目錄時才分裂；liveness 誤判只剩沒有 `configDir` 的舊 entry 與 `EPERM` 兩個窄情況；真正的原因是 A 還在 init——`task.js start` 之前 registry 裡沒有它。`station-2`（station 看不到 init 中的 session）是同一個原因。

## 定了什麼

- init entry：`hooks/inject.js` 在 `/fankeel` prompt 且本 session 沒有 entry 時寫 `{active: true, stage: 'init'}`，不帶 task；`task.js start` 接手自己的 init entry 而不是拒絕；`adopt` 拒絕 init 來源；station 把這列顯示為「初始化中」。
- init entry 是 `active`，所以 guard 也把這個 session 當成有任務：它的唯讀 subagent 會被 guard 擋（`subagents.md` 已寫明）。
- advisor：不設 `advisorModel`。`/fankeel-ask` 是使用者主動呼叫、分析完再交給 brain；brain 不去叫建議者。
- effort：固定 effort 已在 8 個 agent 檔的 `effort:` 釘好；使用者自訂、且更新插件不會蓋掉的機制併入 `station-6`（從 profile 產生 `.claude/agents/` 覆寫檔）。
- 兩個 registry 與兩種窄 liveness 誤判不改：沒有重現。

## 沒做的

- `tests/init-entry.test.js` 與 `tests/title-hook.test.js` 沒跑 mutation。
- `source.test.js` 因另一個 session 的 `tour-keel.js` 匯出而紅：TODO `station-7`，等那個 session 收工。
- 一次沒重現的整套失敗：TODO `test-1`（Watch）。
