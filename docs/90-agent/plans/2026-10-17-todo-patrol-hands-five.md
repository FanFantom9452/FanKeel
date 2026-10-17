---
status: design-intent
---

# TODO 全表盤點（10-17）：五條 Ready 的真機實測 Implementation Plan

**Goal:** 使用者在場，把五條 Ready（終端啟動讀遠端狀態、面板真機沒看完的四件事、子代理 brief 改走 spawn、接縫「profile 中途翻轉」、Desktop 真機看壓縮視窗）各實測一次，結果寫回條目，成立的關、不成立的寫下差在哪。
**Architecture:** 五條的核心動作都要使用者親手在終端、Desktop、站頁操作（survey 的結論），所以五個 task 都是 `user`：使用者操作、念出看到的東西，本 session 當場讀 session 檔、records、transcript 佐證，再把結果寫進條目。只有接縫那條另外改 `docs/90-agent/reference/subagents.md`。由快到慢排：遠端狀態、面板四件事、spawn 探測、profile 翻轉、壓縮視窗（要跑過 400k，最慢）。
**Tech Stack:** Node v24.9.0，Claude Code 安裝版與 Desktop，fankeel 0.111.17（Desktop 讀安裝快照，所以面板那條先 `claude plugin update fankeel@fankeel`）。
**Spec:** [survey.md](../../../.fankeel/build/task-20261017T125451/survey.md)

## Global Constraints

由 `node scripts/map.js`（951 份 markdown、19 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）產生：

- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`（`CONTRIBUTING.md` 的 TODO entries 列）；改完跑 `node scripts/todo-check.js`，exit 0。開放中的條目受 `node scripts/docs-check.js` 的 gone、symbol、quote 檢查：新寫的內文不寫 `path:line`，不把不存在的名字放進反引號。
- 條目的關閉由 land 照 registry 的 `todo` 欄跑 `todo.js done`；結果不成立、條目要留著的，land 只關成立的那幾條。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit 改，不用 heredoc。
- 使用者的 `~/.claude/settings.json` 由使用者自己改，本 session 不寫。
- 每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- 互動式 session 的 hooks module 沒載入（rollout 旗標 `tengu_plugin_hooks_modules` 關著）— Task 3 — 先看 debug log 有沒有 `hooks module … loaded`，沒有就把這個結果寫進條目，停在步驟 2，不硬做後面。
- 撞檔要兩個 live session 碰同一個檔，guard 是 `deny`，第二個 session 的 Edit 會被擋 — Task 2 — 用一個用完即丟的檔（`.fankeel/build/pane-clash.txt`，不進 git）讓兩邊各寫一次；被擋本身就是撞檔成立的證據，不關 guard。
- 翻轉 profile 會改專案的 `.fankeel/profile.json`（committed）— Task 4 — 步驟 4 一定還原成 `stage.agents survey`，並 `git diff .fankeel/profile.json` 為空才往下。
- 跑過 400k 要很久，可能今天跑不完 — Task 5 — 跑不完就在條目記下設了什麼、跑到多少，條目維持 ready，land 不關它。

## Task 1: 終端啟動讀遠端狀態

**Files:**
- Modify: `docs/90-agent/todo/pane-7.md` — 檔尾加完成紀錄
- Read: `hooks/pane.ts` — band 尾巴從 session 檔的 `bridgeSessionId` 判斷遠端

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 要在終端啟動的 session 裡開關 Remote Control，子代理開不了。

1. 使用者在終端 `claude` 啟動一個 session，打 `/fankeel` 開一個用完即丟的任務（Start，`--route "build,verify"`）。
2. 使用者開 Remote Control，念出 band 尾巴；本 session 讀 `~/.claude/sessions/<那個 pid>.json` 的 `bridgeSessionId`：

```sh
node -e "const fs=require('fs'),p=require('path'),d=p.join(require('os').homedir(),'.claude','sessions');for(const f of fs.readdirSync(d)){const j=JSON.parse(fs.readFileSync(p.join(d,f)));console.log(f,j.sessionId,j.bridgeSessionId)}"
```

3. 使用者關 Remote Control，再念一次 band 尾巴，本 session 再跑一次上面的指令。
4. 本 session 在 `docs/90-agent/todo/pane-7.md` 檔尾空一行，加入（尖括號換成看到的）：

```md
## 完成紀錄（2026-10-17）

終端啟動的 session <id>：開 Remote Control 時 band 尾巴是「<看到的>」，session 檔的 bridgeSessionId 是 <值或沒有這個欄位>；關掉後是「<看到的>」，bridgeSessionId 是 <值>。
```

5. 跑 `node scripts/todo-check.js`，exit 0。成立的話這條由 land 關；讀不到就照完成條件寫出 session 檔實際有什麼，條目仍由 land 關。

## Task 2: 面板真機沒看完的四件事

**Files:**
- Modify: `docs/90-agent/todo/pane-1.md` — 檔尾加完成紀錄
- Modify: `docs/90-agent/todo/pane-13.md` — 看到不對時 `todo.js new` 寫出的第一條（再多就 pane-14 起，照實記）
- Modify: `.fankeel/build/pane-clash.txt` — 用完即丟的撞檔標的，不進 git，步驟 6 刪掉
- Read: `hooks/pane.ts` — ⚑、gate 倒數、Pane 自動開關的畫法

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 四件事都要在 Desktop 與終端用眼睛看。

1. 使用者跑 `claude plugin update fankeel@fankeel`，重開 Desktop。
2. 自動開關：使用者在 Desktop 開新 session、`/fankeel` 起一個用完即丟的任務，看 Pane 有沒有自己打開；關掉 Pane，打一個 prompt，看會不會再跳出來。
3. 撞檔：兩個 session 各寫一次 `.fankeel/build/pane-clash.txt`（第一個用 Write 建檔，第二個也去寫；guard 是 deny，第二個被擋是預期），看兩邊第一行有沒有 ⚑ 與紅色色帶、Pane「其他 session」有沒有一行共用。
4. gate 倒數：本 session 問一個 AskUserQuestion，使用者先不答，看第一行有沒有黃底「gate 在等」與倒數、Pane 沒有畫它也沒有自己打開。
5. 顏色：使用者在終端與 Desktop 各看一次兩行 band 與 Pane 的顏色，含淺色主題。
6. 收尾：用完即丟的任務 `task.js down`，看 Pane 有沒有自己關；刪掉 `.fankeel/build/pane-clash.txt`。
7. 本 session 在 `docs/90-agent/todo/pane-1.md` 檔尾空一行，加入：

```md
## 完成紀錄（2026-10-17，0.111.17）

- 撞檔：<兩邊第一行與 Pane 看到什麼>
- gate 在等：<第一行與 Pane 看到什麼>
- 顏色：<終端、Desktop、淺色主題各看到什麼>
- Pane 自動開關：<開任務、關掉後、任務結束各看到什麼>
```

8. 看到不對的那一件，用 `node scripts/todo.js new` 各開一條（body 至少 200 字，說來源、要做成什麼、完成條件）。跑 `node scripts/todo-check.js`，exit 0。

## Task 3: 子代理 brief 改走 spawn — 互動式探測

**Files:**
- Modify: `docs/90-agent/todo/brief-3.md` — 檔尾加探測結果
- Modify: `docs/90-agent/todo/brief-6.md` — 探測成立時 `todo.js new` 寫出的 design 條目
- Read: `.fankeel/build/2026-10-17-spawn-probe/mod/hooks/probe.ts` — records 的路徑與 nonce
- Read: `.fankeel/build/2026-10-17-spawn-probe/records` — probe 寫下的 agent.spawn 與 session.append.call
- Read: `.fankeel/build/2026-10-17-spawn-probe/check.mjs` — 假引擎上的驗證

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 要在互動式 session 載入 mod 並派子代理，`claude -p` 代替不了。

1. 本 session 先跑 `node .fankeel/build/2026-10-17-spawn-probe/check.mjs`，確認探測檔還能過。
2. 使用者在終端跑：

```sh
claude --plugin-dir .fankeel/build/2026-10-17-spawn-probe/mod --debug-file .fankeel/build/2026-10-17-spawn-probe/debug.log
```

   本 session 讀 `debug.log` 有沒有 `hooks module` 與 `loaded`；沒有就跳到步驟 5，結果寫「module 沒載入」。
3. 使用者在那個 session 派三個 description 含 `mod-probe b` 的子代理，prompt 各不相同（例如「讀 README.md 第一行」「讀 package.json 的 version」「列出 hooks/ 的檔名」）。
4. 本 session 讀 `.fankeel/build/2026-10-17-spawn-probe/records`：三筆 `agent.spawn` 的改寫 prompt 是否以 `MOD-PROBE-SPAWN-<probe.nonce4 的值>` 結尾，`session.append.call` 的回傳或 `{deny}`；transcript 有落地就看 session 目錄下 subagents 裡那個 agent 的 jsonl 第 1 行。
5. 本 session 在 `docs/90-agent/todo/brief-3.md` 檔尾空一行，加入：

```md
## 探測結果（2026-10-17，互動式）

- module 載入：<有／沒有，debug log 那一行>
- 三個子代理的第 1 行：<各自是否以 nonce 結尾，或 transcript 未落地、改看 records>
- session.append：<回傳或 deny>
- 結論：<成立，另開 design／不成立，關閉>
```

6. 成立的話用 `node scripts/todo.js new` 開一條「brief.js 哪一部分搬到 agent.spawn」的 design 條目；不成立就只寫結果。兩種情況本條都由 land 關。跑 `node scripts/todo-check.js`，exit 0。

## Task 4: 接縫「profile 中途翻轉」

**Files:**
- Modify: `docs/90-agent/reference/subagents.md` — 「The profile moves under a running stage」一節寫五個 hook 的實際行為
- Modify: `docs/90-agent/todo/stage-agents-5.md` — 檔尾加完成紀錄
- Modify: `.fankeel/profile.json` — `task.js profile set` 暫設 `stage.agents all`，步驟 4 還原，最後 diff 為空
- Read: `assets/station/station.js` — 站頁 settings 的 context 步驟

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 翻轉要在站頁 `#/settings` 點，而且要卡在 brain 跑到一半。

1. 使用者在另一個終端開 session，`/fankeel` 起用完即丟的任務 `--route "design,land"`；開始前本 session 跑 `node scripts/task.js profile set stage.agents all`，記下 `.fankeel/profile.json` 與那個 session 紀錄裡的 `stage.agents`。
2. 那個 session 的 design brain 還在跑時，使用者打開 http://127.0.0.1:28888/#/settings，context 步驟點「不在意，全部自己跑」，確認送出。
3. 照 `docs/90-agent/todo/stage-agents-5.md` 的探測步驟 3 逐項看 inject、brief、gate、resume、guard 各讀到新舊哪一份；使用者念出那個 session 看到的訊息，本 session 讀 `.fankeel/build/<那個 task>/` 的檔案佐證。
4. 本 session 跑 `node scripts/task.js profile set stage.agents survey` 還原，`git diff .fankeel/profile.json` 要為空。
5. 本 session 在 `docs/90-agent/reference/subagents.md` 的「The profile moves under a running stage」一節，把五項結果各寫一句（inject／brief／gate／resume／guard：讀到 <新／舊>，看到 <訊息>），更新頁首 `last_verified: 2026-10-17`。
6. 在 `docs/90-agent/todo/stage-agents-5.md` 檔尾空一行，加入：

```md
## 完成紀錄（2026-10-17）

在跑的 design 站移出 stage.agents 的翻轉跑過一次，五個 hook 的結果寫進 subagents.md 的「The profile moves under a running stage」。
```

7. 跑 `node scripts/docs-check.js` 與 `node scripts/todo-check.js`，兩個 exit 0。

## Task 5: Desktop 真機看壓縮視窗

**Files:**
- Modify: `docs/90-agent/todo/compact-4.md` — 檔尾加完成紀錄
- Read: `lib/context.js` — context 行的 No auto-compact window is set 那一句

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 要改使用者自己的 settings、重開 Desktop、跑一個真任務過 400k。

1. 使用者在 `~/.claude/settings.json` 的 `env` 加 `"CLAUDE_CODE_AUTO_COMPACT_WINDOW": "450000"`，重開 Desktop。
2. 使用者在 Desktop 開一個 fankeel 任務（1M 視窗的模型），做到 context 過 400k；過 400k 時念出注入塊的 `context:` 行有沒有 No auto-compact window is set 那一句。
3. 本 session 讀那個 session 的 transcript，找 `compact_boundary` 與它的 trigger、壓縮前的 token 數：

```sh
grep -n compact_boundary <那個 session 的 transcript>.jsonl
```

4. 本 session 在 `docs/90-agent/todo/compact-4.md` 檔尾空一行，加入：

```md
## 完成紀錄（2026-10-17）

- settings env 是否吃得到：<session <id> 有沒有自己壓>
- hook 看不看得到：過 400k 時 context 行 <有／沒有> 那一句
- 1M 視窗在 450000 的觸發點：<壓縮前的 token 數，trigger>
```

5. 三件都看過就由 land 關；主機沒壓、那一句誤報、或今天沒跑到 400k，就寫下差在哪或跑到多少，條目維持 ready，land 不關它。跑 `node scripts/todo-check.js`，exit 0。

## Coverage

| promise | task |
|---|---|
| pane-7 終端啟動讀遠端狀態 | Task 1 |
| pane-1 面板真機沒看完的四件事 | Task 2 |
| brief-3 子代理 brief 改走 spawn | Task 3 |
| stage-agents-5 接縫「profile 中途翻轉」 | Task 4 |
| compact-4 Desktop 真機看壓縮視窗 | Task 5 |
