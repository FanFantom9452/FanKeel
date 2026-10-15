---
status: decision
last_verified: 2026-10-16
---

# TODO 全表盤點（10-16）：做了什麼、沒做什麼

一句話：兩條要真機的條目寫成照著做的探測清單，兩條 Blocked 解除改成 Ready，另兩條 Blocked 寫入今天的查證；只改條目檔，沒有結案任何一條，整套 4368 個測試通過。

計畫在 [2026-10-16-todo-patrol-probes.md](../../../99-archive/2026-10-16-todo-patrol-probes.md)。

## 起因

使用者在開任務時選了 TODO 全表盤點。survey 查完 25 條：Ready 的六條全部要使用者在真機上動手，這個 session 做不了。survey 的關卡上，使用者選了另外替其中兩條寫探測步驟，所以路線加上 design。design 的關卡上，使用者問 Blocked 與 Watch 是不是都看過；survey 有三條沒查到底，使用者選了先補查。

## 做了什麼

- 「子代理 brief 改走 spawn」加了六步的探測清單：重用 10-03 的探針、在終端按 Enable、派三個子代理看 transcript 第一行、試一次對執行中子代理的 session.append。
- 「接縫『profile 中途翻轉』」加了四步的探測清單：讓站 agent 跑非 survey 的站，跑到一半從站頁把它移出 stage.agents，逐一看 inject、brief、gate、resume、guard 讀到哪一份設定。
- 「Desktop 看路線圓點呼吸」改成 Ready：0.111.2 已經裝好，等待的發版條件滿足了。
- 「brain 的 context 撐不住」改成 Ready：10-09 有一個 plan 站的站 agent 量到 439,419，過了 400k 的線。原本條件只看 build 與 verify，使用者在 design 的關卡上決定任一站都算。
- 「fast 可依 agent 設定」與「AI CODING SECURITY 定案」重查後都還沒解除，寫入今天的查證與日期。

build 有一條修了兩輪：探測清單裡的指令多帶了一個沒有值的 `--project`，指令照抄會被拒；收尾時 docs-check 又發現四處引用的行號和引號配錯對象。兩輪都回 build 修好、各自審過。verify 的對抗審查推翻三列證據，三列都當場補跑了證據，沒有東西要退回 build。

## 沒做什麼

- Ready 的六條都沒做，也沒有結案；它們都要使用者的真機或互動式 session。
- 其餘 Blocked 與 Watch 條目查過但沒有新事實，不改它們的日期。
- 「brain 的 context 撐不住」要寫的程式（由 script 產出 build 的 workflow）沒有寫，留給下一次盤點。
- 338,010 那份站 agent 紀錄是哪一站沒查；條件已經滿足，不影響結果。
- 這次只改條目檔，沒有改到外掛會載入的程式或技能，所以沒有發新版本。
