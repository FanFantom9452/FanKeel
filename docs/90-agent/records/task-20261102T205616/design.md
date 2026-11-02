# TODO 全表盤點 — design

三條各自 design，依序：worktree 不放在 repo 裡 → 先問完、剩下自己跑 → 跨機回顧：專案卡與來源分級。

## 1. worktree 不放在 repo 裡 — 已定（使用者 11-03 同意）

- 本機 `fankeel` marketplace 改指向乾淨 clone `F:/ymlab/fankeel-dist`；發版時在 marketplace update 前跑 `git -C F:/ymlab/fankeel-dist pull --ff-only`，cache 只拿到 git 追蹤的檔，不需要 push。
- `README.md` 的更新段加三行：開發機的 marketplace 指向乾淨 clone，不指向工作目錄。
- 記憶 `fankeel-release-every-change.md` 的發版步驟加那一行 pull。
- 設定變更（clone、marketplace remove／add）由使用者自己跑。

proves it done: `.claude/worktrees/` 下有 worktree 時發版後 `claude plugin update fankeel@fankeel` 成功，新版 cache 目錄沒有 `.claude/worktrees`（0.153.0 現在有，所以現在會失敗）。
against the map: no conflict（map 只記 `.claude-plugin/marketplace.json`）。
unverified: `marketplace remove` 會不會一併解除 fankeel 的安裝與設定。
not doing: `fankeel-worktrees-parked` 殘骸留給使用者決定；cache 舊版由 CC 的 14 天清理處理。

## 2. 先問完、剩下自己跑

做法：預答的那一站多問一題「之後 verify、land 各選什麼」，答案存進這個 task 的紀錄 `preanswer`；之後那幾站照寫報告，`hooks/gate.js` 的 `emit` 看到對得上的預答，就走 station 已有的 allow + `updatedInput.answers` 路徑（gate.js:197-204）直接帶答案過，紀錄標 `preanswered`；預答期間硬停清單裡的動作由 `lib/guard.js` 發 permission prompt 停住等人。

| file | change | dispatch |
|---|---|---|
| `scripts/task.js`、`lib/registry.js` | 新指令 `task.js preanswer <stage>=<label>...`，寫 `d.preanswer = {answers, stops, at}`，`task`／`down` 清掉 | implementer, sonnet |
| `hooks/gate.js` | `emit` 有對得上的預答時 allow 並帶 `answers`，記 `preanswered` | implementer, sonnet |
| `lib/guard.js` | 有 `preanswer` 時，硬停清單內的 Bash 指令回 ask | implementer, sonnet |
| `lib/stages.js` | 預答站的 gate 規則多一題；verify、land 規則說明預答時怎麼過 | implementer, sonnet |
| `tests/gate-preanswer.test.js` | 三個案例，見下 | 跟著上面的 implementer |
| `docs/03-decisions/2026-11-03-preanswered-gate.md` | 新決策：只限單一 task、一次問完，與 10-19 不設常駐答案的區別 | in-session — 一頁決策紀錄 |

proves it done: 新測試三案，現在都失敗：有預答時 verify 的 gate 不出問題、帶答案通過且紀錄標 `preanswered`；沒有預答時照舊要問；有預答時 `git push` 回 ask。
against the map: `docs/03-decisions/2026-10-19-no-unattended-gate.md` 拒絕的是 profile 常駐答案；本案只限單一 task，依它 :29 有案例重議，新決策紀錄寫明差別。
unverified: host 是否接受「allow + answers、不顯示問題」——目前只有 station 路徑與 gate.js:21-25 的探測註解支持。
not doing: station 頁另列預答清單（報告本來就在 gate 頁上）。

## 3. 跨機回顧：專案卡與來源分級 — 尚未 design

```json gate
{"questions":[{"header":"Design→Plan","question":"Design -> Plan | fankeel : TODO 全表盤點","options":[{"label":"Go to Plan (Recommended)","description":"接受 worktree 與「先問完、剩下自己跑」兩條做法（見 design.md 第 1、2 節）；跨機回顧照條目裡你已同意的方向直接排進 plan，不另開 design"},{"label":"Stay in Design","description":"還有一個決定沒定：跨機回顧要不要先在 design 把專案卡內容、面向判定規則定下來再排"},{"label":"暫停","description":"停在 design，next 設成「接著 design 跨機回顧」，三條都留 Ready"}],"multiSelect":false},{"header":"預答時點","question":"預答在哪一站問？","options":[{"label":"plan 結束時 (Recommended)","description":"有 plan 時在 plan gate 一起問 verify、land 的答案；沒有 plan 的路線在 design 結束問。只存在這個 task，不進 profile"},{"label":"任何一站都能開","description":"每個 gate 都多一個「後面都照預設跑」選項，你什麼時候要離開就從哪站開"}],"multiSelect":false},{"header":"硬停清單","question":"預答後哪些動作仍要停下來等你？","options":[{"label":"push 與刪除","description":"推到 GitHub／gitea、刪檔或刪分支、git reset --hard 這類不可逆動作"},{"label":"land 的 merge","description":"本機 merge 回 main 也停；不選就照預答自己 merge（profile 是 land merge、no push）"},{"label":"啟動外部程式","description":"COM、Word／PowerPoint、任何會跳出視窗的 GUI 程式，就是 10-21 夜裡那種"},{"label":"spec／plan 沒列的手段","description":"新的檔案類型、新的工具或做法，計畫裡沒寫到就停"}],"multiSelect":true}],"next":"design：worktree、先問完兩條已出做法，跨機回顧待定"}
```
