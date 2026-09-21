---
status: decision
last_verified: 2026-09-22
---

# 站 agent 改用 Sonnet，design 與 plan 留給 Opus — 決策紀錄

使用者 2026-09-22 開了跑：每一站都交給 Sonnet 的站 agent，Opus 只留給判官與關鍵處。
設計見 [../plans/2026-09-21-all-stages-brain-design.md](../plans/2026-09-21-all-stages-brain-design.md) 的 §6，
計畫見 [../plans/2026-09-21-all-stages-brain-held.md](../plans/2026-09-21-all-stages-brain-held.md)。
這份只取代 [2026-09-20-survey-brain.md](2026-09-20-survey-brain.md) 第一節第二列（「主控與站 agent 怎麼分工」）裡
站 agent 用 Opus 的那個**模型**選擇；分工本身——判斷留在讀了整站的那一邊，主控只照檔案執行——不動。

## 一、定案

| 問題 | 定案 | 為什麼 |
|---|---|---|
| 站 agent 用哪個模型 | `agents/fankeel-brain.md` 釘 `model: sonnet` | 使用者的要求：Opus 只用在關鍵處 |
| 哪兩站例外 | design 與 plan：主控派工時傳 `model: opus`；其餘五站不傳 model | 這兩站的產出就是判斷（要做什麼、拆成哪些 task），後面每一站都吃它們的輸出 |
| 例外放在哪 | 主控的派工規則（`lib/stages.js` 的 `controlRules`），不放在 agent 檔 | agent 檔只能釘一個模型；派工時傳的 `model` 蓋過它——出處是 Agent 工具自己的 `model` 參數說明：「takes precedence over the agent definition's model frontmatter and the configured default subagent model」。一站一條規則，`tests/stages.test.js` 釘住 |

## 二、沒量過的

- **Sonnet 站 agent 沒有量過。**2026-09-20 的 A/B 與之後所有量測用的都是 Opus 站 agent；換了模型，`docs/subagents.md` 裡的成本與品質數字都不能直接套用。
- **派工傳的 `model` 蓋過 agent 檔這件事，只有工具的文件這樣說，這個 repo 沒有探測過。**跑完之後，該 session 的 `modelUsage` 會顯示每一個站 agent 實際用了哪個模型。
- 量測在發版之後：使用者把 `stage.agents` 設成 `all` 跑一個真實 task，用 `node scripts/ctx.js <session> --by-stage` 與該 session 的 `modelUsage` 讀；門檻沿用設計的主控至多 60 turns、最後一關低於 200k。這一份不預設結果。
- 要回頭：把 `agents/fankeel-brain.md` 的 `model` 改回 `opus`，並拿掉 `controlRules` 那一行的 `model: opus` 分支；`tests/agents.test.js` 與 `tests/stages.test.js` 各有一個測試釘住現在的樣子，會跟著紅。
