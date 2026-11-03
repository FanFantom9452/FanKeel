---
status: design-intent
last_verified: 2026-11-03
---

# TODO 全表盤點 11-03 — plan 索引

**Spec:** [../records/task-20261102T205616/design.md](../records/task-20261102T205616/design.md)

三條 Ready 互不共用檔，照 fankeel-plan 的拆組規則切成三組，各組是一份一般 plan，`ledger.js --plan <組檔>` 原樣可用。C 組的設計方向在條目本身（使用者 11-03 同意，design gate 選「照條目方向直接排進 plan」）。

| group | plan file | spec sections | files | interface it exposes | depends on |
|---|---|---|---|---|---|
| A worktree 不放在 repo 裡 | [2026-11-03-patrol-a-worktree.md](2026-11-03-patrol-a-worktree.md) | §1 | `README.md`；記憶 `fankeel-release-every-change.md`（repo 外）；使用者的 marketplace 設定 | 發版步驟：`git -C F:/ymlab/fankeel-dist pull --ff-only` 在 `claude plugin marketplace update fankeel` 之前 | none |
| B 先問完、剩下自己跑 | [2026-11-03-patrol-b-preanswer.md](../../99-archive/2026-11-03-patrol-b-preanswer.md) | §2 | `scripts/task.js`、`lib/registry.js`、`hooks/gate.js`、`lib/guard.js`、`lib/stages.js`、`docs/03-decisions/2026-11-03-preanswered-gate.md` 及其測試 | registry 欄位 `preanswer: {answers: {<stage>: <option label>}, stops: [...], at}`；`task.js preanswer <stage>=<label>... --session <id>`；gate 紀錄標 `preanswered` | none |
| C 跨機回顧：專案卡與來源分級 | [2026-11-03-patrol-c-record.md](../../99-archive/2026-11-03-patrol-c-record.md) | `docs/90-agent/todo/record-2.md` 的「設計方向」與「尚缺」 | `scripts/record.js`、`.fankeel/.gitignore` 的產生處、retro／retro-all skill 與 agent 檔、`scripts/conversation.js`（只讀）及其測試 | ZIP 內 `project.md`；manifest 多 `source`、`projectCard`、`fankeelVersion`；retro 每項發現帶面向，架構面向無專案卡時記 `unverified:` | none |

build order: A, B, C

三組互不共用檔，可並行；A 組有一個 `user` 任務（clone 與 marketplace 切換），放在 A 的最後。
