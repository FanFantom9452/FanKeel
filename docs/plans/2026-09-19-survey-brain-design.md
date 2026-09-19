---
status: design-intent
last_verified: 2026-09-19
---

# survey 交給 Opus 大腦：主控只派工，交接走檔案

[2026-09-19-stage-agents-design.md](2026-09-19-stage-agents-design.md) 的第一刀。只有
survey 換成新模式，其餘各站照舊；用 profile 開關決定走哪一種，新舊兩種可以並排量。
這頁描述的是要做成的樣子，不是現在的樣子。

## 前提（2026-09-19 查過）

| 事實 | 出處 |
|---|---|
| 每個 subagent 都拿不到 `Workflow` 與 `AskUserQuestion`，前景背景都一樣 | https://code.claude.com/docs/en/sub-agents.md「Available tools」的 first filter |
| subagent 可以再派 subagent，預設到主對話下 3 層 | 同上，「Let subagents spawn their own subagents」 |
| `SendMessage` 接續一個結束的 subagent，完整歷史都在 | 同上，「Resume subagents」 |
| 一個 hook 的 `additionalContext` 上限 10,000 字；超過的存成檔，只給 2,000 字預覽，不叫模型去讀 | https://code.claude.com/docs/en/hooks.md，行 941 |
| `SubagentStart` 收到 `session_id`、`transcript_path`、`cwd`、`agent_id`、`agent_type`，沒有 prompt | 同上，行 2367 |
| `PreToolUse` 的 `updatedInput` 會取代整個 tool input；文件寫的 `AskUserQuestion` 用法是 `allow` 加 `updatedInput` 由程式代答 | 同上，行 1064、1794、1814 |
| 實測：hook 只回 `updatedInput`、不帶 `permissionDecision` 時，`AskUserQuestion` 顯示換過的題目，照樣讓人點選，模型收到的回答對應換過的題目（它也看得出題目被換過） | 2026-09-20，Claude Code v2.1.278 互動模式；[plan](2026-09-19-survey-brain.md) Task 1 |
| 七站 skill 有六份超過 10,000 字（`wc -c`：design 9,672，build 26,379） | 本 repo，2026-09-19 |
| 一站的 `rulesFor` 加 `templateFor` 是 1,955–2,092 字；現在的 brief 1,067 字，測試上限 1,400 | `tests/brief.test.js:133` |

所以 skill 不走 hook：brief 只給 skill 的路徑，大腦自己 Read。站別從 registry 的
`stage` 讀，因為 payload 裡沒有 prompt。

## 1. 開關

- `lib/profile.js` 的 `KEYS` 加一個 `stage.agents`，值是 `true` 或 `false`，builtin 是 `false`。不用 `on`／`off`：`parseValue` 只把
  `true`／`false` 轉成布林，`lib/stages.js` 的 `holds()` 會把字串 `off` 當成開。
- `true` 只改變有主控規則的站；這一刀只有 `survey` 有。
- `false` 時，每一個注入區塊跟現在逐字相同。

## 2. 主控規則

- `stage.agents` 為 `true`、站在 `survey` 時，`hooks/inject.js` 注入的 `stage rules:` 和
  `output shape:` 換成主控規則與主控形狀；其他站照舊。`hooks/resume.js` 在關卡答完後
  重送的區塊也照這個規則換。
- 主控規則只有這幾步：派一個 `fankeel:fankeel-brain`，prompt 只寫站名；它回傳後，印出
  交接檔路徑一行，然後呼叫 `AskUserQuestion`；使用者的選擇照下面的表處理。
- 主控不轉述交接檔的內容。使用者要讀的報告就是那份檔。
- 主控用什麼模型，由使用者啟動時決定（`/model sonnet`）；fankeel 不切換模型。

| 使用者選了 | 主控做的事 |
|---|---|
| 選項一 | `task.js stage <下一站>`，下一站由 `{{NEXT}}` 代入，跟現在一樣 |
| 留在這一站，或 Other | `SendMessage` 給大腦，內容固定一句：「使用者的回答在 `<回答檔>`」；大腦改寫交接檔之後，回到 `AskUserQuestion` |
| 暫停 | `task.js next --from-gate`，暫停時要寫的那一行由 script 從關卡區塊讀 |

## 3. 大腦 agent

- 新增 `agents/fankeel-brain.md`：`model: opus`，`tools: [Read, Grep, Glob, Bash, Write, Agent]`；
  `.claude-plugin/plugin.json` 的 `agents` 列出它。
- 大腦自己決定讀幾個方向，用 `Agent` 派 `fankeel:fankeel-reader`（sonnet）到第二層，
  一次回應最多四個；reader 回傳的 `path:line` 由大腦自己開檔核對。
- 大腦跑完只回傳一行：交接檔的路徑。
- class 需要升級時，大腦自己跑 `task.js route`，並寫進報告。

## 4. brief

- `agent_type` 是 `fankeel-brain` 時，`renderBrief` 在現在的 brief 之後加上：這一站的
  `stage rules:`（`rulesFor`）和 `output shape:`（`templateFor`）、這一站 skill 的絕對路徑
  （規定先讀）、交接檔路徑、關卡區塊的格式。
- brief 另外帶兩條覆寫，並寫明它們蓋過哪一條站規則：不能問人，所以把關卡寫進關卡區塊
  （蓋過 `ALWAYS[0]`）；不能開 `Workflow`，所以用 `Agent` 派（蓋過 survey 的
  「one workflow」）。
- 大腦的 brief 不超過 10,000 字；其他 agent type 的 brief 逐字不變，1,400 字上限也不變。

## 5. 交接檔

- 路徑是 `.fankeel/build/task-<started>/<stage>.md`，`<started>` 取 registry 的 `started`
  （adopt 會保留它，`scripts/task.js:915`）。
- 路徑由新檔 `lib/handoff.js` 的一個函式算；brief、`gate.js`、`resume.js`、`task.js` 都
  呼叫這一個函式。
- 內容是這一站 output shape 填好的報告，後面接一個 `json gate` 區塊：
  `{"questions": [<AskUserQuestion 的 input>], "next": "<暫停時寫進 next 的一行>"}`。
- 使用者的回答寫在同一個目錄的 `<stage>-answer.md`。

## 6. 關卡由 hook 填

- `hooks/gate.js`：在新模式、站在 survey、交接檔有關卡區塊時，回傳 `updatedInput`，
  把問題換成檔案裡的原文。主控送出的問題內容不算數。
- `hooks/resume.js`：把使用者的回答原文寫進回答檔。
- 要是實測發現 `updatedInput` 沒辦法在互動模式下換掉題目、又照樣讓人選，就退回由主控
  Read 關卡區塊後照抄，並在 verify 寫明這條退路。

## 7. 文件

- `skills/fankeel/SKILL.md` 的「Delegate a job inside a stage; never the stage itself」
  加上例外：`stage.agents` 為 `true` 時的大腦。
- `docs/subagents.md` 補上大腦的 brief 與主控規則；`docs/pipeline.md` 補上 `stage.agents`
  與大腦 brief 的 10,000 字上限。
- 寫「five」個 agent 的地方改成六個：`README.md`、`docs/README.md`、`docs/subagents.md`。
- land 時寫一份新的 decision 紀錄，說明它取代了
  `docs/decisions/fankeel-shell.md:230`「brief 不帶站規則」在大腦這個例外上的效力。
  原紀錄不改。
- 後續幾刀寫進 `TODO.md`：build 的 workflow 由 script 產生、design 的轉話、station 看得到
  第二層、站中途插話、其餘四站。

## 8. 量測

- 同一個題目，舊模式（Opus 主 session）和新模式（Sonnet 主控加 Opus 大腦）各跑一次
  survey，量到關卡打開為止，比時間、token、花費。
- 花費從 `modelUsage` 讀，因為它有算進 subagent。

## 證明做完

- `tests/brief.test.js`：`fankeel-brain` 在 survey、`stage.agents` 為 `true` 時，brief 帶有
  `rulesFor('survey')` 每一行、`templateFor('survey')`、skill 路徑、交接檔路徑，而且短於
  10,000 字。現在會失敗。
- `tests/render.test.js`：`true` 加 survey 時注入的是主控規則、不是 survey 的規則；`false` 時跟
  沒有這個鍵的輸出逐字相同。
- `gate.js` 的測試：交接檔有關卡區塊時，`updatedInput.questions` 等於檔案裡的原文。
- 產出物：一次實跑之後，transcript 裡 `AskUserQuestion` 的 input 和交接檔的關卡區塊逐字
  相同。

## 沒驗證的

`updatedInput` 已於 2026-09-20 實測，結果見前提表。
