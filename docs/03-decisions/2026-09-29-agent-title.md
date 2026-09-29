---
status: decision
last_verified: 2026-09-29
---

# 派工標題的前綴由 hook 算（09-29）：決策紀錄

一句話：Agent／Task 派工的 `description` 開頭的 `<alias> <version> · <effort>` 改由 `hooks/title.js` 用 `updatedInput` 寫進去，LLM 只寫標題；版本從真的 `message.model` 解析，不從環境區塊推。

design 見 [../99-archive/2026-09-29-agent-title-design.md](../99-archive/2026-09-29-agent-title-design.md)，計畫見 [../99-archive/2026-09-29-agent-title.md](../99-archive/2026-09-29-agent-title.md)，實測見 [../90-agent/reports/2026-09-29-title-probe.md](../90-agent/reports/2026-09-29-title-probe.md)，現行說明見 [../90-agent/reference/subagents.md](../90-agent/reference/subagents.md)。

## 為什麼

session 7a23b26a 三個 agent 標題寫「sonnet 5」，transcript 的 `message.model` 全是 `claude-sonnet-5-5`。舊規則叫 LLM 從環境區塊推版本，而別名 `sonnet` 在 09-29 當天從 5 換到 5.5。

## 定了什麼

- 寫進去而不是擋下來：實測 `updatedInput.description` 不帶 `permissionDecision` 也生效，背景列表、tool result、`meta.json` 都拿到改寫後的標題；模型自己那一行 tool_use 留原文，所以它只寫標題，不會出現錯的版本。
- 模型順序：呼叫的 `model` > agent 檔 `model:` > `CLAUDE_CODE_SUBAGENT_MODEL` > 主 session。環境變數排在 agent 檔之後實測過一次。
- 版本：完整 id 直接解析；別名取本專案 subagent transcript 最新一筆同家族的 `message.model`（最多看 50 個檔）；找不到只寫別名。沒有版本表，Haiku 5.5 這類新型號不用改程式。
- 別的插件的 agent、讀不了的 agent 檔：不補前綴，因為那裡的模型無從得知。內建 `general-purpose`／`Explore` 標 `inherit`，取主 session 的模型。
- station 的 subagent 列顯示 transcript 最後一筆的 `message.model` 與 `effort`，作為真值。
- effort 單次拉高另開 TODO（`station-3`）：Agent 工具設不了 effort，改插件快取會被更新蓋掉。

## 沒做的

- 互動畫面上那一行 Agent 呼叫顯示什麼沒量（兩次都是 headless）。
- 環境變數順序沒有會紅的測試：TODO `title-1`。
