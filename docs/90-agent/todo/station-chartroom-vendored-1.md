---
label: station-chartroom-vendored
title: station 白板改走 vendored
description: station 白板路由仍讀 profile 的 station.chartroom 外部路徑；vendored 的 chartroom 已在 repo，可改走它並拿掉該設定
state: ready
---

Found by the 2026-10-25 mermaid survey. Check first whether lib/chartroom has a server handler or only toSVG; if only toSVG, the route needs a small handler. See docs/90-agent/judgements/2026-10-25-mermaid-renderers-vs-chartroom.md
