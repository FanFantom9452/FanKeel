---
label: spend
title: 新模型出來後站上不計它的花費
description: `lib/prices.js` 的價目表照完整模型 id 查，新 id（如 `claude-fable-5-5`、`claude-haiku-5-5`）沒有對應列就標 unpriced，美元不計
state: decision
link: lib/prices.js
---

來源：2026-10-06 TODO 全表盤點 task 中，使用者回報另一台電腦遇到新模型時，站上沒有記到該模型的花費。查證：lib/prices.js 的 rateFor 只去掉結尾的 -YYYYMMDD 再比對，表裡沒有的 id 由 costOf 列進 unpriced，不算進美元；token 本身照 message.model 原樣記在 usage.models（lib/usage.js:107），站上產生頁面時才換算（lib/station.js:477、498），所以補上價目列後舊紀錄會一起算出美元。另一台若裝的版本早於 09-24（Opus 5.5）或 09-29（Sonnet 5.5）也會出現同樣狀況。要決定的是：維持新模型上市就手動補一列，或對不認得的 id 用同家族最新一列估價並在站上標「估」（Fable 5 與 5.1 的 cacheRead 差 4 倍，估價可能偏差）。完成條件：選定其中一種；若選估價，站上與 scripts/spend.js 對估價列有明確標示，tests/prices.test.js 涵蓋未知 id 的行為。
