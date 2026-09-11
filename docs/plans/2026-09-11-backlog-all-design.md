---
status: design-intent
---

# 改進 backlog 全部實作 — design

2026-09-11，session `13ebea34`。使用者在 survey gate 選「全部實作」：`TODO.md` 的
`## Ready` 一條、`## Needs a decision` 七條，加上 survey 找到的〔profile〕缺口與
唯讀 agent 用 Bash 寫檔的洞。每一節各自獨立，編號是 plan 覆蓋表的來源。

**不在這個任務裡**：ponytail 兩條（使用者定的順序：等第 4 節 caveman 解耦落地才開始，
是下一個任務）、Waiting 的 design class 與其餘條目。

**硬約束：注入容量。** `tests/render.test.js:530` 量到 design 與 land 的注入區塊
2396/2400、init 加 station 行 1361/1400。所以本設計**不加任何一條注入規則文字**：新行為
一律放在 script 輸出、skill 內文或條件行。任何一節做不到這點，就是那一節的設計錯了，
不是容量該調。

## 0. 共通

- 每一節先寫一個現在會失敗的測試，改完變綠；`npm test`、`docs-check`、`todo-check`、
  `skills-check` 全部 exit 0。
- `tests/render.test.js` 的容量測試不刪任何字就保持綠色。
- 每一節改到的 reference 頁（`docs/documents.md`、`docs/registry.md`、
  `docs/station.md`、`docs/collisions.md`、`skills/*`）在同一個 task 裡改掉。

## 1. 導覽表截斷要說丟了幾列（Ready〔map〕）

`lib/map.js:22-23` 的註解說丟掉的列數還會印出來，但 `firstTable()` 只回切掉後的陣列、
`signpost()` 也不印，程式與自己的註解相反。

- `signpost()` 多回一個 `dropped`；`buildMap()` 在導覽表下面印
  `... and N more, not listed`，與 `listing()` 同一句話。
- `firstTable()` 的回傳形狀不變，`tests/map.test.js:31-44` 照舊通過。
- 測試：30 列的導覽表，map 裡出現 `... and 6 more, not listed`。

## 2. 範圍引用 `path:N-M`

範圍引用持有的是一段區塊，不是一行，所以檢查也要對一段。

- `PATHISH`（`scripts/docs-check.js:89`）多收一個選擇性的 `-M`（連字號與 en dash 都收）。
- 超出：`M` 大於檔案行數、或 `N > M`，報 past-end。
- 引文：頁面在引用旁引了字串時，那個字串要落在 `N..M` 之內；只在別處找到一次就報
  `moved`，並建議一段等長的新範圍；找不到報 unquoted。
- `scripts/docs-audit.js` 不動：它的兩處 `PATHISH.exec` 只讀 `hit[1]`。
- `docs/documents.md:321` 那條沒寫檔名的 `:445-453` 補上檔名（內容修正，不是規則）。
- 測試：`tests/docs-check.test.js` 新增三例——範圍超出、引文在範圍外、引文在範圍內。

## 3. drift 同時列出兩個方向

日期比不出是誰錯：`code 在頁面之後改了` 這一個條件，同時是「頁過期」與「code 偏離了
文件」。所以偵測條件不動（`scripts/docs-audit.js:437`），改的是每一列說什麼、讀的人
怎麼分流。

- 每一條 drift 列出頁面日期之後動到它主題的最多三個 commit subject，並寫
  `page stale, or the code departed from it`，不再預設是頁面的錯。
- `skills/fankeel-audit/SKILL.md` 的分流：commit 本來就要改這個行為 → 改頁面；
  沒有 commit 說要改 → code 是嫌疑，開一條 TODO，頁面不動。
- `tests/docs-audit.test.js:76`（頁面比主題新就不算 drift）保持不變。
- 測試：drift fixture 帶一個 commit，那一列帶著它的 subject。

## 4. caveman：取捨與解耦

已確認 caveman 有 20 個 skill、3 個 agent、6 個 command、2 個 hook。fankeel 已經有其中
8 項：reader、reviewer、五個 pattern skill，還有逐 prompt 重新注入。其餘是 Caveman Cloud
的收費與遙測、講話風格、重複的 command，全部不拿。**可拿的四項由使用者在 gate 勾**：

使用者四項全勾，附帶條件：每一項都要符合 fankeel 的開發場景才加。所以每項寫明它在
這個 repo 會用在哪裡；只有一半符合的，只拿那一半。

- A `caveman-learn` → `skills/fankeel-build/SKILL.md` 一條：以成本為理由的改動，
  plan 的 task 寫明量它的 script 與改前的數字，verify 用同一支再量一次，沒有變好就
  把那個 task 退回，不留著。場景：第 6 節本身就是第一個——`hooks/size.js` 要不要留，
  由 `scripts/sessions.js` 的前後兩次決定；本 repo 已經有的 A/B 報告
  （`docs/reports/2026-09-03-dispatch-vs-inline.md`）是同一件事的手工版。不拿它的
  「自動改 memory」那一半：memory 的改動走第 5 節，由使用者點。
- B `caveman-stats` → `skills/fankeel-verify/SKILL.md` 的證據表：成本、token、計數
  類的說法，證據欄貼的是一次沒有經過管線截斷的命令輸出，不是模型估的，也不是重打
  的命令。場景：這個 repo 的報告數字被 `| head` 截成 10、被改寫過的 regex 算錯過
  三次，這些教訓目前只存在使用者的 memory 裡，搬進 skill 才會跟著外掛走。不拿它的
  hook：`task.js show` 與 station 已經由 hook 算好成本，模型本來就只轉述。
- C `cavecrew-builder` → `agents/fankeel-fixer.md`：工具只有 Read、Edit、Write、Grep、
  Glob（沒有 Bash、沒有 PowerShell），碰到三個以上檔案的改動就拒絕，回傳改了哪幾行；
  model 下限 sonnet。**只用在不需要跑測試的修正**：verify 與 audit 抓到的 reference
  頁假句（`docs/decisions/2026-09-10-judge-to-ask.md` 記的那七行分兩輪修完就是這種），
  以及一行的 code 修正，而測試由派它的一方跑。需要紅綠循環的 build task 仍然派
  implementer——一個跑不了測試的 agent 做不了 TDD，這是它不符合場景的那一半。
- D `cavemem` 的 `supersede`/`history` → 第 5 節的修正慣例。場景：09-11 改正
  `workflow-run-meta-json` 時就是這樣做的——保留原來的量測，加一行
  `**Corrected 2026-09-11:**` 說錯在哪。不拿它的 SQLite 與 BM25：原生 memory 是
  純檔案，由 Claude Code 自己載入。
- 解耦：`lib/badge.js:166,181` 的註解改成「別的外掛的旗標」，不點名；reference 頁
  不再把 caveman 寫成一個還在的依賴（`docs/plans/2026-09-08-behaviour-eval.md` 是
  plan 紀錄，不動）。
- 解除安裝是使用者的指令，land 時提出，不由 session 執行。

## 5. memory 清理

Claude Code 的原生 memory 只會寫、不會清。今天有 79 條：30 條引路徑、5 條引
`path:line`、11 條引旗標。survey 標成失效的 6 條全是誤判，因為它們引的是 repo 外的路徑。
今天被抓到錯的那一條（`workflow-run-meta-json`：寫說沒有逐 agent 的細項）是讀者核對時
發現的，沒有任何東西會自己抓到它。

- `scripts/memory-check.js [--root <project>] [--config-dir <dir>]` 找
  `<configDir>/projects/<slug>/memory/`，slug 由專案絕對路徑把 `:`、`\`、`/` 換成 `-`
  （`F:\ymlab\fankeel` → `F--ymlab-fankeel`）。
- 只報告、從不寫檔。報的有四種：索引與檔案兩個方向對不上；引用的 repo 路徑已不存在
  （`dead`）；`path:line` 超出檔尾（`past-end`）；`stale`——條目的 `modified` 早於它引用
  的某個檔案最後一次 commit，意思是「這個檔在這條 memory 寫下之後改過了」。
- 只看第一段是專案頂層已追蹤項目的路徑，所以 `~/.claude/...`、別的專案、
  `.fankeel/build/<plan>/` 這種樣板片段都不報。這一條是 survey 那 6 條誤判換來的。
- 前三種讓 exit 非零；`stale` 只列出來，因為一條正確的 memory 也可以引一個後來改過的檔。
- 重用 `resolveRef`（`scripts/docs-check.js:158`）、`CODE` 與 `PATHISH`、
  `lib/docs.js` 的 `frontmatter()`，不另寫 regex。
- 修正慣例（勾了 D 才有）：改錯的條目保留一行 `**Corrected YYYY-MM-DD:**` 說錯在哪，
  不默默改寫；刪除只刪使用者從清單上點的。
- 觸發：`/fankeel-audit` 把它當第四支 scanner 跑；fankeel-land skill 在「這個任務寫過
  memory」時點它一次。不進注入規則。
- 測試：fixture memory 目錄——失效路徑被報、別專案路徑不報、git fixture 造出 `stale`、
  索引兩個方向對不上都被報。

## 6. 主 session 堆疊

09-11 的量測顯示約九成是主迴圈自己的工具輸出。所以手段打在源頭，並且先有量尺才改。

- `scripts/sessions.js --config-dir <dir> --project <slug>`：由
  `.fankeel/build/ask/measure-sessions.js` 升格而來，印出 09-11 那張表（峰值中位數與 p90、
  回傳佔比、倒退次數）。這是改之前與之後的量尺。
- 大輸出提醒。官方 hooks 文件（https://code.claude.com/docs/en/hooks.md）說 PostToolUse
  的輸入帶 `tool_response` 物件，也可以回 `additionalContext`；本機還沒實際觀察過，所以
  build 的第一步先探測一次，runtime 沒帶就整條改成 Waiting。新增 `hooks/size.js`，
  主 session 裡單次工具輸出超過 20,000 字元時，回一行 additionalContext：
  `<tool> returned N chars into this context — pipe it or send a fankeel-reader next time`。
  每個 prompt 至多一次；輸入帶 `agent_id` 的（也就是 subagent 內）不說。
- 第二次 verify→build：`task.js stage build` 發現 `moves` 裡已經有一次 verify→build 時，
  在輸出裡印 `second return to build from verify — name what verify caught that build's
  review did not, and add that check to the review`。只是 script 輸出，不佔注入。
- 測試：size hook 收到 30k 的輸出說話、1k 不說；stage 用 `moves` fixture。

## 7. station 的單一 session 細節

使用者要知道：這個 session 有幾個 task、各做什麼、主 agent 怎麼切派工、哪裡本來可以
平行。這些資料都已經在磁碟上，只是 station 沒有讀。

- `lib/usage.js` 新增 `dispatchesOf()`，每一次派工一列：
  `{surface, turn, label, agentType, model, tokens}`。一般的 agent 從主 transcript 的
  Agent tool_use（`subagent_type`、`model`、`description`）來，同一則 assistant 訊息裡
  有兩個以上的算 `agents`；workflow 從 `workflows/<run>.json` 裡 `type: workflow_agent`
  的列來，依 `type` 過濾，不靠位置。
- 任務：這個 session 的 claims 裡的 `docs/plans/<stem>.md`（不含 `-design`）對到
  `.fankeel/build/<stem>/progress.md`，用 `lib/ledger.js` 解析，task 標題用
  `lib/plantasks.js` 取；每列 `{n, title, status, range}`。
- 階段順序：照 `moves` 的次序畫，倒退的那一步標出來。
- 平行提示：每個 task 旁邊放 `plantasks` 算出的分組。同一組的 task 如果在不同回合派出，
  就標 `could have gone in one response`。task 與派工的對應靠 label/description 裡的
  `task N`，對不上的派工列出來，不猜。
- `assets/station/station.js` 的 `drawDetail()` 多三塊：任務、派工、階段順序。
- 每個 stage 自己的成本照舊不顯示（`docs/station.md:129`）。
- 成品檢查：這個 session 的頁面上，workflow 派工數等於它的 run 檔裡 `workflow_agent`
  列的總數；任務列數等於 ledger 的 `Task` 行數。兩個數字出自同一個來源，必須一致。

## 8. TODO 的分群

不用 `###`。`###` 會打破 `todo-check.js:174` 的 section 契約，`INIT` 也只剩 39 字
容量。〔群組〕前綴已經做到「相近的放一起」。

- `TODO.md` 的前言寫明〔群組〕前綴的慣例：只是方便掃讀，不改變條目的狀態，也不改變
  `/fankeel` 怎麼提供選項。
- `scripts/todo-check.js` 與 `INIT` 不動。
- 這條 Needs a decision 由這一節結案。

## 9. profile：入口與紀錄

- 新鍵 `class.default`（spike | bounded | architectural），在 `scripts/task.js:506`
  沒給 `--class` 也沒給 `--route` 時讀；`start` 的輸出說 `class bounded (profile)`。
  不進 `summary()`，因為那一行算在容量裡。
- `task.js start` 碰到沒有 `profile.json` 的專案，印出 `suggest` 的結果，加上一行可以
  直接照打的 `task.js profile set` 指令。只是 script 輸出，不佔注入。
- `task.js land merge|pr|keep [--push|--no-push]` 把 `land: {integration, push, at}` 記進
  entry。fankeel-land skill 的 menu 在使用者答完之後（或 profile 已經答了）跑它。
  `profile suggest` 除了 git merge，也數這個 registry 裡同一專案各筆的 `land`。這就是
  「掃過去的 session」：答案以前不在 session 裡，從這裡開始記。
- 不做 `reply.language`：CLAUDE.md 和 memory 已經帶了這個偏好，容量也放不下。不做
  plan 檔的鍵：要不要 plan 由 class 決定，另一個鍵只會跟 class 打架。
- `docs/registry.md` 的欄位表，以及 `skills/fankeel/SKILL.md:111` 的 `Eleven more`，
  跟著多一個欄位。

## 10. 唯讀 agent 用 Bash 寫檔

09-11 這次 survey 的 workflow 裡，有一個 `fankeel-reader` 被交代「什麼都不寫」，仍在
repo 根目錄留下 `files_ref.txt`。它的工具清單拿掉了 Edit/Write，但 Bash 的 `>` 仍然能寫。

- 官方 hooks 文件說 subagent 內觸發的 hook 輸入多帶 `agent_id` 與 `agent_type`，
  PreToolUse 可以回 `permissionDecision: "deny"` 加原因；本機還沒實際觀察過
  `agent_type` 的值是裸名還是帶 `fankeel:` 前綴，兩種都要比對。
  `hooks/guard.js` 加一個 `Bash|PowerShell` 的 matcher：身分是 `fankeel-reader`、
  `fankeel-reviewer` 或 `fankeel-judge` 時，拒絕會寫檔的指令，並說明原因——redirect 到
  `/dev/null`、`$null` 以外的地方、`tee`、`rm`、`mv`、`cp`、`sed -i`、
  `git add|commit|checkout|reset|stash|clean`、`Set-Content`、`Out-File`、`New-Item`、
  `Remove-Item`。`fankeel-verifier` 不在內，它要寫自己的證據檔。
- build 的第一步和第 6 節一起探測；runtime 沒帶 `agent_type` 時改成 Waiting 條目，並在
  survey 與 audit 的 skill 內文加一步：workflow 回來後先看 `git status --porcelain`。
- 測試：fixture payload——reader 帶 `>` 被拒、帶 `| grep` 放行、verifier 放行。

## 對照 map

- `docs/station.md`（current）：第 7 節擴充 detail 面板，不回頭加上 stage 成本。
- `docs/documents.md`（current）：第 2、3 節改變它對引用與 drift 的描述，同一個 task 改掉。
- `docs/registry.md`（current）：第 9 節新增 `land` 欄位。
- `docs/collisions.md`（current）：第 10 節新增 Bash 的 guard。
- design-intent：沒有一節把還不存在的東西寫成已經存在。
