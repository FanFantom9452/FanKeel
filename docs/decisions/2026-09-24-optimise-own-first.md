---
status: decision
last_verified: 2026-09-24
---

# 對照外部 repo：從 fankeel 自己的問題出發 — 決策紀錄

一句結論：對照別的 repo 時，先有 fankeel 自己的問題——`TODO.md` 的一條，或記錄過的一次事故——再去看對方怎麼處理；「對方有、fankeel 沒有」本身不是收的理由。照這條走完 [skill-repos](2026-09-24-skill-repos.md) 的六條與 [ponytail 報告](../reports/2026-09-24-ponytail-remainder.md) 的六條，十二條都對不上，一條都不問，`TODO.md` 沒有新增條目。

design 見 [../archive/2026-09-24-todo-sweep-design.md](../archive/2026-09-24-todo-sweep-design.md) 第 10、11 節，計畫見 [../archive/2026-09-24-todo-sweep.md](../archive/2026-09-24-todo-sweep.md) 的 Task 9。

## 規則

- 使用者 2026-09-24 在 verify gate 定調：以優化自己為主，對方的功能只是參考（[needs-a-decision-batch](2026-09-24-needs-a-decision-batch.md) 的〔method〕那條）。
- 一條候選要先對到 fankeel 的一個問題才問：對得上，寫成 `TODO.md` 的一條；對不上，記在下表，寫「不問」和原因。
- 不再列「收哪幾條」讓使用者挑。上面兩頁是那種寫法留下的 decision 與 report，照角色不改寫；它們留白的「挑選」與「使用者的回答」由這份紀錄回答。
- 同一條規則挑出了這一批的五條 shrink：audit 的三個 code lens 在 fankeel 自己的碼裡找到重複，ponytail 的 `## Cuts` 只是那幾個 lens 的來源。

## 共用詞彙那條為什麼關掉

TODO 原本說各站注入重講同一批名詞，想照 mattpocock 的 `CONTEXT.md` 把詞彙放一處、各站只引用。每次 prompt 只注入目前那一站的規則加上 `ALWAYS`（`lib/stages.js`），別站的規則不會出現在這一站，跨站重複的名詞在執行時不會重複付費；前提不成立，所以不改碼。skill-repos 第 5 條（專案級 `CONTEXT.md`）因此一併不問。

## 十二條候選

| 候選 | 出處 | 對到的 fankeel 問題 | 結論 |
|---|---|---|---|
| 每個 skill 檔的 Rationalizations／Red Flags 段落 | skill-repos 第 1 條 | 沒有 | 不問：`TODO.md` 與事故裡沒有「子代理讀完規則自己找理由跳過」的一條；出過的越界（唯讀 agent 寫檔）是用 hook 擋的（`hooks/guard.js`），不是靠 skill 多一段文字。八份 skill 的 `## Not a defect` 表處理的是反方向的誤報。 |
| 每個 skill 檔自帶的 Verification Checklist | skill-repos 第 2 條 | 沒有 | 不問：八份 skill 開頭都有 `**Done when**`，`skills/registry.json` 的 `stop_condition` 由 `scripts/stage-registry.js` 產生；沒有一條問題是看 skill 時找不到核對表。 |
| Changesets 產生的 semver 與 changelog | skill-repos 第 3 條 | 沒有 | 不問：`scripts/version.js` 的 `--changes` 已經從上一個 release commit 之後的 subject 列出未發布的變更；fankeel 從本機目錄安裝，沒有一條問題是不知道這次升級改了什麼。 |
| user-invoked 不能呼叫另一個 user-invoked 的規則 | skill-repos 第 4 條 | 09-23 design：主控對不在 `stage.agents` 的站派了 brain | 不問：唯一對得上的那次，這一批用 hook 擋了（`hooks/guard.js`）；沒有別的兩層 gate 疊在一起的事故。 |
| 專案級 `CONTEXT.md` | skill-repos 第 5 條 | 〔memory〕共用詞彙那條 | 不問：那條的前提不成立，見上一節。 |
| 唯讀受管與可編輯兩種安裝 | skill-repos 第 6 條 | 安裝版落後 working tree（`TODO.md` `## Waiting` 的「受控 build/verify 實跑」） | 不問：09-23 起 marketplace 已指向本機目錄，stage skill 也規定在 fankeel 自己的 repo 跑 working tree 的 script；剩下的落後是 hook 在 process 啟動時就固定，換安裝方式改不了。 |
| `ponytail-debt` | ponytail 第 1 列 | 沒有 | 不問：報告已查到全 repo 沒有母體；刻意延後的事寫在 `TODO.md`，`## Waiting` 的每個 timing 都要寫 `lifts when:`，那就是 debt 清單要的觸發條件。 |
| `ponytail-gain` | ponytail 第 2 列 | 沒有 | 不問：它給的是跨 repo 的中位數；fankeel 要的是本 repo 量到的數字，站頁已經按站、agent、模型列出時間、token 與花費（`lib/station.js`、`lib/detail.js`）。`## Waiting` 的「倍數量測」缺的是一次實測，計分卡補不了。 |
| `ponytail-help` | ponytail 第 3 列 | 沒有 | 不問：沒有一條問題或事故是找不到指令。 |
| SessionStart 的預設模式 hook | ponytail 第 4 列 | 沒有 | 不問：fankeel 沒有強度模式；專案的常設答案在 `profile.json`（`lib/profile.js`），`hooks/carry.js` 只接 clear／fork 留下的任務。 |
| SubagentStart 按 agent_type 注入整套規則 | ponytail 第 5 列 | 沒有 | 不問：`hooks/brief.js` 已經按 `agent_type` 分流，`fankeel-brain` 拿整站規則的 brief，其他 subagent 拿任務的 brief；沒有對應的問題。 |
| UserPromptSubmit 的模式切換 hook | ponytail 第 6 列 | 沒有 | 不問：fankeel 的狀態在 registry，由 `scripts/task.js` 寫、`hooks/inject.js` 每個 prompt 讀；沒有需要從 prompt 文字切換的模式。 |

## 結果

`TODO.md` 沒有因為這十二條新增條目。這份紀錄落地的同一個變更刪掉〔memory〕與〔method〕兩條；這一批做完後，`## Ready` 與 `## Needs a decision` 都是空的。
