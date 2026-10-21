---
status: decision
last_verified: 2026-10-22
---

# 監控站首頁改成「進行中」（10-22）

一句話：`#/` 和 `#/live` 都開「進行中」頁，分成等你回答、正在跑、可能停了三組；取代 10-21 的四塊首頁，一層導覽不變。

設計在 [90-agent/plans/2026-10-21-station-redesign-design.md](../90-agent/plans/2026-10-21-station-redesign-design.md) §1。

## 決定

- 首頁是 `assets/station/live-page.js` 的「進行中」頁，三組：等你回答／正在跑／可能停了。
- `#/` 和 `#/live` 都由 `assets/station/station.js` 的路由（約 :5718）送到這一頁。
- [2026-10-21-station-focus](2026-10-21-station-focus.md) 的四塊首頁不再用；那份的一層左側導覽照舊。

## 為什麼

使用者 2026-10-21／22 逐頁審過改版（tune r-0001…r-0062），最後定下的首頁是 route-live-a。
