---
status: current
last_verified: 2026-10-18
source_of_truth: agents/fankeel-judge.md
---

# 判官派讀者，前後量一次 — 2026-10-18

一句話：同一份 brief，改版後判官本身的 token 從 369,784 升到 572,139（+55%），另外讀者（opus）花了 143,599；兩邊 pick 相同（B）。在這份 brief 上，派讀者沒有省到判官的錢。

## 1. 怎麼量

同一份 brief（`.fankeel/build/ask/judge-readers-brief.md`：lib/guard.js 379 行、hooks/guard.js 209 行，問唯讀 agent 能否經由 Bash 寫檔），兩個 general-purpose agent 都跑 fable、都不指定 effort：改版前用 `git show e45b3579:agents/fankeel-judge.md` 的內文，改版後用現在的。兩邊同時派出。

- token 是每份 subagent transcript 裡每筆 `message.usage` 的 input、cache read、cache write、output 加總；每一輪都重讀前面的 context，所以這是累計量，不是單次 context 大小。兩邊用同一種算法，比較成立；絕對數字比單看 context 大。
- effort 跟 session 走，不是判官檔的 xhigh。
- 已安裝的 plugin 是舊版，它的 brief hook 仍對每個 subagent 注入「不得自行派 subagent」；改版後那一邊的 prompt 多一句說明這條在本次量測不適用。

## 2. 結果

| arm | 判官 token | 請求數 | 讀者 | 讀者 token | 時間 | pick | delegated |
|---|---|---|---|---|---|---|---|
| 改版前 | 369,784 | 7 | — | 0 | 81s | B | — |
| 改版後 | 572,139 | 11 | opus | 143,599 | 148s | B | lib/guard.js — opus |

兩邊找到的漏洞大致相同：`unquoted()` 先抹掉引號內容，`bash -c 'echo x > f'` 的內層 redirect 因此看不到（lib/guard.js:324）；WRITE_PATTERNS 是拒絕清單，`touch`、PowerShell 別名等不在其中；hooks/guard.js:55-58 在父 session 沒有 active 登錄時整段唯讀檢查不跑。改版後那一邊另外找到 `>&file` 與 `git -C . reset --hard` 兩條。

## 3. 為什麼沒降

- lib/guard.js 只有 379 行，剛過 300 行門檻；判官派了讀者讀 1-299 行，仍自己讀 300-381 行與整份 hooks/guard.js。
- 派讀者多出 4 輪請求，每一輪都重讀判官已有的 context；省下的閱讀量小於多出的重讀。
- 讀者選了 opus 而不是 sonnet。

## 4. 沒量到的

- 只跑一次，沒有重複。
- effort 不是判官檔的 xhigh。
- 只有一個檔超過門檻，而且只超過 79 行；遠大於門檻的檔（上千行、或整個 transcript 目錄）沒量，那才是 judge-1 原本描述的情境。
