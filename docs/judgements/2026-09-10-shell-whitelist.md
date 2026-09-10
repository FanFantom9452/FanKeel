---
judged: 2026-09-10T15:04:31.604Z
model: fable
agent: fankeel-judge
task: "處理 TODO：Ready 一條與七條待決議，決議走 fankeel-ask"
session: 98873819-d200-4e3b-be77-be352547e51e
stage: design
---

# 判斷 6：subagent 的 Bash 與 PowerShell，白名單該擋到哪

## Question

# 判斷 6：subagent 的 Bash 與 PowerShell，白名單該擋到哪

## 問題

`guard.js` 只掛在 `Edit|Write|NotebookEdit`。一個 subagent 的一句 `git stash`
或 `Remove-Item` 就能收走並行 reader 的工作樹，沒有任何 hook 會看到。要不要擋？
擋的話白名單該擋到哪？

## 你可以自己讀的檔

- `.claude-plugin/plugin.json:75-85` — `PreToolUse`，matcher `Edit|Write|NotebookEdit`，
  跑 `hooks/guard.js`
- `.claude-plugin/plugin.json:50-60` — `PostToolUse`，同一組 matcher，跑 `hooks/touch.js`
- `.claude-plugin/plugin.json` 其餘六個 hook 註冊（14-24、26-37、40-49、62-73、
  86-96、98-109）——看清楚今天總共掛了哪些事件
- `hooks/guard.js:42` — `const file = targetOf(payload);`
- `hooks/guard.js:43` — `if (!file) return;`。這是它唯一的「看哪個工具」分支：
  有沒有路徑，沒有任何東西鍵在 `tool_name` 上
- `lib/guard.js:76-82` — `targetOf(payload)` 只讀 `tool_input.file_path` 與
  `tool_input.notebook_path`，兩者皆無就回 `null`。沒有命令字串的分支
- `lib/guard.js:179-187` — `decide({ mine, file, others, root, liveState })`，
  需要一個路徑字串
- `tests/guard.test.js:237` — 斷言 `tool_name: 'Bash', tool_input: { command: 'ls' }`
  回空字串。guard 對 Bash 沉默是**有測試的行為**，不是漏掉
- `docs/collisions.md` — scope guard 的參考頁

## 這個 repo 已經走過一次這條路

- `lib/dirty.js:13` — 「The rejected fix was to match `Bash` on PostToolUse and
  read the command string.」
- `lib/dirty.js:24` — 每個 prompt 付得起，每次 Bash 呼叫是另一回事
- `hooks/inject.js:143` — 「Here rather than on a Bash hook because the cost is
  one `git status`」
- `hooks/inject.js:146` — 「226ms after. Once a prompt is 41ms; once a Bash call
  would have made a」

也就是說：**配對 Bash 讀命令字串這條路，被這個 repo 評估過並否決過**，理由是
成本。這次要擋的是不同的東西（不是記錄改了什麼，而是攔下破壞），所以這次和上次
差在哪，是這題的核心。

## 還有一件平台的事

這台機器是 Windows，harness 除了 `Bash` 還有第二支 shell 工具（`PowerShell`）。
一個沒有指定 `tools:` 的 subagent 兩支都拿得到。任何只擋 `Bash` 的 matcher 在這裡
是半個防線。全 repo grep `PowerShell` 只在 `tests/survey.test.js:72` 命中，而那是
`survey.js` 比對 `.ps1` 檔內容，跟 hook matcher 無關。

## 算什麼是答案

擋或不擋。擋的話：matcher 寫什麼（`Bash`、`PowerShell`、還是兩者）、判斷依據是
什麼（既然 `targetOf()` 沒有命令字串分支，是要解析命令、還是用別的訊號）、
白名單是「允許清單」還是「拒絕清單」、以及 `lib/dirty.js:13` 那次否決的成本理由
這次為什麼不適用。不擋的話：說出 `tests/guard.test.js:237` 那個沉默要不要保留成
明說的設計，以及並行 reader 的工作樹靠什麼保護。

## 回傳形狀

- 一行結論。
- 三到六行理由，每行一個。
- 一行「這個決定在什麼情況下是錯的」。
- 不要重述這份 brief。

## Answer

**結論：不擋——不在 `Bash|PowerShell` 上掛 hook；`tests/guard.test.js:237` 的沉默保留並升格為明說的設計，工作樹靠 brief 的第四條規則、harness 自己的 `permissions.deny`、以及釘 commit 時一律用 worktree。**

- `lib/dirty.js:13` 的成本理由這次原封不動地適用：實測本機 `node -e ""` 起動 120–141ms，`hooks/guard.js` 吃一個 Bash payload 157–159ms，與當年否決的 `git status` 124–131ms 同一量級；PreToolUse matcher 只看工具名看不到命令，所以每一句 Bash、全機每個 session 都付這筆。
- Replay 唯一在案的「樹被切走」事件——`docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab2.sh:9` 與 `ab3.sh:11` 的 `git checkout --quiet 86a104e`——是主線程跑的一支腳本：hook 只看得到 `bash ab2.sh`，而 `agent_id` 閘（`hooks/carry.js:51` 的先例）會直接放行。對自身動機案例零命中的檢查是錯的檢查。
- 若真要擋，形式只能是拒絕清單（允許清單會擋掉 implementer 的 `npm test`／`node scripts/…`），matcher 寫 `Bash|PowerShell`（transcript 證實工具名是 `PowerShell`、輸入欄同樣是 `command`），依據是 `agent_id` 加命令字串正則，決定用 `deny` 不用 `ask`（背景 subagent 的 ask 沒人接）；但拒絕清單看不進腳本，正是 `lib/dirty.js:14` 說 parser 看不見的那一半。
- 工作樹的保護分三層：(a) plan §1 已 Ready 的 `RETURN_RULES` 第四條——`lib/render.js:353-357` 現有三條沒有一條講樹；(b) 使用者 settings 的 `permissions.deny`（`Bash(git stash:*)`、`Bash(git checkout:*)`、`Bash(git reset:*)`、`Bash(git clean:*)`、`PowerShell(Remove-Item:*)`），由 harness 執行、零 spawn、主線程與兩支 shell 一併涵蓋，寫進 `docs/collisions.md` 當操作者的一步而不由外掛出貨；(c) 要釘 commit 的工作一律 `git worktree add`，即 `docs/reports/2026-09-07-join-pair.md:41` 已採的解法。
- `tests/guard.test.js:233` 的測試名是「沒帶路徑就不說話」，講的是 payload 形狀不是 Bash；要讓它成為設計，改測試名或加一行註解指向這份判斷即可，行為不動。
- 沒查到與更正：brief 說 `PowerShell` 全 repo 只命中 `tests/survey.test.js:72`，其實 `TODO.md:76`、`scripts/docs-check.js:100`、`skills/fankeel/SKILL.md:338` 也命中，但沒有一處是 hook matcher，結論不受影響；`permissions.deny` 在本機 `defaultMode: "auto"` 與 A/B 腳本的 bypassPermissions 下是否仍生效，我沒有驗。

**這個決定在什麼情況下是錯的：** 有記錄顯示某個 subagent 直接打出一句裸的 `git stash`／`Remove-Item -Recurse`（不在腳本裡），且 `permissions.deny` 在 auto 模式下證實不攔——那就掛 `Bash|PowerShell` 的 PreToolUse、`agent_id` 閘、短拒絕清單、`deny`，把每次約 150ms 當作買來的價。

---

歸檔者註：這份判斷的 (b) 點列出一組 `permissions.deny` 條目。那是給操作者的建議，
不是這個 task 要落地的改動——沒有任何 settings 檔在這次被修改。harness 也把這份
回傳標記為「指令形狀」，原因就是這一段。
