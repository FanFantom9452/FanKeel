---
status: design-intent
last_verified: 2026-09-19
---

# 每站一個乾淨 context：Sonnet 主控、每站一個 agent、交接走檔案

這頁記下 session 4b24d237-2171-4a6b-91b5-001009b61c5b 討論到 design 第一步為止的內容。
它描述的是要做成的樣子，不是現在的樣子。前提是 station 即時監看與 map 目錄職責先落地
（同一個 session 改名後的 task 在做）；這頁是下一個 task 的起點。

## 為什麼

- session 越長，每回合都要把整份 context 重讀一次，花費跟 context 長度成正比；注意力也會
  被稀釋，前面的東西讀不到。
- 沒有任何一層讓模型自己決定丟掉哪些 context（下表）。能回收的只有邊界：agent 的邊界，
  或 session 的邊界。
- 所以每一站從乾淨的 context 開始，只帶上一站交過來的東西。

## 平台事實（2026-09-19 查官方文件）

| 事實 | 來源 |
|---|---|
| CLI 的自動 compaction 先清舊的工具輸出、再摘要；由 harness 的門檻觸發，模型不能自己觸發 | https://code.claude.com/docs/en/how-claude-code-works#when-context-fills-up |
| API 的 context editing（`clear_tool_uses_20250919`、`clear_thinking_20251015`）由呼叫端設的門檻在伺服器端執行；清一次，cache 從清除處失效 | https://platform.claude.com/docs/en/build-with-claude/context-editing |
| Agent SDK 文件沒寫支援 `context_management` | https://code.claude.com/docs/en/agent-sdk/agent-loop#automatic-compaction |
| 每個 subagent 的工具都拿掉了 `AskUserQuestion`，subagent 不能問使用者 | https://code.claude.com/docs/en/sub-agents.md |
| subagent 可以再派 subagent，預設到主對話下 3 層（`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`） | 同上 |
| 背景 agent 結束後可以用 `SendMessage` 接續，完整歷史都在 | 同上 |
| 所有 hook 事件在 subagent 裡都會觸發；`SubagentStart` 能注入 `additionalContext`；`UserPromptSubmit` 對 subagent 的起始 prompt 觸不觸發，文件沒寫 | https://code.claude.com/docs/en/hooks.md |
| 主 session 用 sonnet、subagent 用 opus 可以：Agent 工具的 `model` 參數，或 agent 檔的 `model:` | https://code.claude.com/docs/en/sub-agents.md |
| Workflow 腳本裡沒有「停下來等人」；只能停掉、改腳本、用 `resumeFromRunId` 從快取續跑；每個 `agent()` 可各自指定 model、prompt、agentType；腳本本身不能讀寫檔 | `workflow-authoring` skill |

## 架構

```
你 ──/fankeel──▶ 主控（Sonnet，只有工具呼叫）
                  │ 派這一站的 agent，給它上一站交接檔的路徑
                  ▼
               站 agent（Opus 5，乾淨 context）
                  │ 讀交接檔、讀 map 指的檔、做事
                  │ 寫 .fankeel/build/<task>/<stage>.md
                  ▼ 回傳：路徑、一行摘要、關卡選項
               主控 ── AskUserQuestion ──▶ 你
                  │ 你選了 → 派下一站
```

1. **主控只照指令碼走。** 它做三件事：派站、轉交路徑、問關卡。全程只有工具呼叫，不輸出
   文字。主控用什麼模型由啟動時決定（`/model sonnet`，或 settings 的 `model`）；fankeel
   能做的是把主控的規則寫得簡單到 Sonnet 照做不會錯。
2. **轉交傳路徑，不傳內容。** 內容回到主控再抄進下一個 prompt，會讓主控變長、多花輸出
   token，而且抄的時候會改字。fankeel-ask 規定判決用 stdin 傳、不准重打，是同一個理由
   （`skills/fankeel-ask/SKILL.md:81`）。
3. **關卡留在主 session。** subagent 不能問使用者。
4. **design 站用接續。** design 是來回的對話：開一個 agent 讓它活著，使用者的話由主控原封
   不動用 `SendMessage` 轉過去。
5. **Workflow 只放在兩道關卡之間。** 整條 route 放進一個 Workflow，關卡就全沒了，而 design
   的核可是最重要的一道。build 的任務迴圈、verify 的逐列檢查加對手審查，這種中間不需要人
   決定的段落才用。

## fankeel 要改的地方

- 站規則從 `SubagentStart` 送進站 agent。現在 `renderBrief`（`lib/render.js:358`）只帶
  task、stage、touched、回傳規則和 map 位置，不帶站規則，也不帶 output shape。不依賴
  `UserPromptSubmit` 在 subagent 裡觸發。
- 主 session 改拿「主控規則」：派哪一站、傳哪個路徑、問哪道關卡。現在的站規則由
  `hooks/inject.js` 在 `UserPromptSubmit` 注入主 session。
- 每站的 output shape 當交接檔的格式。

## 文件

每一站都從零開始，沒寫進交接檔或專案文件的東西，下一站就看不到。

- **交接檔**：一個 task 內、AI 寫給 AI、用完就丟。使用者在關卡上看的也是同一份，station
  可以直接顯示。
- **專案文件**：長期、單一事實來源。事實只放一處，給 AI 和給人的都是從那裡產生的視圖。
  給 AI 的第一個缺口是 map 沒有「目錄 → 職責」，由前一個 task 補。

## 不做的

- **MCP 當傳輸**：站之間傳檔案就夠，agent 本來就有 Read/Write。MCP 要常駐一個 process，
  每個新開的 agent 都要載它的工具定義，在這個架構下會乘上站數。
- **整條 route 一個 Workflow**：見架構第 5 點。

## 代價

- 每站冷啟動：system prompt 加上它需要讀的檔。map 越準，讀得越少。
- 交接漏寫的東西就沒了。
- 背景跑的時候只看得到回傳，要靠 station 即時監看（前一個 task）。

## 未決

09-19 的下一個 session 答了三條，第一刀見
[../archive/2026-09-19-survey-brain-design.md](../archive/2026-09-19-survey-brain-design.md)：

- 新舊兩種模式並存，用 profile 的 `stage.agents` 切換。
- build 站內部怎麼派工留到後面那一刀。站 agent 開不了 `Workflow`（每個 subagent 都拿不到），
  所以 build 的 workflow 由 script 產生、主控用 `scriptPath` 開。
- 「JEV」：原話是「jev 這個模型它本身也只是一個做判斷 tool calling…會不會有危險」，
  講的是判斷工具呼叫風險的模型，不在這個架構裡。
