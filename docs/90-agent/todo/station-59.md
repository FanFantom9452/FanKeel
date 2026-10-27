---
label: station
title: station 拿掉 eyebrow 邊條
description: guide 與兩個外掛都禁 eyebrow 與超過 1px 的色邊條；station.css:106 的 .eyebrow（station.js:2499 在用）與 station.css:99 的 .dead 3px 左邊條要改
state: ready
link: assets/station/station.css
stamp: 2026-10-27
---

來源：2026-10-27 使用者在 17 列矛盾的第 9 列選「規則照禁，station 另開 TODO 之後改」（docs/90-agent/plans/2026-10-27-design-catalog-design.md 第 5 節）。完成條件：station.css 不再有 text-transform:uppercase 加字距的 .eyebrow 與 border-left:3px 的 .dead，並由使用者在真機上看過一次。

2026-10-27 手機驗證：使用者用手機（Android Chrome，經 tailnet 開 sh-pro6000）截了 /m 的 session 列表和 session 詳情兩張圖（.fankeel/build/task-20261027T000808/phone/92f4172e-image.jpg、.fankeel/build/task-20261027T000808/phone/baceb557-image.jpg）。列表上「在跑 2」這個區段小標是一般字重、沒有大寫字距的拉開感；畫面上沒有過期/失聯的 session，所以過期提示列（`.dead`）的左側邊條在手機上這次沒看到，未驗。本條未結。
