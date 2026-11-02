---
label: compact
title: Desktop 閒置壓縮的分工
description: CC 2.1.314 的 Desktop 閒置壓縮會先於 compact.at 350000 以上的值觸發，文件與設定頁要寫明分工。
state: ready
link: docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md
---

來源：judgement docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md（Claude Code 2.1.300–316 更新日誌盤點，2026-11-02）。2.1.314 changelog :66 讓 Desktop／VS Code 在 200K+ 對話閒置、prompt cache 過期時先用摘要壓縮，可由 /config 關閉；2.1.302 :639 的 auto mode 過長壓縮與 2.1.311 :231 的 200K 壓縮續跑也是外部壓縮觸發。影響 lib/profile.js:56（compact.at）、:53（gate.away）、hooks/compact.ts:149-159、skills/fankeel/SKILL.md:817-829。要做成：文件寫明 compact.at 350000 以上只在使用者沒離開時才輪到，init 或設定頁建議關 Idle compaction 或接受；連 spend-6。完成條件：上述文件與 SKILL 段落更新，並註明沒 1M 的帳號 compact.at 在 350000 以上永不先觸發。
