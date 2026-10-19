---
label: compact
title: SBIR 沒套到 compact.at 350K
description: SBIR 的主 session 峰值落在 414–420K,沒有在 compact.at 壓縮,要讓沒開任務的 session 也套用同一個值。
state: blocked
link: lib/profile.js
group: 一週後重量花費
timing: on: 10-27
stamp: 2026-10-20
---

來源:2026-10-19 的一週 token 花費判斷(連結的 judgement)。本週前 10 貴的 session 有 9 個峰值 414–420K,多數在 F:/ymlab/SBIR。docs/03-decisions/2026-10-14-start-syncs-window.md 記載 CLAUDE_CODE_AUTO_COMPACT_WINDOW 只在開 /fankeel 任務時同步、全機共用、最後開的贏;F:/ymlab/SBIR/.claude/settings.local.json 沒有這個鍵。要做:查全域 settings.json 的實際值,以及 SBIR 沒開任務的 session 實際吃哪個值,讓沒開任務的 session 也落在 compact.at。完成的標準:改完重量一週後,SBIR 主 session 的峰值不超過 compact.at 加一個回合。

2026-10-20 落地：機器 profile 的 compact.at 設為 350000，F:/ymlab/SBIR/ProjectWorkspace 的 .claude/settings.local.json 補上同一個值（SBIR 主 session 實際從 ProjectWorkspace 開）。已開的 SBIR session 要重開 Claude Desktop 才會套用。2026-10-27 重量一週峰值。
