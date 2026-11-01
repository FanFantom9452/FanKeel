---
judged: 2026-11-01T16:06:06.543Z
model: fable
agent: fankeel-judge
task: "教授 11-01 功能：Gitea/CI、測試分層、plan 拆組、station 依 stage 分組"
session: 56cbbc34-06e8-4768-a2a1-7741e5d6a847
stage: design
human: yes
---

# 判官題：多人協作時，進行中的 session 狀態要不要進共用層

## Question

# 判官題：多人協作時，進行中的 session 狀態要不要進共用層

html: yes

## 問題

fankeel 交給教授與實驗室多人使用時，進行中的 session 狀態要不要分享？若要，用哪一種共用層？

## 選項

- A. 不分享進行中狀態：`.fankeel/sessions/`、`.fankeel/build/` 維持本機、gitignore；只分享 land 後已進版控的任務紀錄（docs/90-agent/records）與 ≤2MB 的對話 bundle。另加本機保留期限清理處理累積。
- B. 把 registry（sessions/*.json）與 build 報告 commit 並 push 到 git（Gitea），多人透過 pull 看見彼此的進行中任務。
- C. 本機 SQLite 取代 sessions/ 與 build/ 的檔案（單機查詢、清理變容易，但不跨機器）。
- D. 伺服器資料庫（如 Postgres，或 Gitea 本身的 API／issue 當共用層），多人即時看到彼此的 session、claim 與 stage。

## 背景

- 使用者的顧慮：session 之間的任務過程常互相相關（一個任務的 survey 結論、決定、claim 影響另一個），只分享 land 後的紀錄可能太晚。
- 教授 2026-11-01 談話 F:/ymlab/SBIR/ProjectWorkspace/語音 261101_151532.txt 第 1431–1470 行（01:17:01–01:18:49）：教授問背後的 Database 是不是 Postgres，並說「等到複雜一點就是多人協作，你如果不弄那個就沒辦法多人協作」；使用者回答可能本地弄 SQLite，也承認文件一直累積會是問題。
- 本機量測（fankeel repo，2026-11-01）：483 筆 session 紀錄（6.3MB）、777 個 build 項目、47 個 tmp 檔、178 份 Claude Code transcript。
- 教授的專案在 Gitea（gitea.cillab.me/CIL-Team/RH），已有 Gitea Actions CI。目前沒有 tea、gh、Gitea token。
- 現有機制：registry 是每個 session 一個 JSON，hook 每個 prompt 讀寫；scope guard 依其他 live session 的 claims 擋編輯，live 由本機 process 判定；station 讀所有 registry 畫網頁；land 可 `--commit` 一份 ≤2MB bundle；retro-all 讀別人 commit 進來的 bundle。

## 要讀的路徑

- .fankeel/.gitignore
- docs/90-agent/reference/registry.md
- docs/90-agent/reference/collisions.md
- docs/90-agent/reference/station.md
- skills/fankeel-land/SKILL.md（第 260–300 行，bundle 匯出）
- lib/registry.js（liveness 判定、讀寫路徑）
- F:/ymlab/SBIR/ProjectWorkspace/語音 261101_151532.txt 第 1425–1470 行

## 什麼算答案

選定 A–D 之一（或明確的組合），說明它怎麼處理「session 互相相關」這個顧慮、對 scope guard 與 liveness 的影響、累積問題怎麼解；並說出什麼事實出現時答案會翻轉。

## 答案形狀

照 fankeel-judge 的七欄，`ask human:` 最後；接 `## 白話`（≤600 字）與 `## Summary`，Summary 附一張 A–D 比較表。

## Answer

pick: A（本機不分享進行中狀態 + 保留期限清理），再加一條補強：survey／design 的結論在 stage 通關時就以小檔進版控（docs/03-decisions 或 records），不等 land；D 留作翻轉目標
why: guard 的 liveness 是本機 pid 判定（collisions.md:156-164、lib/live.js:41-45,145），別台機器 commit 進來的 registry 條目要嘛 configDir 讀不到而「永遠 live」、要嘛 worktree 路徑不同而「永不擋」，B 讓 scope guard 失去意義。
registry 每個 prompt 整檔重寫 updated/clock（lib/registry.js:453-466, :301-302），B 會讓每次 pull 都帶一堆無意義 diff；而且任何程式都不刪 sessions/ 或 build/（registry.md:364），B 會把 483 筆、6.3MB 的增長推進 git 歷史。
教授的話只有「多人協作要有 DB」一句，沒說即時、同伺服器或 Gitea（語音:1455,1457）；使用者當場說「等教授用一段時間之後再往後推進」（語音:1470-1472），今天沒有 token、沒有第二個同時用的人，D 是過早投資。
C 只解單機查詢與清理，對「session 互相相關」零貢獻，卻要重寫 hook 每個 prompt 讀寫的 registry 層。
「互相相關」的真正缺口是結論太晚進版控，不是 registry 不共用：把 stage 結論提早 commit 就補上，跨機器 claim 重疊本來就定義為 land 時合併（collisions.md:169-173）。
would flip if: 實驗室出現 ≥2 人同時在同一 repo 開 fankeel session 且實際撞到彼此的 claim → D（Gitea API/issue 或小服務當 claim 心跳層，liveness 改心跳）；
教授把「多人即時看到彼此 session」列為驗收項目並提供 Gitea token／伺服器 → D，分階段先做唯讀看板再做 claim。
unread: nothing（brief 所列七個路徑全部由 reader 讀過並抽查；station.md 第 695–1726 行僅 grep、lib/guard.js treeOf 與 scripts/record.js recordsRel 未開、語音 1472 行以後未讀、lib/chartroom 格式未讀故未畫 board）
delegated: .fankeel/.gitignore（sonnet）; docs/90-agent/reference/registry.md（sonnet）; docs/90-agent/reference/collisions.md（sonnet）; docs/90-agent/reference/station.md（sonnet）; skills/fankeel-land/SKILL.md:250-310 + scripts/record.js + skills/fankeel-retro-all/SKILL.md（sonnet）; lib/registry.js + grep scripts/*.js（sonnet）; F:/ymlab/SBIR/ProjectWorkspace/語音 261101_151532.txt:1425-1470（opus）
checklist: 1 .fankeel/.gitignore 今天 ignore 什麼 — answered（sessions/、build/、bundles/ 等 10 項被 ignore，tmp/ 沒有）; 2 registry.md 欄位／寫入者／清理 — answered（無任何刪除；inject.js 每 prompt 寫）; 3 collisions.md guard 與 live 定義 — answered（本機 configDir+pid；不同 worktree 跳過）; 4 station.md 讀哪裡、跨機器 — answered（本機 registry 聯集；跨機只靠 Tailscale 配對輪詢，非 git）; 5 land bundle 匯出 — answered（僅 transcript，≤2MB，--commit 放 records/sessions）; 6 lib/registry.js liveness／路徑／清理 — answered（無 pid、無 hostname、無 prune；每 prompt 整檔重寫）; 7 語音 1425-1470 教授原話 — answered（一般性提醒，無具體要求；使用者未承諾）
ask human:
  - q: 教授那句「不弄那個就沒辦法多人協作」，是這個計畫的驗收要求，還是用過之後的一般提醒？
    option: 驗收要求，且教授會提供 Gitea token 或伺服器 → pick 變成 D（先做唯讀共用看板，再做 claim 心跳），A 的清理照做
      pro: 一次把 liveness 改成心跳、資料進共用層，之後不必再搬一次。
      con: 今天沒有第二個使用者、沒有 token，先建伺服器會先付運維成本卻沒人看。
    option: 一般提醒，等用一段時間再說 (assumed)
      pro: 現有機制全部不動，只加清理與提早 commit 結論，風險最低。
      con: 若之後真的多人同時用，跨機器 claim 要重做一次。
    reason: 這是教授的期待與承諾，錄音只到他說完那句、使用者說「再想想」，repo 裡沒有任何文件記錄驗收條件。
  - q: 接下來三個月內，RH repo 會不會有兩個人以上在同一時間各開 fankeel session？
    option: 會，且常態 → pick 變成 A 先行、兩週內啟動 D 的唯讀看板
      pro: 真正的即時互看需求出現時才投資，不會白做。
      con: 中間這段時間兩人只能靠 git 合併發現重疊。
    option: 不會或很少，主要是教授一人與使用者輪流 (assumed)
      pro: 單人或輪流使用時，本機 registry 加提早 commit 結論已經涵蓋「互相相關」。
      con: 若判斷錯誤,第一次撞 claim 時才會發現沒有保護。
    reason: 這是實驗室的人力安排，不在任何檔案裡。

## 白話

結論：進行中的 session 狀態留在各自電腦上，不要推到 git 或伺服器；但把每個階段的「決定」提早存進版控，另外加一條自動清理舊檔的規則。

比喻：每個人工作時的草稿本（哪個檔案正在改、改到第幾步）留在自己桌上，公告欄只貼「結論」。現在的問題不是草稿本沒共用，而是結論要等整個任務結束才貼出來，太晚——所以改成每過一關就貼一次。

為什麼不直接共用草稿本：fankeel 判斷「誰還活著」是看自己電腦上的程式有沒有在跑，別人電腦的紀錄拿過來，系統會誤判成永遠活著或根本看不到，反而擋錯人。而且草稿本每打一句話就整本重寫，推到 git 會一直產生沒意義的改動。

教授提的資料庫，是「多人同時用」時才需要；現在還沒有第二個人同時用，也沒有伺服器帳號，等真的出現兩人同時撞到同一個檔案，再把「誰活著」改成心跳回報、接上 Gitea。

## Summary

### 各 reader 的發現

**.fankeel/.gitignore（sonnet）**：全檔 10 行，`sessions/`、`map.md`、`build/`、`index.html`、`station/`、`worktrees/`、`sensitive.txt`、`station.bat`、`station.sh`、`bundles/` 被 ignore（.fankeel/.gitignore:1-10）；`tmp/` 不在裡面，與 git status 顯示 `?? .fankeel/tmp/` 一致。抽查：全檔自己讀過，吻合。

**docs/90-agent/reference/registry.md（sonnet）**：一筆 sessions/{id}.json 含 claims（60 上限）、seen、stage、task、started/updated/clock/moves/ended 等，無 pid、無 hostname（registry.md:31, :75-76, :150-172）。寫入者是 task.js、inject.js（每 prompt）、resume.js、gate.js、touch.js、brief.js、leave.js；每個 hook 只寫自己的檔，從不刪別人的（:559, :565-566）。「nothing deletes an entry — down and clear both deactivate」（:364）、「The registry does only grow … which is the argument for a bound somewhere」（:389）。根路徑靠往上找 `.fankeel/sessions/`，只有 `--root` 可覆寫（:48, :67-69）。抽查 :364 吻合。

**docs/90-agent/reference/collisions.md（sonnet）**：guard 只讀 live 鄰居的 `claims`（:75）；「A dead session's claim never blocks」，liveness = 該 session 自己記的 configDir 下 `sessions/<pid>.json` 加上 pid 真的在跑（:155-158）；configDir 讀不到時「every claim resolved through that directory counts as live」（:162-164）；「A different worktree never blocks」（`treeOf(data) !== treeOf(mine)` 直接 continue，:169-170），跨 tree 的重疊「is a merge to reconcile at land, not a clash」（:172-173）。全文沒有任何 remote／other machine／other user 字眼。抽查 :153-173 吻合。

**docs/90-agent/reference/station.md（sonnet）**：資料來源是本機八個來源聯集出的各 workspace `.fankeel/sessions/`（:103-122）；頁首「Every fankeel session on this machine」（:9）。跨機器只有 Tailscale 配對的電腦透過 `lib/peers.js` 每 5 秒輪詢 `GET /station/mobile.json?own=1`（:1517），預設關閉（:1608），走的是即時 HTTP 不是 git。沒有依 stage 分組 session 列表；沒有依年齡清理（roots 只在目錄消失時掉出，:122-127）。抽查 :1517 吻合。reader 聲明 :695-1726 只 grep 未通讀。

**skills/fankeel-land/SKILL.md + record.js + retro-all（sonnet）**：bundle 只包 transcript（含 adopted），遮罩 sensitive，寫到 `.fankeel/bundles/<day>-<id8>.jsonl.gz`；`--commit` 把 ≤2MB 的放進 records bucket（SKILL.md:277-281；`BUNDLE_MAX` 在 record.js:115, :199）。超過 2MB 留本機並 ignore（record.js:200-201, :216）。retro-all 用 `record.js sessions --list` 掃本機 bundles 與 `<records>/sessions`（record.js:235；retro-all SKILL.md:26-27），描述即「after pulling bundles another user committed」（retro-all SKILL.md:3）。bundle 裡沒有 build 報告、survey 結論、決定。抽查 SKILL.md:276-282 吻合。

**lib/registry.js（sonnet）**：沒有 `process.kill`、沒有 tasklist；`readActive` 只過濾 `active === true`（:196-198）；`isStale` 是 `updated` 距今 >12h（`STALE_MS`，:24, :849-853）。`sessionsDir = path.join(projectRoot, '.fankeel', 'sessions')`（:136-142），根由 `CLAUDE_PROJECT_DIR || payload.cwd || process.cwd()` 往上找（:68-70, :93-108）。無 hostname／userInfo／machine 欄位。`touch()` 每 prompt 改 `updated` 與 `clock[stage]`（:453-466），`writeSession` 整檔 `JSON.stringify(data,null,2)` 寫 temp 再 rename（:301-302）；鎖是本機檔案鎖 `LOCK_STALE_MS=5000`（:334）。全 repo 沒有任何東西刪 `.fankeel/sessions` 或 `.fankeel/build/`（只有 tmp-clean.js 刪 OS temp 下的 `fankeel-*`、uninstall.js、station.js 刪自己的副本）。抽查 :194-198、:847-853 吻合。

**語音 261101_151532.txt:1425-1470（opus）**：教授只有四句相關——「背後的那個Database是Progress嗎」（:1431-1432，Progress 為 Postgres 的辨識誤寫）、「每一項東西都是變成MD」（:1442）、「等到複雜一點就是多人協作」（:1455）、「你如果說不弄那個就沒辦法多人協作」（:1457）。沒有即時、同伺服器、Gitea 等任何具體要求。使用者回「可能會考慮本地弄個SQLite」（:1449-1450）、「文件一直累積其實後面也會是一個問題，這個我還在想」（:1468-1469）。抽查 :1455-1472 吻合，並多看了 reader 被切掉的三行：「我是想說等教授用一段時間之後，看看有什麼更好的想法，我再來往後推進這個版本」（:1470-1472）——使用者當場的立場就是先觀望。

### 兩位 reader 的分歧與釐清

registry.js reader 說「live 就是 `active` 旗標＋12 小時 isStale，所以跨機器可用」；collisions.md reader 說「live 是 configDir 的 pid 檔＋process 真的在跑」。兩者都對但指的不是同一層：`lib/registry.js` 自己確實沒有 pid 檢查，但 guard 用的 `isLive` 在 `lib/live.js`（grep 證實 `running(pid)` 用 `process.kill(pid, 0)`，live.js:41-45；`isLive(state, sessionId, theirConfigDir)` live.js:145）。registry.js reader 「跨機器可用」的推論因此**不成立**——擋編輯的那條判定是本機 pid。這一點已寫進 context.md（第 1 筆）。

### 推到 pick 的理由

1. **「session 互相相關」的缺口在哪**：使用者的例子是「一個任務的 survey 結論、決定、claim 影響另一個」。拆開看：
   - 同一台機器的多個 session：registry、guard、inject、station 今天已互看，A 不改變這點。
   - 跨人的結論與決定：今天 survey.md／design.md 在 `.fankeel/build/`（ignored），只有 land 後的 record 與 ≤2MB transcript bundle 進版控——這才是「太晚」。補法是**提早 commit 結論**（stage 通關時把 handoff 的結論寫成 docs/03-decisions 頁或 records 行），這不需要共用 registry。
   - 跨人的 claim：collisions.md:169-173 已定義「跨 tree 的重疊是 land 時的合併，不是 clash」，git 本來就是這一層的共用層。

2. **B 為何不行**：(a) guard liveness 本機判定，別人的條目會「永遠 live」（configDir 讀不到 → 視為 live）或「永不擋」（treeOf 不同），兩種都不是想要的語意；(b) 每 prompt 整檔重寫 `updated`/`clock`，commit 等於每句話一個 diff，pull 時必衝突（本機檔案鎖對 git 無效）；(c) 無任何清理，6.3MB／483 筆的增長會進 git 歷史。

3. **C 為何不行**：只解查詢與清理，對協作零貢獻；清理用一支 prune 腳本就能對檔案做（條件：`active:false` 且 `ended.at` 超過 N 天的 sessions、對應 record 已存在且超過 N 天的 build/task-*、tmp/），不必換儲存層。

4. **D 為何不是現在**：教授的話是一般提醒（無具體要求），使用者自己說先觀望；今天沒有 Gitea token、沒有第二個同時使用者；D 要把 liveness 從 pid 改成心跳、hook 每 prompt 走網路（離線即失效）、加 auth 與運維。這些都是「兩人同時撞到 claim」出現時才值得付的成本，故列為翻轉條件。

5. **累積怎麼解**：A 加一條保留期限（建議 30 天）的 prune，只碰 `active:false` 且已 `ended` 的條目與已 land 的 build 目錄，保留 `adopt` 所需的近期條目；這與 registry.md:389「the argument for a bound somewhere」一致。

### A–D 比較表

| 選項 | 「session 互相相關」 | scope guard／liveness | 累積問題 | 成本／風險 | 判定 |
|---|---|---|---|---|---|
| A 本機＋清理（＋提早 commit 結論） | 同機已互看；跨人靠提早進版控的結論與 land 合併 | 不變，全部沿用 | 新增 prune（30 天、只刪 ended/已 land） | 最低；需寫 prune 與「stage 通關即 commit 結論」 | **選** |
| B commit registry 到 Gitea | pull 後看得到別人進行中欄位，但 claim 語意錯 | 壞：別人條目永遠 live 或永不擋；本機鎖對 git 無效 | 更糟：增長進 git 歷史；每 prompt 一個 diff | 看似最便宜，實際每次 pull 衝突 | 否 |
| C 本機 SQLite | 零改善（仍單機） | 不變，但所有讀寫方要改 | 查詢／清理變容易 | 重寫 registry 層，無協作收益 | 否 |
| D 伺服器 DB／Gitea API | 即時看到彼此 session、claim、stage | 必須改成心跳；hook 走網路，離線失效 | 由伺服器管理 | 需 token、auth、運維；今天沒有第二個使用者 | 翻轉目標 |

### 未查之處（請父 session 留意）

- `lib/guard.js` 的 `treeOf` 未開，無法確定別台機器條目在「主 checkout、無 worktree」情況下 treeOf 是否相等（若相等則走「永遠 live」那條；若不等則「永不擋」）——兩種結果都支持「B 的 guard 語意錯」，但哪一種會發生未驗證。
- `scripts/record.js` 的 `recordsRel` 未開，「`--commit` 放到 docs/90-agent/records/sessions/」是推論。
- station.md :695-1726 僅 grep。語音 :1472 以後未讀。
- 未讀 `lib/chartroom/` 的 line format，故未附 chartroom board，以上表代替。
- 已寫入 context.md 兩筆（guard liveness 本機判定；registry 每 prompt 整檔重寫且無清理），路徑 F:/ymlab/fankeel/.fankeel/build/task-20261101T152419/context.md。

## 人類的回答

answered: 2026-11-01T16:11:33.311Z

| 題目 | 判官假設 | 回答 | 分支 |
|---|---|---|---|
| 教授那句「不弄那個就沒辦法多人協作」，是這個計畫的驗收要求，還是用過之後的一般提醒？ | 一般提醒，等用一段時間再說 | 多人協作這邊先放著沒關係 我看重的是 SESSION 紀錄希望可以互通 然後在 GITHUB 上面溝通 | 分支外 |
| 接下來三個月內，RH repo 會不會有兩個人以上在同一時間各開 fankeel session？ | 不會或很少，主要是教授一人與使用者輪流 | 不會或很少，主要是教授一人與使用者輪流 | 照 pick: |
decision: 分支外 — 第二次 /fankeel-ask 帶 --record F:\ymlab\fankeel\docs\90-agent\judgements\2026-11-01-shared-session-state.md

