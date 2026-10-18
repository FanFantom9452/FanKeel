---
status: current
last_verified: 2026-10-18
source_of_truth: agents/fankeel-judge.md
---

# 三版判官，同一份架構級 brief — 2026-10-18

一句話：三版 pick 都是 B；清單版判官自身 473,597（比自己讀多 32%），加讀者合計 756,046（約 2.1 倍），請求 8 輪對 6 輪，但五個讀者都在同一則訊息派出、全部抽查一致、沒有未讀。

## 1. 怎麼量

同一份 brief（`.fankeel/build/ask/judge-checklist-brief.md`，五個檔共 3501 行，兩個超過 1000 行），三個 general-purpose agent 都跑 fable、都不指定 effort：e45b3579 的判官（自己讀全部）、9bce6868 的判官（超過 300 行才派讀者）、現在的判官（先列清單、一次派出、長總結）。effort 跟 session 走，不是判官檔的 xhigh，所以絕對數字比真的 ask 低，三版互比才是重點。

- token 是每個不重複的 assistant message id 的 input、cache read、cache write、output 加總；每一輪都重讀前面的 context，所以這是累計量。transcript 裡的 output token 數看起來偏低。
- 已安裝的 plugin 的 brief hook 仍注入「不得自行派 subagent」；arm 2 與 arm 3 的 prompt 多一句說明這條不適用。

## 2. 結果

| arm | 判官 token | 請求輪數 | 讀者 | 讀者 token | 同一則訊息最多讀者 | 時間 | pick |
|---|---|---|---|---|---|---|---|
| e45b3579 自己讀 | 360,081 | 6 | — | 0 | 0 | 78s | B |
| 9bce6868 門檻 | 377,505 | 7 | 1 個 opus 實際執行（lib/guard.js）；2 個 sonnet 讀者（lib/registry.js、scripts/task.js）被 auto mode 分類器拒絕，判官自己 grep 這兩個檔 | 66,643 | 3（同一則訊息派出） | 180s | B |
| 現在 清單 | 473,597 | 8 | opus×2（hooks/guard.js、lib/guard.js）、sonnet×3（lib/registry.js、scripts/task.js、hooks/touch.js） | 282,449 | 5 | 196s | B |

判官加讀者合計：360,081 / 444,148 / 756,046。

三版核心發現相同：hooks/guard.js:55-57 在父 session 沒有 active 紀錄時先 return，跳過 :86 的唯讀檢查。

## 3. 清單版有沒有照做

checklist 5 行、讀者 5 個，五個 Agent 呼叫全在同一則 assistant 訊息；`unread:` 為 nothing；每個被引用的行都抽查過，全部相符；Summary 約 30 行。它還找到 inject.js:129（只在 init 記錄）與 lib/clear.js:35，arm 1 與 arm 2 都沒點名。

## 4. 沒量到的

- 每個 arm 只跑一次（n=1）。
- effort 不是 xhigh。
- arm 2 的兩個讀者被拒絕，所以它不是乾淨的門檻 arm。
- output token 在 transcript 裡偏低，合計可能低估。
