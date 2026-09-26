---
status: decision
last_verified: 2026-09-24
---

# 對照 addyosmani/agent-skills 與 mattpocock/skills — 決策紀錄

一句結論：兩個 repo 各有一個 fankeel 沒有的具體做法值得考慮——
addyosmani 每個 skill 檔內建的「Rationalizations／Red Flags」段落，和
mattpocock 用 Changesets 自動產生的 semver 更新紀錄——其餘的差異多半是
fankeel 已經用別的機制蓋過（見下表與清單）。

外部依據來自 GitHub 公開 API 與 `raw.githubusercontent.com`（沒有登入的
`gh`）：`addyosmani/agent-skills` 與 `mattpocock/skills` 的
`git/trees/HEAD?recursive=1`、各自的 `README.md`，以及各挑一份代表性的
`SKILL.md`（`skills/test-driven-development/SKILL.md` 與
`skills/engineering/tdd/SKILL.md`）和 mattpocock 的 `CHANGELOG.md`。兩個
repo 在讀取當下都存在、都沒有改名。

## 三軸對照

| 軸 | fankeel | addyosmani/agent-skills | mattpocock/skills |
|---|---|---|---|
| skill 怎麼切與寫 | 一個 stage 一個 `SKILL.md`（`skills/fankeel/SKILL.md`），程式檢查的部分外掛到 `skills/registry.json`（`scripts/stage-registry.js` 產生，每個 stage 一筆 `entry_condition`／`stop_condition`／`prompt_bytes` 預算） | `skills/<name>/SKILL.md`，frontmatter 帶 `name`／`description`／觸發條件；固定段落：Overview、When to Use、Process（步驟＋checkpoint）、Rationalizations（列出常見藉口並逐條反駁）、Red Flags、Verification（README.md；`skills/test-driven-development/SKILL.md`） | 依用途分兩層目錄：`skills/engineering/`（16+ 個，程式相關）與 `skills/productivity/`（7 個），另有 `skills/in-progress/`、`skills/misc/`；每個 skill 標記 user-invoked 或 model-invoked 兩種之一，規則是「user-invoked 可以呼叫 model-invoked，但不能呼叫另一個 user-invoked」；另有專案級 `CONTEXT.md` 給共用領域語彙（README.md；`skills/engineering/tdd/SKILL.md`） |
| 版本怎麼管 | `scripts/version.js` 把同一個號碼寫進 13 處（2 個 manifest＋11 個 skill 的 `version:` frontmatter 行），`tests/contract.test.js` 檢查一致，`--changes` 從 `chore: x.y.z` 那筆 commit 之後的 subject 列出未發布的變更，不寫 changelog 檔 | README／CONTRIBUTING 沒有寫明版本方案；skill 是可攜的 markdown 檔，裝進各 agent 自己的目錄（`.claude/commands/`、`.gemini/commands/` 等），像是靠複製／重裝而非語意化版號傳播更新 | `CHANGELOG.md` 由 Changesets 產生，semver（例如 1.2.3），依變更類型分 Major／Minor／Patch Changes，每筆帶 PR 連結與作者署名（`CHANGELOG.md`） |
| agent 怎麼派 | 每個 stage 的規則靠 `hooks/inject.js` 逐 prompt 注入；`profile.json` 的 `dispatch.floor` 定派工模型下限；`Agent` 工具沒有 gate，`Workflow` 工具只在五種情況開；`stage.agents` 設了某個 stage 才轉給 `fankeel-brain` 全階段代跑（`skills/fankeel/SKILL.md` 的「Subagents」節） | 斜線指令對應開發生命週期：`/spec`、`/plan`、`/build`、`/test`、`/review`、`/ship`，`/build auto` 可自走跑完已核可的計畫；也會依任務型態自動觸發（例如設計 API 觸發 `api-and-interface-design`）；各工具各自的包裝（Claude Code 的 `.claude/commands/`、Gemini CLI 的 TOML、Codex 的 marketplace `@skill-name`）（README.md） | 三種安裝／派工路徑：Claude Code plugin（`claude plugins install`，唯讀、自動更新）、`npx skills@latest add` 只挑需要的 skill 並用 `npx skills update` 更新、或可編輯安裝寫進 repo 供自行修改；呼叫方式是斜線指令（如 `/ask-matt`），`/setup-matt-pocock-skills` 每個 repo 跑一次設定 issue tracker、triage 標籤與文件位置（README.md） |

## 對方有、fankeel 沒有

1. **每個 skill 檔內建的 Rationalizations／Red Flags 段落**（addyosmani）——把「常見藉口」和「做錯的警訊」寫死在每份 `SKILL.md` 裡，而不是散在一份總則裡。解決的是子代理讀完規則後自己找理由跳過的問題。fankeel 目前把這類提醒寫成散文（例如 `skills/fankeel/SKILL.md` 的「Calibration」表），沒有固定段落名。搬過來要動：`skills/*/SKILL.md` 的寫作慣例（或 `CONTRIBUTING.md` 補一條格式規則）。
2. **每個 skill 檔自帶的 Verification Checklist**（addyosmani）——skill 檔本身列一份完成前要核對的清單，跟 `skills/registry.json` 產生的 `stop_condition`（一句話、程式產生）不是同一層。解決的是人在看單一 skill 檔時，核對表就在旁邊，不必跳去看 registry。搬過來要動：`skills/registry.json` 的產生腳本 `scripts/stage-registry.js`，或每份 `SKILL.md`。
3. **用 Changesets 自動產生的 semver＋PR 署名更新紀錄**（mattpocock）——`scripts/version.js` 現在只同步一個號碼、用 commit subject 湊出「還沒發布的變更」清單，沒有語意化版號規則（多大的變更該跳 minor 還是 patch），也不落地成一份 `CHANGELOG.md`。解決的是「這次升級改了什麼」要重新爬 commit 而非讀一份現成紀錄。搬過來要動：`scripts/version.js`，或新增一個 `CHANGELOG.md` 的產生規則。
4. **user-invoked 不能呼叫另一個 user-invoked skill 的明文規則**（mattpocock）——fankeel 的 stage 都是 session／使用者驅動，唯一的例外是 `fankeel-brain` 代跑整個 stage，但沒有一條規則明講「一個 skill 不能觸發另一個要問使用者的 skill」。解決的是避免兩層 gate 疊在一起、使用者被問兩次。搬過來要動：`skills/fankeel/SKILL.md` 的「Subagents」節，或 `docs/90-agent/reference/subagents.md`。
5. **專案級 `CONTEXT.md`，跟逐個 skill 檔分開的共用領域語彙**（mattpocock）——fankeel 有 `.fankeel/docs.json`、`map.md` 描述專案，但沒有一份「這個專案的名詞怎麼講」讓每個 stage 都引用，省得每份規則重講一次。搬過來要動：`lib/docs.js`，或 `docs/90-agent/reference/documents.md` 加一個新角色。
6. **安裝時可選「唯讀受管」或「可編輯」兩種路徑**（mattpocock）——fankeel 目前只有一種安裝方式（本機 marketplace 目錄，見
   `fankeel installs from the local dir` 的既有結論），使用者沒有「要不要自己改」的選擇。搬過來要動：`.claude-plugin/plugin.json` 與安裝說明。

## 沒能核對的部分

外部 repo 的檔案樹與 README／SKILL.md 內容都是用 `WebFetch` 讀 GitHub 公開
API 與 `raw.githubusercontent.com` 現場取得，不是從記憶或猜測寫出——但
`WebFetch` 是把抓回的網頁丟給另一個較小模型摘要後回傳，不是逐字讀原文，
所以上面表格與清單裡對兩個外部 repo 的描述，是那個摘要模型的轉述，未逐
字核對原始 markdown。抓取當下（2026-09-24）兩個 repo 都存在、都未改名，
沒有出現本應照實記錄的「repo 不存在或改名」情況。

`AskUserQuestion` 逐條讓使用者挑選、把挑中的寫進下面「挑選」一節，是這
份任務原本規劃在同一個 session 裡做的一步（設計 §13：「使用者讀完逐條
挑要收哪幾個做法」）；執行這份頁面的這次派工沒有能對話的使用者可問，所
以清單只列到候選為止，尚未經過使用者挑選。

## 挑選

尚未進行——見上一節。使用者對上面六個候選逐一表態（可以是零個）之後，
挑中的各自成為 `TODO.md` `## Needs a decision` 的一條，連到
`skills/fankeel/SKILL.md`，再回來把這節填上逐字紀錄。
