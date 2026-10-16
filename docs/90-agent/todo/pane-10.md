---
label: pane
title: Pane 底部的 TODO 跳轉按鈕
description: Pane 底部加一顆按鈕，直接開到 station 上該專案的 TODO 清單
state: ready
---

來源：2026-10-16 TODO 巡檢（agent-tokens）時使用者提出「PANE 最底下再顯示 TODO，按下按鈕可以快速跳轉到那個專案網頁的 TODO LIST，讓 PANE 都有跳轉功能」，當場選擇先登記、不在該次巡檢內做。現況：Pane 底部只有一顆 station 按鈕，即 hooks/pane-status.ts 的 stationRow（{ text: '開啟 station', press: 'station' } 加上 url），開的是 station 根頁。station 已有每專案的 TODO 面板 todoPanelHtml（assets/station/station.js，<section class="panel td" id="todo">），位於專案頁 #/p/<pkey>（projectHash）；目前沒有 #/todo 路由，#/p/<pkey> 是否會捲到 #todo 也尚未確認。應變成：Pane 底部再多一顆按鈕，例如「TODO」，開啟 station 上此任務所屬專案頁並落在其 TODO 面板；Pane 要知道專案的 pkey（如何取得尚未查證），station 可能需要新增路由或錨點才能落到該面板。完成條件：在 Desktop 按下按鈕後，station 開在該專案的 TODO 清單；tests/pane.test.js 有測試顯示 $.process.run 收到該 url；station 的測試顯示該路由會落在 TODO 面板。

2026-10-17 Desktop 真機（0.111.14）：使用者展開 TODO、點一條標題，station 開在本專案的 TODO 面板並捲到那一條，正常。
