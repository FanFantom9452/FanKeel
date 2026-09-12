---
status: current
last_verified: 2026-09-13
source_of_truth: .claude-plugin/plugin.json, lib/stages.js, skills/fankeel-explain/SKILL.md
---

# fankeel 不再出貨 output style — 決策

**決定**：2026-09-13 起，fankeel 不出貨任何 output style。Claude Code 留在 Default；fankeel 的語氣只從提示詞來——每個 prompt 注入的 stage 規則與 `output shape:`，以及按需載入的 `fankeel-explain` skill。

## 當初為什麼選 style

0.20.0 的理由寫在 [archive/2026-09-13-output-styles.md](../archive/2026-09-13-output-styles.md)：style 接在 system prompt 後面，每個 request 原文送出，compaction 改寫對話但不改 system prompt，所以稀釋不到；SessionStart 注入的規則在對話裡，長 session 會淡掉。

## 為什麼推翻

- **每個使用者都看得到。** plugin 出貨的 style 出現在每個人的 `/config` 清單裡（`fankeel:fankeel-review`、`fankeel:fankeel-pipeline`、`fankeel:fankeel-terse`），而維護者要所有人留在 Default；文件沒有把 plugin style 藏起來的辦法。
- **到不了 subagent。** subagent 跑自己的 system prompt，只有 fork 繼承（https://code.claude.com/docs/en/sub-agents.md）。所以 style 不是給 background agent 用的，也改變不了派出去的工作。
- **稀釋的問題，注入已經解了。** fankeel 的注入不是 SessionStart 一次，而是每個 prompt（`hooks/inject.js`）與每個答完的問題（`hooks/resume.js`）重送；隨 stage 變的 `output shape:` 本來就只能在這裡。

## 放棄了什麼

style 在 mode 外也生效；skill 要描述命中才載入，不保證觸發。mode 開著時注入每輪重送，差距只在 mode 外。

## `fankeel-explain` 從哪來，偏離了哪兩處

使用者 2026-09-13 貼了一份「讓人最快理解、記住，並願意繼續聽下去」的 prompt，十條原則。對照當時的 fankeel：已有 1 條（證據與分母），做到一半 6 條，沒有 3 條（反轉節奏、報告的理解路徑、送出前自檢）。skill 收下全部十條，兩處刻意偏離原文：

- **反轉只在證據推翻了某個假設時用。** i-have-adhd 的評測量到，規則一要求成因，模型在證據不足時就編一個（`docs/plans/2026-09-09-design-class-prompt.md:221`）。「製造反差」是同一種壓力。
- **七個自問換成一個可以失敗的檢查**：只讀第一行與最後一行，讀者知不知道發生了什麼、下一步做什麼。形狀取自 i-have-adhd 的 Pre-send check（`docs/improvement-brief.md:776`）。

survey 的 `output shape:` 同時多了一行 `unknown:`——十條裡唯一放得進注入層、又只屬於某個 stage 的一條。
