---
label: station
title: station 拿掉 eyebrow 邊條
description: guide 與兩個外掛都禁 eyebrow 與超過 1px 的色邊條；station.css:106 的 .eyebrow（station.js:2499 在用）與 station.css:99 的 .dead 3px 左邊條要改
state: done
link: assets/station/station.css
stamp: 2026-10-27
done:
  at: 2026-10-27
  sha: 9a7d2bb8
  disposition: done
  session: 94e42e71-74f5-4d2a-915f-706817066f02
---

來源：2026-10-27 使用者在 17 列矛盾的第 9 列選「規則照禁，station 另開 TODO 之後改」（docs/90-agent/plans/2026-10-27-design-catalog-design.md 第 5 節）。完成條件：station.css 不再有 text-transform:uppercase 加字距的 .eyebrow 與 border-left:3px 的 .dead，並由使用者在真機上看過一次。

2026-10-27 手機驗證：使用者用手機（Android Chrome，經 tailnet 開 sh-pro6000）截了 /m 的 session 列表和 session 詳情兩張圖（.fankeel/build/task-20261027T000808/phone/92f4172e-image.jpg、.fankeel/build/task-20261027T000808/phone/baceb557-image.jpg）。列表上「在跑 2」這個區段小標是一般字重、沒有大寫字距的拉開感；畫面上沒有過期/失聯的 session，所以過期提示列（`.dead`）的左側邊條在手機上這次沒看到，未驗。本條未結。

2026-10-27 手機驗證（第二次）：使用者以飛航模式讓 /m 出現 `.dead` 提示列，左側無邊條，只有底色與文字；區段小標非大寫字距。完成條件成立，land 時結案。

## 完成紀錄

使用者在真手機上看過：連不到時沒有邊條，小標不是大寫，可以結案。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-27-94e42e71)

- commit 9a7d2bb8
