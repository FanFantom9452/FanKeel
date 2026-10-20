---
label: land
title: land 階段沒規定怎麼 commit
description: stage agent 在 land 站沒有 commit 規則，mover 又被派去做 git write，結果 land 的提交繞過 commit.js；retro 提了四處修改，尚未套用
state: done
link: agents/fankeel-mover.md
done:
  at: 2026-10-21
  sha: 93c2e6dc
  disposition: done
  session: b7a7d8d4-46d0-4e7f-b839-06dbca750114
---

出處：2026-10-20 Trovara 任務 land 站的 retro。證據：Trovara 的 efc777b4 與 8583b1f9 由 fankeel-mover 直接 git commit，沒有 controller 讀過的 commit 檔，沒走 commit.js 的 commit.format 檢查與只提交列出路徑；bab68e42 才走 commit 檔、由 controller 執行。

現況：lib/stages.js:705 只讓 build、design、plan 拿到 COMMIT_RULE，land 沒有；agents/fankeel-brain.md:99 把 mover 派給「a move or a git write」，而 brain 自己的 Refusals（182-186 行）禁止自己 commit；agents/fankeel-mover.md 的 Refusals（33-37 行）沒禁 git commit 與 git add；skills/fankeel-land/SKILL.md 多處要求 commit 卻沒說誰提交。

retro 提出的四處修改，行號為 reader 核對過的現況，修改內容本身未驗證：(1) lib/stages.js:705 的清單加 'land'，land 的 mover 描述加 never to commit；(2) agents/fankeel-brain.md:99 把 mover 改成 a move, a merge or a deletion，Return 段加 land 站回 commit <path>；(3) agents/fankeel-mover.md Refusals 加 git commit 與 git add；(4) skills/fankeel-land/SKILL.md 加一段說明 stage agent 的 land 不自己 commit，寫 commit 檔交 controller。lib/stages.js 注入有字數上限，可能要與別處的字互換。

要決定的是四處全改，還是只改 mover Refusals 與 brain 第 99 行。完成判準：land 站有一條寫明怎麼提交的規則，mover 拒絕 git commit，且有一次 land 實跑只經 commit 檔提交。

## 完成紀錄

依使用者的選擇只改 mover 與 brain：mover 拒絕 git commit，brain 不再把 git write 派給 mover，提交一律走 commit.js。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-20-b7a7d8d4)

- commit 93c2e6dc
