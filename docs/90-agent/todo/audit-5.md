---
label: audit
title: conversation.js 讀 sidechain
description: bundle 的 subagents 部分全讀成 0 turns，retro 看不到子 agent 內部
state: decision
---

來源：docs/90-agent/records/2026-10.md#x-2026-10-24 與 739fa960 retro：conversation.js 丟掉所有 sidechain 行，build brain 讀成 sidechain 131、0 turns；9f451488 retro 也因此無法確認 brain 是否跑過 gate-check。檔案：scripts/conversation.js。完成條件：retro 能讀出子 agent 的 turn 與工具呼叫。
