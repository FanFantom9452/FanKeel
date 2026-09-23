---
status: current
last_verified: 2026-09-24
source_of_truth: `docs/improvement-brief.md#65-ponytail-去依賴`（09-12 落地的盤點）加上本機仍在的安裝副本 `~/.claude/plugins/cache/ponytail-per-session/ponytail/4.9.0`（讀了它六個 skill 的 `SKILL.md` 與三個 hook 的原始碼，比 §6.5 的摘要更細）
---

# ponytail 4.9.0 沒收的做法逐條問過 — 2026-09-24

**§6.5 說 09-12 已收三項：`ponytail-review` → `agents/fankeel-reviewer.md` 的 `## Cuts`；`ponytail-audit` 的程式碼那一半 → fankeel-audit 三個 reviewer lens；ladder → `skills/fankeel-design/SKILL.md` 第 2 步。不收的是 `ponytail-debt`、`ponytail-gain`、`ponytail-help` 與三個 hook。本頁把這六個沒收的候選逐一列出，附今天 fankeel 有沒有等價機制；使用者的收／不收留待下一輪，見「使用者的回答」一節。**

## 已收，不再問

| 做法 | 收進哪裡 |
|---|---|
| `ponytail-review`（單檔過度工程審查） | `agents/fankeel-reviewer.md` 的 `## Cuts` 一節 |
| `ponytail-audit`（全 repo 過度工程審查，程式碼那一半） | fankeel-audit 的三個 reviewer lens |
| `ponytail` 主 skill 的 ladder（七級停在第一個成立的） | `skills/fankeel-design/SKILL.md` 第 2 步 |

## 候選（§6.5 沒收的其餘做法）

| 名稱 | 做什麼 | §6.5 為什麼沒收 | 今天的 fankeel 有沒有等價的東西 | 使用者的回答 |
|---|---|---|---|---|
| `ponytail-debt`（skill） | grep 全 repo 的 `ponytail: <ceiling>, <upgrade path>` 註解，彙整成一份債務清單，標出沒寫觸發條件的「no-trigger」風險列 | 全 repo 只有一個帶這個前綴的標記，前綴本身也已經拿掉，沒有母體可收 | 沒有等價機制；`TODO.md` 的 `## Waiting` 是「等某個外部事件」的清單，不是「刻意抄捷徑」的清單，兩者記的是不同的事 | 待問 |
| `ponytail-gain`（skill） | 一次性顯示 ponytail 的 benchmark 中位數（程式碼行數、成本、速度），明講這是跨 repo 的中位數、不是這個 repo 的數字，並指向 `/ponytail-debt` 當唯一可信的本 repo 數字來源 | §6.5 未展開理由，只列在「不收」清單裡 | 部分等價：`ledger.js groups`／`ranges` 記派工的花費與耗時，是「這個 repo 量過的數字」，但沒有一張固定格式的計分卡；`docs/reports/` 裡零散的 A/B 報告（如 `2026-09-21-controller-budget.md`）扮演類似角色，但每篇都要重新寫 | 待問 |
| `ponytail-help`（skill） | 一次性顯示所有 ponytail 模式、六個 skill、對應指令的參考卡，含跨主機（Codex、OpenCode 等）觸發語法差異 | §6.5 未展開理由，只列在「不收」清單裡 | 沒有等價：fankeel 沒有 `/fankeel-help` 這類單頁參考卡，各 `skills/*/SKILL.md` 自己的 description 是唯一的說明來源 | 待問 |
| SessionStart hook（`ponytail-session-start.js`） | session 開始時讀 `PONYTAIL_DEFAULT_MODE` 環境變數或設定檔，依 session id 決定要不要自動啟用某個 ponytail 強度（lite/full/ultra），寫進 per-session 的 flag 檔 | 隨三個 hook 一起被列為不收 | 部分等價：fankeel 也有 `SessionStart`（matcher `clear\|fork`）→ `hooks/carry.js`，但那是把 clear／fork 前的任務接續下去，不是啟用某種模式的旗標；沒有「預設模式」這個概念 | 待問 |
| SubagentStart hook（`ponytail-subagent.js`） | 每個 subagent 啟動時把整套規則（約 5 KB）重新注入，因為 SessionStart 的 context 到不了子 agent；可用 `PONYTAIL_SUBAGENT_MATCHER` 環境變數限定只注入到符合 agent_type 的子 agent | 隨三個 hook 一起被列為不收 | 部分等價：fankeel 已有 `SubagentStart` → `hooks/brief.js`，會給每個 subagent 一份任務相關的 brief；差別是 brief.js 給的是這個任務專屬的簡報，不是整套規則文字，也沒有 ponytail 那種「用環境變數按 agent_type 篩選要不要注入」的機制 | 待問 |
| UserPromptSubmit hook（`ponytail-mode-tracker.js`） | 檢查每次使用者輸入，比對 `/ponytail`／`@ponytail`／`$ponytail` 開頭的指令，切換模式並把目前模式寫進 per-session flag 檔 | 隨三個 hook 一起被列為不收 | 部分等價：fankeel 已有 `UserPromptSubmit` → `hooks/inject.js`，每個 prompt 前都跑，但讀的是 registry 裡的任務狀態，不是一個「模式」旗標；兩者觸發的事件相同，機制與所存的狀態不同 | 待問 |

## 使用者的回答

**沒有問到。** 本檔由一個 in-session 的一般用途 subagent 產出；brief 指定用 `AskUserQuestion` 逐條問使用者，但這個 subagent 的工具清單裡沒有 `AskUserQuestion`（不在頂層工具、也不在可延遲載入的工具清單裡）——那個工具似乎只在互動式主 session 才有。所以上表六列的「使用者的回答」欄全部留白，**六個問題還沒問**，`TODO.md` 也還沒因為任何一個答案加新條目。

派這個 task 的 session（有 `AskUserQuestion`）需要把上表六列，一列一題，依表的順序問過，把逐字回答填回這份檔，收的每項各加一條到 `TODO.md` 的 `## Needs a decision`（連到 `docs/improvement-brief.md` 的 §6.5 錨點，與原條目相同）。

原本標記「還沒收其餘做法」的那條 TODO（開頭「〔method〕深度分析 ponytail」）已經在本次改動關掉，因為讀清單、寫候選表這件事本身已經做完；剩下的是逐條問使用者這一步，還沒排進 `TODO.md`。
