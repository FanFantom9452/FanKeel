---
label: gate
title: gate 通知框可拖曳縮放
description: 使用者要 station 網頁上的 gate 通知欄位能自由拖曳移動並拉動改變大小；gate-7 只涵蓋 gate 面板的分工設計，station.js 與 station.css 目前沒有任何拖曳或縮放程式
state: done
link: assets/station/station.js
done:
  at: 2026-10-15
  sha: daac0260
  disposition: done
  session: fda998ce-624c-4573-960f-ed4fcb937951
---

來源：2026-10-15 TODO 全表盤點時，使用者親口要求「GATE 在網頁上出現的那個通知欄位要可以自由拖曳、拉動大小」。已查：已完成的 gate-7 只處理 gate 面板與 Pane 的分工，station.js 與 station.css 目前沒有拖曳或縮放的程式，所以這是新工作。要變成什麼：station 頁的 gate 浮動面板可用滑鼠（最好也支援觸控）拖著標題列移動，並能從邊角拉動改變大小；位置與大小記在瀏覽器端，重新整理後保留，且不會被拖出視窗外。完成條件：測試涵蓋拖曳、縮放、重新整理後保留、視窗縮小時拉回可視範圍；回答 gate 的流程（輪詢、送出答案）不受影響；docs/90-agent/reference/station.md 的 Answering a gate from the page 補上這項行為。

## 完成紀錄

station 的 gate 浮動面板現在可以拖標題列移動、拖右下角把手改大小，位置與大小記在瀏覽器裡，重新整理後還在；視窗縮小或舊值放不下時會被拉回畫面內，雙擊標題列回到預設位置。右鍵按住不會拖動。這些都有測試，也在內建瀏覽器實際拖過一次。

- commit 7243bc65
- commit a2aae1d8
- commit 90a26bd2
- commit c7d91be0
- commit daac0260
