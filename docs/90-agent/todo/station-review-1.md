---
label: station review
title: station 改版剩下的頁
description: Route mockups not yet reviewed or tuned when the 2026-10-21 station redesign went ahead; finish the review and port the result.
state: done
done:
  at: 2026-10-22
  sha: a600d646
  disposition: done
  session: 894981bb-1b15-4f8c-80e1-8b845632d0d3
---

起因：2026-10-22 使用者在 design 站逐頁調 mockup（.fankeel/build/2026-10-21-station-redesign/），睡前說「剩下的留著TODO 還沒改完…剩下全部幫我走完」。已定稿：首頁、進行中 A 版、全部 sessions、專案頁、session 頁（經過/派工/對話/落地 modal）、plan 關卡頁、導覽。沒看完的：(1) r-0062 使用者問 session 頁籤上的「關卡」連結（route-session.html 的 a.out → gate-land.html）為何常駐，判斷：只在有待答提問（gateAt）時出現，答完的提問看對話分頁；(2) session 頁頂端 session-head-dispatch 的派工小點仍是舊灰階，要換成派工分頁的模型色（light #7a4fd0/#d9601f/#7d8798，dark #8a70e6/#e06a2c/#5e6a80）；(3) route-focus-plan、route-spend、route-docs、route-settings、route-mobile 五頁還沒逐頁看；(4) 專案頁標「需新收資料」的四項：TODO 趨勢、逾期趨勢、TODO 開立日、放棄的任務，資料目前沒收。完成條件：五頁逐頁看過並定稿，(1)(2) 改進 mockup 與實作，(4) 決定收或不收。

## 完成紀錄

關卡連結與派工小點的實作早已改好，只把 mockup 對齊；使用者逐頁看，plan 關卡頁與花費頁定稿，文件、設定、手機三頁另開 Ready，專案頁四項資料決定不收. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-894981bb)

- commit a600d646
