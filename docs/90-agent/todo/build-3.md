---
label: build
title: build close 先跑 docs-check
description: build close 只跑 npm test，沒跑 docs-check；10-02 改版刪了 TODO.md，死連結與 35 行位移都是 verify 才抓到，退回 build 兩次 — [fankeel-build](skills/fankeel-build/SKILL.md).
state: done
link: skills/fankeel-build/SKILL.md
done:
  at: 2026-10-03
  sha: 4aab8b9df66e1c0dc2ed9bc162206a7fd8cf0bfa
  disposition: done
  session: 8237ef1b-a525-4764-9ea4-7eeb0f3de502
---

來源：2026-10-02 TODO folder-only 改版。build close 跑完整套測試（3396 全過）就寫關卡，沒跑 scripts/docs-check.js；結果 verify 第一輪抓到 pipeline.md 8 處舊 TODO.md 規則、station.md 35 行 moved 行號，第二輪又抓到 development.md:76 連到已刪的 TODO.md 與 plan 頁 past-end 引用，前後退回 build 兩次。task.js 在第二次退回時印出「name what verify caught that build's review did not, and add that check to the review」，這就是那個檢查。

要做成：skills/fankeel-build/SKILL.md 的 build close 步驟（與 lib/stages.js 對應的 build 規則）在跑完 npm test 之後加跑 node scripts/docs-check.js，把 gone、moved、past-end 這幾類 finding 當成 build 自己要修的項目，不留給 verify；只有 decision、archive 這類 write-once 頁的歷史連結可以列為 ruling 留下。

使用者 2026-10-02 加的做法（同一個任務裡 verify 又為 docs-check 退回 build 兩次，其中一次是三筆誤配）：分三層，不做無上限的 loop。一、`moved:` 且 docs-check 給了新行號的，用腳本照它給的行號自動改，不派 agent。二、其他類（文字找不到、符號消失、past-end）派 fankeel-fixer 修一輪，修完再跑一次 docs-check，剩下的寫進 build 的報告讓使用者決定，不重試。三、docs-check 配錯符號的誤報，以及 decision、archive 這類寫一次的頁裡的歷史引用，記成 ruling 留下，不為了讓檢查變綠去改對的文字。理由：無上限的自動修會把對的句子改掉、在不該修的項目上停不下來，而且每轉一圈都派一個看不到的 agent。

完成條件：build close 的輸出形狀含一行 docs-check 結果；tests/skills.test.js（或 stages.test.js）有一條斷言 build close 規則提到 docs-check，拿掉該句即紅；`moved:` 自動改行號的腳本有測試，餵一筆已知位移能改對、餵一筆沒有新行號的不動。
