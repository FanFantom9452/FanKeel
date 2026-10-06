---
label: build
title: review 檢查寫進 build skill
description: 五輪 verify 退回 build 時，controller 在 prompt 加的 review 檢查沒寫進 build skill，下個 task 不沿用
state: ready
link: skills/fankeel-build/SKILL.md
---

來源：2026-10-06「lib/prices.js 價目表補上新模型 id 的查法」task（session 85694ff7-b427-49cc-bc98-e97ff4236b76），verify 退回 build 五次，每次 controller 依 task.js 的 second return 提示，在 build stage agent 的 prompt 多加一行 review 檢查，但都只活在那一輪。五項：(1) review 找到會推翻 verify 列的缺口當場修，不延後到 gate；(2) 新加的資料欄位在每個顯示面都有讀者；(3) 新字串走 i18n，不寫死；(4) 盤點整個 repo 每個顯示被改動值的地方（頁面與 CLI 都算），不限一個檔，每處標記都有經呼叫端渲染、移除就轉紅的測試；(5) 稱為「本次之前就有」的 docs-check 列，先在基準 commit 上核對。要變成：fankeel-build skill review 段落裡的通用規則（不綁 estimated），各附日期與事件，比照該段既有寫法。完成條件：五項寫進 skill，或判定已有並引用原句；skills-check 與全套測試通過。
