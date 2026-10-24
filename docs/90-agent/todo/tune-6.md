---
label: tune
title: tune 抓不到點了才出現的元素
description: tune 的逐塊調整只看得到當下 DOM 裡的元素，點開才出現的 modal 或下拉選不到
state: done
link: assets/tune/overlay.js
done:
  at: 2026-10-24
  sha: b1822166
  disposition: done
---

來源：2026-10-22，使用者在 TODO 全表盤點的 Task 12（逐塊定稿文件頁 mockup）用 tune 檢視時說：「有些畫面是要 點開某個元件 出現某個 MODAL 或是下拉 那種 點下去才出現的元素 我們的逐塊調整就抓不到」。目前的情況：選取器只認得當下 DOM 裡已有的元素（assets/tune/overlay.js 的 pickable 在 209 行附近，點擊處理在 698-724 行），所以由點擊或下拉才展開的 modal 無法被選取，也就無法對它送出調整需求；要修很可能也得動 scripts/tune.js 177-187 行送出時的區塊查找。最接近的既有條目 station-review-1 只把 session 頁的 modal 列為待檢視的頁面，並沒有記錄這個工具缺口。應變成什麼：在 tune 檢視裡可以先操作頁面讓元素出現，再選取它。完成的標準：在 tune 檢視中點開一個 modal 或下拉後，能選取其中的元素並針對它送出調整需求，且有測試覆蓋這個流程。

## 完成紀錄

tune 檢視可以先點開 modal 或下拉，再圈選裡面的元素並送出調整需求，送出時借用開啟它的元素的 block；在真實瀏覽器的 dialog 裡圈選還沒驗過。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-24-d5098a7f)

- commit 48aeeb36
- commit b1822166
