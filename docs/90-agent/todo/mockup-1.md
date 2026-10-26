---
label: mockup
title: mockup 參考 design skill
description: 以 taste-skill、impeccable、designer-skills 的規則為參考重做 fankeel-mockup；對照頁已畫、162 塊全留，剩 17 列矛盾選邊與收錄
state: ready
link: agents/fankeel-mockup.md
stamp: 2026-10-27
---

來源：2026-10-27，使用者看完 plugin 使用量分析（docs/90-agent/judgements/2026-10-26-skill-usage-trim.md）與 taste-skill 的指令說明後說：「TASTE SKILL 還有剛剛那些 DESIGN 相關 SKILL 記錄到 TODO 之後用於我們的 MOCKUP AGENT 我們參考他們的腳本去重新設計 然後我還需要 先知道他們想要排除那些樣是 要先繪製出來給我看 那些是他們希望排除的設計 那些是他們收錄的設計 我要看過 決定哪些可以留下那些不行」。

參考來源（已裝在本機，只讀不執行）：taste-skill 2.1.5（~/.claude/plugins/cache/taste-skill/taste-skill/2.1.5/skills/taste-skill/：references/tells.md 是排除清單，House rules 與 Laws of the craft 在 SKILL.md:382-475，收錄的方向、配色、字體在 library/*.json，腳本 scripts/draw.mjs、lint.mjs、inspect.mjs、assets.mjs、scenes.mjs）；impeccable 4.7.1（~/.claude/plugins/cache/impeccable/impeccable/4.7.1/skills/impeccable/：SKILL.md、reference/、scripts/）。已移除的 frontend-design、designer-skills 若要比對需另取來源。

順序：
1. 先畫對照頁：一頁 HTML，左欄「它們排除的樣式」（taste-skill 的 tells 與 house rules、impeccable 的反模式），右欄「它們收錄的樣式」（directions、palettes、type、sections），每一項實際畫出來並標出處 path:line。使用者逐項標「留／不留」，結果寫成檔。
2. 依使用者留下的清單重新設計 agents/fankeel-mockup.md 與它的檢查：draw／lint／inspect 哪些概念要做成 fankeel 自己的零依賴腳本。不直接 vendor 外部程式碼，授權另查。

第 1 步已完成（2026-10-27，session feb572cd）：對照頁 .fankeel/build/2026-10-27-design-skill-catalog/mockup.html（由同目錄 build.cjs 從 items-ex.cjs、items-in.cjs、items-d.cjs 產生；.fankeel/build/ 不進 git，只在這台機器上），survey 在 .fankeel/build/task-20261026T184518/survey.md。使用者另要求加入 designer-skills（MIT，MC Dean；Owl-Listener/designer-skills，26 個 SKILL.md 原文存於 .fankeel/build/2026-10-27-designer-src/，盤點在對照頁目錄的 designer-skills.md），它補的是互動與狀態規則（載入時長分級、點擊區 44/48/24、狀態無死路、undo 取代確認、CTA 不放中間）與 ui-design 系統。左欄排除 69 塊、右欄收錄 93 塊，使用者兩次都說全部留：決定在同目錄 decisions.md（162 塊皆「留」）。「互相矛盾」那塊 17 列（例：內文最小字級 16 vs 12px、1px 列線、字體數量、照片上的字加模糊、巢狀容器）尚未選邊，收錄前要逐列問使用者。

第 2 步建議的做法（使用者尚未核准）：
- 目錄：skills/fankeel-design/catalog/ 下以 JSON 存排除與收錄，每項帶來源；只在 mockup agent 畫圖時讀，不進每回合注入的規則。taste-skill 與 designer-skills 為 MIT，借用保留版權聲明；impeccable 授權標示不一致，只借概念、改寫。
- 檢查：零依賴的 scripts/design-lint.js，mockup HTML 出現排除樣式就失敗——即下面完成條件要的那個測試。
- 收錄：mockup agent 從目錄挑配色、字體、App 風格、方向（類似 taste-skill draw.mjs 的概念，自己寫）。
- skills/fankeel-design/design-guide.md（8.3k 字元）只加一行指到目錄與檢查腳本。

完成條件：對照頁使用者看過，逐項決定寫成檔；mockup agent 的新規則只收使用者標「留」的項目，且有一個測試在任一被排除的樣式出現時轉紅。
