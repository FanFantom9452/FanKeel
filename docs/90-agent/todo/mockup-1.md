---
label: mockup
title: mockup 參考 design skill
description: 以 taste-skill、impeccable 的腳本與規則為參考重做 fankeel-mockup；先把它們排除與收錄的樣式畫成對照頁給使用者逐項定奪
state: decision
link: agents/fankeel-mockup.md
stamp: 2026-10-27
---

來源：2026-10-27，使用者看完 plugin 使用量分析（docs/90-agent/judgements/2026-10-26-skill-usage-trim.md）與 taste-skill 的指令說明後說：「TASTE SKILL 還有剛剛那些 DESIGN 相關 SKILL 記錄到 TODO 之後用於我們的 MOCKUP AGENT 我們參考他們的腳本去重新設計 然後我還需要 先知道他們想要排除那些樣是 要先繪製出來給我看 那些是他們希望排除的設計 那些是他們收錄的設計 我要看過 決定哪些可以留下那些不行」。

參考來源（已裝在本機，只讀不執行）：taste-skill 2.1.5（~/.claude/plugins/cache/taste-skill/taste-skill/2.1.5/skills/taste-skill/：references/tells.md 是排除清單，House rules 與 Laws of the craft 在 SKILL.md:382-475，收錄的方向、配色、字體在 library/*.json，腳本 scripts/draw.mjs、lint.mjs、inspect.mjs、assets.mjs、scenes.mjs）；impeccable 4.7.1（~/.claude/plugins/cache/impeccable/impeccable/4.7.1/skills/impeccable/：SKILL.md、reference/、scripts/）。已移除的 frontend-design、designer-skills 若要比對需另取來源。

順序：
1. 先畫對照頁：一頁 HTML，左欄「它們排除的樣式」（taste-skill 的 tells 與 house rules、impeccable 的反模式），右欄「它們收錄的樣式」（directions、palettes、type、sections），每一項實際畫出來並標出處 path:line。使用者逐項標「留／不留」，結果寫成檔。
2. 依使用者留下的清單重新設計 agents/fankeel-mockup.md 與它的檢查：draw／lint／inspect 哪些概念要做成 fankeel 自己的零依賴腳本。不直接 vendor 外部程式碼，授權另查。

完成條件：對照頁使用者看過，逐項決定寫成檔；mockup agent 的新規則只收使用者標「留」的項目，且有一個測試在任一被排除的樣式出現時轉紅。
