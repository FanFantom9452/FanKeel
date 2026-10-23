---
label: station
title: 進行中頁停了的列缺清除鈕
description: station-live-maybe 只改了 nowHtml 備援，實際載入的 live-page.js 的 stop 卡片沒有每列 clear。
state: done
done:
  at: 2026-10-23
  sha: 377a5202
  disposition: done
  session: 53b0565d-b2ca-45b3-ad53-dda251c5e46b
---

整批盤點的全分支審查發現：assets/station/index.html:29 一律載入 live-page.js，VIEWS.now 與 VIEWS.live 只有在 FK_LIVE 不存在時才走 nowHtml，所以 station-live-maybe 只改到備援頁，tests/station-live-maybe.test.js 又直接呼叫 nowHtml，紅綠都看不到 live-page。要把每列的清除控制放進 live-page.js 的 stop 卡片（列在 a.sxr 之外），補 live-page.css 與字串表，並改 docs/90-agent/reference/station.md 的 867 與 1241 行。完成的標準是已服務的 #/live 頁面上，停了的列有 clear，且有一個測試走 FK_LIVE.page 並在拿掉該控制時變紅。

## 完成紀錄

已服務的 live-page.js 停了的列各有 clear，測試走 FK_LIVE.page

- commit 268ef831
- commit 377a5202
