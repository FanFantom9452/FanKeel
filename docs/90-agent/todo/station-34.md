---
label: station
title: station.css 的死樣式
description: 首頁改成四群後編輯版面按鈕與 kdash editing 樣式沒人用，station.css 還留著
state: done
link: assets/station/station.css
done:
  at: 2026-10-21
  sha: 0cbbc1cb
  disposition: done
  session: 9f451488-d5a6-4838-8cfc-9a451fd4f0e1
---

來源：2026-10-21 TODO 全表盤點 build 站，修三個過時測試時發現：首頁改成四群後，編輯版面按鈕與 dashboard 編輯模式已移除，但 assets/station/station.css 約 1803 到 1819 行與 1868 行仍在為它們設樣式。要做成：用 grep 確認沒有任何 JS 或頁面還產生這些 class，再刪掉死樣式，並跑 station 相關測試與 render 檢查確認頁面沒變。完成條件：station.css 不再含已移除元件的規則，suite 全綠。
