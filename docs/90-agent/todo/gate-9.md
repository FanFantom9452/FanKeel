---
label: gate
title: gate 通知框可拖曳縮放
description: 使用者要 station 網頁上的 gate 通知欄位能自由拖曳移動並拉動改變大小；gate-7 只涵蓋 gate 面板的分工設計，station.js 與 station.css 目前沒有任何拖曳或縮放程式
state: ready
link: assets/station/station.js
---

來源：2026-10-15 TODO 全表盤點時，使用者親口要求「GATE 在網頁上出現的那個通知欄位要可以自由拖曳、拉動大小」。已查：已完成的 gate-7 只處理 gate 面板與 Pane 的分工，station.js 與 station.css 目前沒有拖曳或縮放的程式，所以這是新工作。要變成什麼：station 頁的 gate 浮動面板可用滑鼠（最好也支援觸控）拖著標題列移動，並能從邊角拉動改變大小；位置與大小記在瀏覽器端，重新整理後保留，且不會被拖出視窗外。完成條件：測試涵蓋拖曳、縮放、重新整理後保留、視窗縮小時拉回可視範圍；回答 gate 的流程（輪詢、送出答案）不受影響；docs/90-agent/reference/station.md 的 Answering a gate from the page 補上這項行為。
