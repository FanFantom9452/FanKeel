---
status: decision
last_verified: 2026-09-22
---

# 全部 stage 交給站 agent：不等量測，直接補齊 held 的五個 task — 決策紀錄

[2026-09-22-ctx-by-stage.md](2026-09-22-ctx-by-stage.md) 記過一次分期：plan 關卡只做第一列
（`scripts/ctx.js --by-stage`），其餘五個 task 等一次真實受控跑的量測結果再說。這份取代那個
「等」——同一天，使用者直接開了跑：每一站都要有 Sonnet 站 agent，Opus 只留給判官與關鍵處。

## 定案

| 問題 | 定案 | 為什麼 |
|---|---|---|
| 等不等量測 | 不等。held 的 Task 2 到 6 全部做，另外新增 Task 7（brain 改 Sonnet）、8（放行 handoff 寫入）、9（發版與使用者自己翻開關） | 使用者的要求本身就是答案：把 Opus 集中到關鍵處，其餘全部 Sonnet；等一次量測才能回答的是「省多少」，不是「要不要做」 |
| 兩份文件（spec、held plan）怎麼處理 | 落地後移進 `docs/archive/`，狀態改 `archived` | 兩份文件自己都寫著「停在 `docs/plans/` 直到這些 task 落地，這份也是」；`land.archivePlan` 為 true，落地即封存 |
| 受控 build／verify 的成本量測 | 仍然沒有跑。這次 build 全程走一般 loop（主控直接派 implementer、reviewer），沒有派 `fankeel-brain`：brain 檔在改成 Sonnet 之前固定 Opus，跟這次「Sonnet 為主」的目標相反，等 Task 7 落地後才有 Sonnet brain 可測 | 見 ledger 的 ruling：`build 走一般 loop，不派 fankeel-brain` |

## 沒量過的

- Sonnet 站 agent、Task 7 的 `model: opus` 覆蓋（design、plan 兩站）、`Edit(/.fankeel/build/**)` 放行規則是否真的解決 no verdict——三件事都只有 [2026-09-22-brain-on-sonnet.md](2026-09-22-brain-on-sonnet.md) 記的探測結果，沒有一次真實跑。
- 受控 build／verify 對主控 context 的省法，spec 設的門檻（controller 至多 60 turns、最後一關低於 200k）都還沒有一次真實 task 量過。

## 要回頭

安裝版翻開 `stage.agents: all` 之後，跑一個真實 task，用 `node scripts/ctx.js <session> --by-stage` 與該 session 的 `modelUsage` 讀。門檻不成立就回頭看 Task 7、8 的做法，而不是先假設它們有效。
