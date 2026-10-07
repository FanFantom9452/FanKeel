---
label: gate
title: Pane 上的 gate 介面
description: 依 2026-10-07 mod 重開決策的第五項：用 mod 的 Pane 顯示 gate 報告並能回答；動手前先讀 station 頁已有的 gate 面板，避免兩套
state: ready
link: assets/station/station.js
---

來源：docs/03-decisions/2026-10-07-mod-reopen.md 的第五項，取代 10-05 決策對終端與 Desktop gate 面板的否決。已知：Pane 在終端、Desktop、VS Code 與手機都能開，AbovePrompt 只在終端與 Desktop。station 頁在 gate.station 設成秒數時已有可回答的浮動面板（docs/90-agent/reference/station.md 的 Answering a gate from the page）。第一步：讀 station 的 gate 面板與 Pane 的型別，寫 design 決定兩者怎麼分工。完成條件：design 核准後另開 task 實作。共通規則：mod 沒載入時 gate 照舊用 AskUserQuestion。
