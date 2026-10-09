---
label: model
title: 擴大 Haiku 角色測試與飄移
description: 每角色一套分層題庫、平行跑，並以 2×2 量長任務會不會飄移：模型 haiku／sonnet × hook 重注入 關／開
state: done
done:
  at: 2026-10-09
  sha: 0aad58a6
  disposition: done
  session: 8846548c-26e8-4b4a-a6cd-c8d649c9de33
---

來源：2026-10-08 session 49e93c6c-9f31-4839-8e3f-ef6adff80a17，在 Haiku 5.5 按角色測試的 build 中，使用者先問能不能不管成本大規模測試，又問題目要怎麼設計，最後補一句「順便要設計長任務會不會飄移，除非 hook 有持續注入」。

現況：`scripts/bench.js` 的 role 指令與 bench/roles 目錄，每個角色只有一題，每臂 5 次。0 次失敗時，95% 信心的失敗率上限：5 次約 45%，30 次約 9.5%，100 次約 3%。mutator 第一批的實測（證據在 docs/90-agent/reports/evidence/2026-10-08-haiku-bench 證據目錄的 role-mutator-20261008T130828）：角色平均花費 sonnet $0.0240、haiku $0.0020，轉交 session 約 $0.0039。`scripts/bench.js` 目前用 spawnSync 迴圈逐次跑。

一、題庫。每個角色約 12 題，分三層：簡單、中等、陷阱。陷阱的例子：
- reader：舊版同名檔裡放錯的值當干擾；問一個不存在的東西，正解是「沒有」。
- mutator：測試抓不到的變異，要誠實回報存活；path:line 對不上時要拒絕。
- mover：內容看起來有錯，誘它順手修；commit 訊息含引號與換行。
- 照抄計畫的 implementer：程式含 $' 、反斜線、正則跳脫、CRLF，這些都是 memory 記過的實際坑。

每題由產生器依 seed 產出 setup.sh、input.md、check.sh 與兩側控制組，selftest 逐題驗控制組。失敗要分類：答錯、捏造引用、沒還原、多改了檔、格式不對。平行執行之前，要先驗證 haiku 臂寫在暫存目錄 .claude/agents/ 的 override 不會互相污染。

二、長任務飄移。一個 30 到 60 次工具呼叫的長任務，開頭只給一次幾條可以機械檢查的約束，例如 commit 訊息格式、不碰某個目錄、每 N 個檔跑一次測試、回報用繁體中文。之後逐步檢查每一步有沒有守住，記錄第一次違規的步數，以及守規率對步數或 context 大小的曲線。
- 2×2：模型 haiku／sonnet × 重注入 關／開。
- 注入的管道：子 agent 收不到 UserPromptSubmit（`docs/90-agent/reference/subagents.md:12`）。SubagentStart 只在開頭給一次 brief。PostToolUse 的 additionalContext 量過會進到子 agent 的模型（`docs/90-agent/reports/2026-09-28-subagent-hook-probe.md:110` 與 `docs/90-agent/reports/2026-09-28-subagent-hook-probe.md:126` 的結論），所以重注入臂用 PostToolUse，每 N 次工具呼叫注入一次約束，並一併量注入本身多花的 token。
- 控制組：一份全程守規的歷史必須判過；一份在後段才違規的歷史必須判不過，證明檢查看的是每一步，不只看結尾。
- `lib/render.js:619` 的 2400 上限是 UserPromptSubmit 那一塊用的；PostToolUse 的輸出有沒有自己的上限還沒查。
- 可選的第三臂：主 session 跨自動壓縮後，約束還在不在。這和「壓縮後 station 還原紀錄嗎」那筆相關。

要變成什麼：這次四批初篩跑完、報告寫好之後，開成下一個 fankeel 任務，survey 從這筆開始。

完成的標準：
- 每個角色一套分層題庫，selftest 全過；
- 有一個平行執行器；
- 一份飄移 2×2 的報告，回答兩個問題：haiku 能不能接長任務？重注入值不值得它多花的 token？

## 完成紀錄

每個角色現在有十二題、分簡單、中等、陷阱三層的題庫，每題的檢查會標出失敗類別。bench.js role 可以用 --jobs 平行跑，drift 指令在一個長任務上逐步檢查四條約束，量 haiku 與 sonnet 各自在 PostToolUse 重注入開或關時會不會飄移。付費批次跑完：照事先寫定的規則，mover 與 implementer 可以用 haiku，reader 與 mutator 不行。使用者把 reader 改回 sonnet，其他三個留在 haiku。長任務上 haiku 撐得住，重注入對 haiku 值得；sonnet 多數 run 用腳本一次做完、不到 30 步，這些 run 算無效。七批共 472 次 run，花費 8.26 美元。

- commit 5f818581
- commit 98889416
- commit efc2afd9
- commit fd3d5486
- commit 83eea5f6
- commit d683eb87
- commit e03be4fa
- commit c8214d76
- commit 7e5b5ea2
- commit 5788a277
- commit 23aeefdf
- commit d1713e71
- commit 2636785d
- commit 8df7beb8
- commit 0dda3a78
- commit 6ddc9a78
- commit 12874cd5
- commit 7de37e4b
- commit 3a3256c4
- commit ea5429d5
- commit c86ba08e
- commit e35a4b38
- commit cfc693e0
- commit 6b595646
- commit c2a670be
- commit f3ce65e0
- commit 8ee47d91
- commit b68b64c6
- commit e5165100
- commit 91597d38
- commit caa23e21
- commit 32483761
- commit 5cc9ed74
- commit c840bbac
- commit aeb15de3
- commit c1020047
- commit 0ebcdac4
- commit bb0b8f15
- commit 1e2b82fd
- commit 2908a1c9
- commit 3a9d24cf
- commit aa5e25fd
- commit 7697298c
- commit 9205304c
- commit 09d23770
- commit f8761b3c
- commit e650e434
- commit 701e9a4a
