---
status: current
last_verified: 2026-09-28
---

# guard 不因 `seen` 攔編輯；ab.sh profile-pin 重跑

session 6d2e07ed-652e-4f69-aa01-a4258cd4f2c4 的 design，在對話裡經使用者同意（bounded）。它描述的是要做成的樣子。
survey：`.fankeel/build/task-20260927T184314/survey.md`。

## 1. guard 只憑 hook 看見的寫入攔人

- `lib/guard.js` `blockers()`：判斷鄰居是否持有此檔時只看鄰居的 `claimsOf(data)`，不再用 `effectiveClaims(data, pool)`；`seen` 是 git 看見、不知道誰寫的，不足以在 `ask`／`deny` 下攔編輯。
- `effectiveClaims` 與 `sharedWith` 不變：`seen` 照舊算進撞檔警告（`clash`）。
- `tests/guard-effective.test.js` 的 `a path git saw and no live session holds still counts` 改成：`blockers` 回 `[]`，`effectiveClaims` 仍回 `['f.js']`。現在會紅，改完變綠。
- `docs/90-agent/reference/collisions.md` weight 那一列補一句：`seen` 只進警告，不攔編輯。

## 2. ab.sh 重跑與報告

- 照原 `CAP=62.50`（每 arm 上限）跑 `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh`，使用者已核准花費（預估約 $30）；先 `DRY=1` 看一次指令。
- 新報告 `docs/90-agent/reports/2026-09-28-ab-profile-pin.md`：從 evidence 的逐站 json 與 `summary.json` 算 k，與 `2026-09-25-controller-multiplier.md` 對照；登入 `docs/README.md`。
- `TODO.md` 關掉 guard 那條 Ready 與 ab.sh 那條 Needs a decision，各由交付它的 task 關。

## What proves it done

| check | how |
|---|---|
| seen 不攔 | 上面那條測試紅轉綠，整套 `npm test` 綠 |
| 重跑 | `provenance.txt` 最後一行是 `done`，兩個 arm 都有 `verify` 的 json；報告每個數字都能從 evidence 算回 |
