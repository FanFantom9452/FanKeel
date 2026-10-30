---
label: station
title: gate 頁按鈕與測站一致
description: gate 頁的「選這個」按鈕和測站 keel 按鈕長得不一樣，有人說很醜
state: ready
link: assets/station/gate-frame.css
---

來源：2026-10-29 使用者問 Claude Desktop 側欄的按鈕樣式能不能調，判官紀錄在 docs/90-agent/judgements/2026-10-29-desktop-pane-button-style.md。gate 頁的「選這個」按鈕（.gq-pick）沒套 .btn，高 30px、用內陰影代替邊框，和測站其他 keel 按鈕（32px、1px 邊框、主按鈕有陰影）不一致，很可能就是被說醜的原因；判官附了 gate-frame.css 第 55-73 行的具體改法。Claude Desktop 自己畫的問答框和下一步框改不了樣式，只能改文字。要做成：先請使用者截圖確認被說醜的是哪一種按鈕，再照判官的改法把 gate 頁按鈕改成和測站一致。完成標準：gate 頁按鈕與測站 keel 按鈕外觀一致，附改前改後截圖。

進度：CSS 已在 58ad85d0 改成判官的做法（gate-frame.css:55-57、:71），tests/station-gate-pick-style.test.js 守住。改前改後截圖在 .fankeel/build/2026-10-30-station-65/before/render.png 與 after/render.png（git 不追蹤這個目錄）。還欠：使用者看過截圖，確認被說醜的是 gate 頁的按鈕；若是 Claude Desktop 自己的問答框，這條改成只調文字。
