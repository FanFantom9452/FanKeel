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
- **派工傳的 `model` 蓋過 agent 檔這件事，只有工具的文件這樣說，這個 repo 沒有探測過。**跑完之後，該 session 的 `modelUsage` 只按模型加總，能看出 opus 與 sonnet 各花了多少，分不出是哪個站；逐站用了哪個模型，要看該 session 旁邊 `subagents/` 底下每個站 agent 的 transcript。
- 量測在發版之後：使用者把 `stage.agents` 設成 `all` 跑一個真實 task，用 `node scripts/ctx.js <session> --by-stage` 與該 session 的 `modelUsage` 讀；門檻沿用設計的主控至多 60 turns、最後一關低於 200k。這一份不預設結果。
- 要回頭：把 `agents/fankeel-brain.md` 的 `model` 改回 `opus`，並拿掉 `controlRules` 那一行的 `model: opus` 分支；`tests/agents.test.js` 與 `tests/stages.test.js` 各有一個測試釘住現在的樣子，會跟著紅。

## 三、探測

這裡的「規則」是 `.claude/settings.local.json` 裡的一條 `permissions.allow`：`Edit(/.fankeel/build/**)`（每台機器一份，不進版控）。起因是 2026-09-22 一場 session 裡，auto mode 的分類器對站 agent 與 implementer 的 Write／Edit 回 no verdict 六次以上，handoff 檔因此寫不出來（當時記在 `TODO.md` 的〔stage-agents〕條目）。放行前後各派一個 sonnet 的 general-purpose agent，用 Write 在 `.fankeel/build/` 建一個檔：兩次探測在同一個 session、同一個 permission mode（auto，`~/.claude/settings.json` 的 `permissions.defaultMode`）下跑，唯一的差別是 `.claude/settings.local.json` 存不存在。探測檔名用 `probe-before.md` 與 `probe-after.md`，沒有照計畫用時間戳。

| test | before the rule | after the rule |
|---|---|---|
| 一個 agent 用 Write 建立 `.fankeel/build/probe-<before 或 after>.md`，內容一行 `probe`（2026-09-22 06:42:59 與 06:46:47） | `File created successfully at: F:\ymlab\fankeel\.fankeel\build\probe-before.md` | `File created successfully at: F:\ymlab\fankeel\.fankeel\build\probe-after.md` |

放行後的探測寫成功了，但放行前的也寫成功，所以這次沒有觀察到規則帶來的差別：規則有沒有效，在這台機器上無法證明；no verdict 這次沒有重現，但每邊只探一次、探的是 general-purpose agent 而不是站 agent，所以不能據此說問題已經消失。規則仍照使用者的決定加進去，當作保險，只放行 gitignored 的 `.fankeel/build/`。
