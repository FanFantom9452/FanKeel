---
label: station
title: 看第 7 段加的 station 欄位
description: 看第 7 段加的 station 欄位：沒有任何 subagent 的 context 峰值超過 450k（基準 f44b1c61 的 544k）、最貴的單一 subagent 佔 subagent 總花費低於 15%（基準 31%） — [station.md](docs/90-agent/reference/station.md).
state: ready
link: docs/90-agent/reference/station.md
---

## 量測 2026-09-29

截止點 commit e704bd7e（2026-09-29 08:35 +0800）之後，符合條件的 session 共 11 個。

- (a) 沒有任何 subagent 的 context 峰值超過 450k：最高 365,664，在 session e4ddebcd-fa34-4b88-a749-3a5d1fa65a9f。通過。
- (b) 最貴的單一 subagent 佔 subagent 總花費低於 15%：最高 51.4%，在 session 3f0d6e25-6c3e-40a5-8c97-1200aca364c7；10 個有價格的 session 只有 3 個低於 15%。未通過。

條目維持 `ready`。下一步：查 session 3f0d6e25-6c3e-40a5-8c97-1200aca364c7 裡那一個 agent 為什麼佔了這個 session subagent 花費的一半。
