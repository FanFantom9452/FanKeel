---
label: station
title: 骨架依版型分家
description: LOADING 骨架依畫面版型分家：hash 決定 data-skel，CSS 畫三種版型
state: ready
link: docs/90-agent/reference/station.md
---

來源：2026-10-23 使用者回報 LOADING 的骨架和實際畫面差距很大，問能不能每個畫面設計一個骨架。判斷記錄在 docs/90-agent/judgements/2026-10-23-station-skeleton-stack.md（Q1 選 C）。現況是 assets/station/station.css:1387-1415 的 #page:empty 規則，CSS 讀不到 hash，所以首次載入永遠畫儀表板的版型；深連結 #/sessions、#/s/<id>、#/settings 之後會換成另一頁，差距就出在這裡。

應該變成：assets/station/index.html:26 的 inline script 在請求 station-data.js 之前，依 location.hash 把 data-skel 設在 #page 上，值為 list、detail、form 三種之一，儀表板為預設（不設）。對應如下：sessions、projects、docs、days、list、cmp 用 list；#/s/ 與 #/p/ 用 detail；settings 用 form。station.css 在儀表板骨架旁邊並排三條變體 #page:empty[data-skel=list]、[data-skel=detail]、[data-skel=form]，各畫該版型的粗略形狀。不做逐畫面手刻骨架（A），也不從 render 函式派生（B），理由見判斷記錄。

完成的標準：(a) index.html 的 inline script 在 station-data.js 被請求前設好 data-skel；(b) station.css 有三條版型變體，儀表板仍是預設；(c) 一個測試讀 index.html，斷言 #/sessions、#/s/x、#/settings 分別對應到 list、detail、form；另一個測試讀 station.css，斷言每個版型各有一條規則；(d) station-data.js 延遲時，#/sessions 與 #/s/<id> 的渲染截圖顯示版型形狀，而不是儀表板。
