---
label: session
title: drive.js 第一次實跑
description: drive.js 只用假的 claude 測過；還沒用真的 claude -p 跑過一站，不知道 acceptEdits 下 brain 寫不寫得進 build 目錄的 handoff，也不知道 total_cost_usd 是否每輪都有 — [drive.md](docs/90-agent/reference/drive.md).
state: done
link: docs/90-agent/reference/drive.md
done:
  at: 2026-10-15
  sha: 3dcc9bcd
  disposition: done
  session: 20013ee1-09df-4f78-bf45-90d326995310
---

來源：2026-10-10 TODO 盤點（session-1 結案時）。verify 確認 drive.js 的每條路徑都只由假 spawn 測過；設計的 Unverified 一項（acceptEdits 下能不能寫 .fankeel/build/）仍未驗證。10-10 使用者用 claude --debug 在 auto mode 寫同一個資料夾是放行的，但那是主 session、不是 claude -p 加 acceptEdits。

要做成：挑一個小任務，用 node scripts/drive.js --session <id> --max-rounds 2 --max-usd 2 跑一站，看停下那行 JSON 的 stopped、usd 與 handoff 檔。

完成條件：一站跑完並讀到帶 status 的 handoff，或停下的原因查清楚並寫回 drive.md。

2026-10-15 盤點：使用者選了第一個交給 drive.js 的任務——一個小型文件或測試任務，用 `--max-rounds 2 --max-usd 2` 跑，順便回答 acceptEdits 能否寫 `.fankeel/build/`。

2026-10-15：第一次實跑：`{"stopped":"status","rounds":1,"usd":0.47,"stage":"build","handoff":"F:/ymlab/fankeel/.fankeel/build/task-20261014T221105/build.md"}`。任務是 session 8a06683b 的「drive.js 試跑：把 drive.md 的 last_verified 對照 scripts/drive.js 的 usage 行檢查一遍」，路線 build,verify。這一輪有 `total_cost_usd`（driver 算出 0.47）；只跑了一輪，所以「每輪都有」只驗到一輪。build 站自己的檢查做完了，但它對 handoff 檔唯一的一次 Write 被 Claude Code 以「sensitive file」拒絕，最後一則訊息報 blocked、沒有繞過，工作樹沒有任何改動，driver 因找不到 handoff 停在 status。答案寫回 drive.md 第 20 行：acceptEdits 不讓 headless 站寫 `.fankeel/build/`。完成條件的後半（停下的原因查清楚並寫回 drive.md）已達成；要讓 drive.js 真的能交棒，得換權限模式或加 allow 規則，那是另一件事。

## 完成紀錄

第一次用真的 claude -p 跑 drive.js：一個只有 build、verify 兩站的小任務，上限兩輪、兩美元。跑了一輪、花了 0.47 美元就停下。那一站的檢查做完了，但它要寫交棒檔時，Claude Code 把那個資料夾當成敏感檔案擋下，所以 driver 找不到交棒檔，停在 status。這回答了原本沒人知道的問題：在 acceptEdits 模式下，站寫不進交棒資料夾。說明頁已改寫，讓 drive.js 真的能交棒另開一條待辦。

- commit 5b5af33e
- commit 3dcc9bcd
