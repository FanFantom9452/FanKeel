---
label: station-chartroom-vendored
title: station 白板改走 vendored
description: station 白板路由仍讀 profile 的 station.chartroom 外部路徑；vendored 的 chartroom 已在 repo，可改走它並拿掉該設定
state: done
done:
  at: 2026-10-27
  sha: 9545d783
  disposition: done
  session: add1373d-aba2-45e0-8598-d8ece9d778bc
---

Found by the 2026-10-25 mermaid survey. Check first whether lib/chartroom has a server handler or only toSVG; if only toSVG, the route needs a small handler. See docs/90-agent/judgements/2026-10-25-mermaid-renderers-vs-chartroom.md

## 完成紀錄

白板路由直接畫內建的 Chartroom，唯讀，profile 不再有 station.chartroom. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-26-add1373d)

- commit 9545d783
- commit 6205f68e
- commit fd164976
