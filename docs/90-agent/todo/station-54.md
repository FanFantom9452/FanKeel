---
label: station
title: station.css 的死樣式
description: 設定精靈與文件卡刪掉後，assets/station/station.css 約 378 行 `.wz` 與 `.dsx*` 規則已無人用，待移除
state: ready
link: assets/station/station.css
---

設定精靈與 dsx（文件卡）刪掉之後，assets/station/station.css 約 378 行成了死樣式：`.wz` 規則約在 :917-1276，`.dsx*` 規則約在 :1595-1612。已先 grep assets/station、lib、scripts、tests：沒有任何程式或 html 還用 `wz`／`dsx` 當 class 名；只剩 tests/station-dead-wizard.test.js 與 tests/station-routes-docs-settings.test.js 以字串斷言這些名字已不存在。`split-*` 規則（約 :253-260）要保留，因為 assets/station/docs-page.js 用到 `split-bar`。完成條件：上述 `.wz`、`.dsx*` 規則移除，整個測試套件全綠。來源：2026-10-24 build 的 review，對應 plan docs/90-agent/plans/2026-10-24-station-docs-settings.md。這一輪不刪 CSS，只記下來。
