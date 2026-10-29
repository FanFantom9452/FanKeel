---
label: station
title: 未登記卡片與設定頁待真機驗
description: 10-26 盤點落地的兩個畫面，有幾處只在桌機或測試裡看過
state: done
done:
  at: 2026-10-29
  sha: b9f69356
  disposition: done
  session: 94d22511-72b4-4393-8bf9-27f6147fc3e5
---

10-26 盤點（紀錄 docs/90-agent/records/2026-10.md#r-2026-10-26-add1373d）落地的未登記卡片與設定頁 全域｜個別 切換，以下沒驗：(1) 未登記卡片右側欄位在 412 與 390 寬度；(2) 卡片說明「開著、但沒跑過 /fankeel 的 session」對已結束但仍掛 Remote Control 的 session 不準，要改字；(3) unreg() 沒帶 name，名稱等於資料夾名的 session 也會被淡化；(4) 設定頁全域面的 global-foot 區塊、在專案選擇器裡打字過濾；(5) 設定頁 CSS 在真手機。完成標準：五項各有截圖或改好並附測試。

進度（2026-10-27）：(2) 卡片說明改成「還開著、fankeel 沒在追的 session」，title 寫明「沒跑過 /fankeel 的，或 fankeel 裡已結束、仍掛著 Remote Control 的」；(3) `unreg()` 帶 `name`，只有沒名字的列淡化。兩項的測試在 tests/station-live-unregistered.test.js。(1)、(4)、(5) 待使用者真機驗。

真機驗（2026-10-27，Task 10，截圖在 .fankeel/build/render/station-58/）：
- (1) 通過：412x915 與 390x844 下未登記卡片寬 380 / 358，scrollWidth 相等，沒有子元素超出，頁面無橫向捲動；cwd、閒置、開始各自換行。畫面上沒有過長的 cwd，所以沒看到省略號。截圖 .fankeel/build/render/station-58/1-unreg-412.jpg、.fankeel/build/render/station-58/1-unreg-390.jpg。
- (2) 通過：卡片標題「還開著、fankeel 沒在追的 session」，title「沒跑過 /fankeel 的，或 fankeel 裡已結束、仍掛著 Remote Control 的」。截圖同 .fankeel/build/render/station-58/1-unreg-412.jpg。
- (3) 通過：3 列未登記 session 都帶名字（Trovara查核點報告WORD、FSC_RECALL、核對所有ILS…），皆為 .hm-lv-t 且沒有 .un，顏色 rgb(230,234,240)。當下沒有無名字的列可對照，也沒跑 /rename。截圖同 .fankeel/build/render/station-58/1-unreg-412.jpg。
- (4) 通過：全域面 foot 讀「跟現在一樣，沒有要改的」，把手機遠端改成關後變「有 1 項要改 / 寫入 1 項」，改回後復原（沒有寫入任何東西）。個別面 picker：輸入 f→fank 焦點不掉、不收合，清單由 10 筆縮到 1 筆（fankeel）。截圖 .fankeel/build/render/station-58/4-global-foot.jpg、.fankeel/build/render/station-58/4-picker.jpg。
- (5) 失敗（使用者在手機上驗）：「掃描QRCODE 如果不掃描 手機沒有按鈕跳轉回去」。從手機要回到完整 station 的設定頁，必須掃 QR code；不掃的話手機上沒有任何按鈕能回去。無截圖。

未解（新缺陷，開著）：手機端沒有不經 QR code 就能回到完整 station 設定頁的按鈕。要補一個入口，並在真機上再驗 (5)。此條保持開著。

入口已補（2026-10-28）：手機測站面板有「到完整測站的設定頁」連結，經 /?full=1，需已配對；完整頁有「回手機版」。(5) 仍須在真機上再驗，此條保持開著。

真機驗（2026-10-29）：使用者在真手機上重驗 (5)，答「通過」。重驗前補了兩個修正：a93f4249 讓手機首頁有看得見的「到完整測站的設定頁」按鈕；b9f69356 修好已配對手機的完整頁載入 15 秒後凍結（健康檢查 station/health 在 tailnet 上被 remote.policy LOCAL 擋成 403，完整頁卻把載入時間當最後一次成功）。結果：按鈕開得到完整設定頁、不再變灰，「回手機版」回得到 /m，(5) 通過；五項全過，此條留給 land 的 `todo.js done` 關閉。未處理的發現：設定頁內容在 390 寬的 viewport 下比畫面寬，尚未查是哪個區塊，也未開條目。

## 完成紀錄

五項都已驗過：第 5 項補了手機首頁到完整設定頁的按鈕，也修好完整頁 15 秒後凍結，使用者在真手機驗過。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-29-94d22511)

- commit a93f4249
- commit b9f69356
- commit 39cb538c
