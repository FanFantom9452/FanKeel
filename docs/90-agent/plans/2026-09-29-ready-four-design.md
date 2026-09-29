---
status: design-intent
last_verified: 2026-09-29
---

# TODO Ready 四條：await-3、brief-1、station-1、station-6

session d5e18e3d-b6d1-483a-b38a-be7911f5eadd 的 design。描述要做成的樣子，不是現在的樣子。
survey 報告在 `.fankeel/build/task-20260929T135057/survey.md`；四個 reader 的結論摘在各節開頭。

## 1. await-3：build 收尾的 task 數由腳本算

reader 結論：沒有任何程式印出「17 tasks」；`scripts/ledger.js` 的 `show`（約 753 行）只列完成編號、不給數字，brain 自己數 `progress.md` 寫進報告。

- `ledger.js show` 在 `complete:` 下多印一行 `done <完成數> of <計畫 task 數>`，計畫 task 數取 `plantasks.parseTasks` 對當前計畫檔的結果，不取 ledger 的列數。
- `skills/fankeel-build/SKILL.md` 的收尾報告步驟改為引用這一行，不自己數。

## 2. brief-1：brain 寫不進別的 session 的 task 目錄

reader 結論：brief 給的是絕對路徑，`hooks/brief.js:102` 只照 `payload.session_id` 讀紀錄，找不到「選最新 task 目錄」的程式；g2、g3 的 prefix 檔帶著另一個 session 的 context 路徑，成因在原始碼裡定不下來。所以不追成因，改成讓錯的目錄寫不進去。

- `lib/guard.js` 新增一條判斷：`agent_type` 去掉 `fankeel:` 後是 `fankeel-brain`、工具是 Write、目標路徑落在登記處的 `.fankeel/build/task-*/` 底下，而那個目錄不等於 `handoff.dirFor` 用這個 session 自己的紀錄算出來的目錄時，deny，訊息寫出兩個目錄。
- `hooks/guard.js` 把這條判斷接上 PreToolUse；不在 `.fankeel/build/task-*/` 底下的寫入不受影響。

## 3. station-1：記下量測，條目繼續開著

reader 結論：09-29 08:35 之後的 11 個 session，(a) subagent context 峰值最高 365,664（session e4ddebcd-fa34-4b88-a749-3a5d1fa65a9f），通過 450k；(b) 最貴單一 subagent 佔比最高 51.4%（session 3f0d6e25-6c3e-40a5-8c97-1200aca364c7），10 個有價格的 session 只有 3 個低於 15%，未通過。

- `docs/90-agent/todo/station-1.md` 補一段 09-29 量測，寫明截止點、兩個數字與 session id、(a) 通過 (b) 未通過；條目維持 `ready`，下一步是查 session 3f0d6e25 那個 agent 為什麼佔一半。

## 4. station-6：profile 產生覆寫檔，派工時換成不帶前綴的名稱

reader 結論：guard、brief、title 都已接受不帶前綴的 `fankeel-reader`（`lib/guard.js:302`、`hooks/brief.js:113`、`lib/title.js:85-115`）。spike（57bd3dd9）證實專案 `.claude/agents/fankeel-reader.md` 只回應不帶前綴的名稱。派工文字散在 8 份 SKILL.md 與 `lib/stages.js`、`lib/render.js`、`agents/fankeel-brain.md` 共 29 處，全寫 `fankeel:fankeel-*`。

- `lib/profile.js` 接受 `agent.<name>.model`（值同 `dispatch.floor` 的清單）與 `agent.<name>.effort`（`low`、`medium`、`high`、`xhigh`、`max`），`<name>` 必須是插件 `agents/` 裡有的檔名；其他名稱 refuse。
- `task.js profile set agent.<name>.*` 立刻寫出覆寫檔：`--project` 寫到專案的 `.claude/agents/<name>.md`，`--default` 寫到設定目錄的 `agents/<name>.md`。內容是插件的 `agents/<name>.md` 原文，只換 `model:`、`effort:` 兩行，frontmatter 加 `generated_by: fankeel <version>`。兩個鍵都清掉時刪掉這個檔，且只刪帶這個標記的檔。
- `task.js start` 發現覆寫檔的 `generated_by` 版本和插件版本不同時重寫一次，讓插件更新後 agent 內文不落後。
- `hooks/title.js` 在 `subagent_type` 是 `fankeel:<name>`、而帶 `generated_by` 標記的覆寫檔存在時，把 `updatedInput.subagent_type` 換成 `<name>`；前綴照換過的名稱從覆寫檔讀模型與 effort。沒有標記的同名檔不換，使用者手寫的檔不被自動接管。29 處派工文字不動。
- guard 與 brief 已接受不帶前綴的名稱，加測試釘住：不帶前綴的 `fankeel-reader` 仍被當成唯讀、`fankeel-brain` 仍拿到 brain 的 brief。

## 驗收

| 條目 | 現在失敗、做完通過 |
|---|---|
| await-3 | `ledger.js show` 對 5 個 task、完成 2 個的 fixture 印出 `done 2 of 5` |
| brief-1 | brain 對另一個 session 的 `task-*` 目錄 Write 被 deny；對自己的目錄放行 |
| station-6 產生 | `profile set agent.fankeel-reader.model haiku --project` 後，fixture 專案出現帶 `model: haiku` 與 `generated_by` 的檔；清掉後檔案消失 |
| station-6 換名 | title hook 對 `fankeel:fankeel-reader` 回 `updatedInput.subagent_type: fankeel-reader`，前綴讀到 `haiku`；沒有覆寫檔時不改 |
| 實跑 | headless `claude -p` 派 `fankeel:fankeel-reader`，transcript 的 `message.model` 是 haiku |

station-1 沒有程式變更，驗收是那段量測寫進條目。

## 未驗證

Claude Code 是否採用 PreToolUse `updatedInput` 對 `subagent_type` 的改寫。已知 `description` 的改寫會生效（`hooks/title.js:6`），`subagent_type` 沒測過。plan 的第一個 task 是這個 spike；不生效時第 4 節退回改 29 處派工文字，再回 design。

## 對照 map

- `docs/90-agent/reference/model-choice.md` 寫著 effort 釘在 agent 檔、單次拉高要靠覆寫檔（第 23-26 行）；這份設計實作那條路，verify 時更新該頁。
- `docs/90-agent/reference/subagents.md` 要補第 2 節的新 guard 規則。
- 其他頁沒有衝突。
