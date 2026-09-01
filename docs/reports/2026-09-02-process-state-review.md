---
status: current
last_verified: 2026-09-02
source_of_truth: a dated snapshot of one review run (Workflow wf_f574c501-287, 2026-09-02) plus the hand checks named in §1; every claim cites the file and line it was read from on that day, and nothing regenerates this page
---

# 流程狀態設計審查 — 2026-09-02

fankeel 的「開發流程狀態」是七個 stage、三種 class、每個 stage 收尾的 gate、一個 session 一筆的 registry、build 的 ledger、文件的角色與 contract，以及 TODO.md 的三段式。這份報告回答一個問題：這套狀態設計好不好，哪裡站得住，哪裡站不住，先修什麼。

一句話結論：**有機械強制的那一半品質很高；只靠散文約束、或只量過一次的那一半是問題所在。** 最重的兩個發現都在這個 repo 的邊界之外（隔壁 project 的 registry，clone 之後的 ledger），在同一個 repo 裡 dogfood 十三天是看不到的。

## 1. 審查方法與規模

| 項目 | 數字 |
|---|---|
| 讀者 | 18 個：10 個切面，加 2 輪補漏各 4 個；全部 `sonnet` |
| 合併、反駁、補漏評審 | `opus`；每條弱點 2 個反駁者（事實、設計取捨），每條優點 1 個 |
| 發現 | 97 條；63 條存活，34 條被駁回 |
| agent 總數 / 時間 | 174 個，約 98 分鐘 |
| 失效 | 第一輪 `multi-session` 讀者回傳空內容，其地盤由四個補漏讀者重蓋 |
| 沒跑 | 補漏評審點名 4 個缺口因輪數上限沒跑；其中 2 個由人手補跑（§4-E、§4-F），2 個仍開著（§7） |

驗證規則：一條弱點要同時通過「事實反駁者」（打開被引用的檔案與行，重跑能重跑的東西）和「設計取捨反駁者」（找 repo 裡有沒有論證過這個取捨、論證成不成立、成本有沒有算進去）才算存活。反駁者的預設是駁回。存活的條目用的是反駁者修正過的敘述，不是讀者的原話。

人手補做的部分：跑 `npm test`（980 綠）、統計 65 筆 session 紀錄、跑 `node scripts/docs-audit.js`、讀四個隔壁 project 的 `.fankeel/sessions/`、對 EMU3000_Web 那筆紀錄核對 transcript、算碰撞子系統的分母。

## 2. 總評

registry 的寫入路徑、route 的驗證、class 的推導、記憶欄位的上限、hook 的 exit 0、事故到修正的迴路：這些是機械強制的，而且每個常數都有量測依據，反駁者幾乎打不動。這是這套設計最好的一半。

另一半是「宣稱了但沒人強制」的東西：單向棘輪、stage 的順序、clock/burn 對回頭的處理、ledger 跨 clone 的耐久性、worktree 放在 root 外面、同一個 source 被 adopt 兩次。這些全部活在散文裡，而 `scripts/task.js:18` 自己說過「A rule that lives only in prose is a rule that holds until the context is long」。

第三類是「量過一次就再沒量」的東西：`readActive` 的成本量的是 3 筆的 registry，寫下那天已有 42 筆；note 的 100 字上限沒量過，實際截掉了 23% 的 note；gate.js 從沒 fire 的結論量的是一個 registry，隔壁的 registry 裡它已經 fire 過了。

比例上，碰撞子系統是被辯護得最完整、每 prompt 都付錢的子系統，而它在這個 repo 十三天的歷史裡有機會發揮的次數是個位數。

## 3. 站得住的部分

40 條優點通過事實反駁。挑出最能說明設計品質的：

| 優點 | 證據 |
|---|---|
| 一個寫入原語，每個常數都有量測 | `lib/registry.js:213` 無 retry 時 86–93% 的 rename 撞 EPERM；`:220` 5ms retry 後 229 次寫入 2 次失敗；`:309` 最長合法持鎖 8.6ms 對 5s 的過期線 |
| 一個 route validator 管所有入口 | `lib/stages.js:444` `normaliseRoute`；`scripts/task.js:482`、`:896`、`:749` 三個入口都經過它 |
| `class` 是推導值，不會漂移 | `scripts/task.js:915-917` 重算並在不符時刪除；`:754-758` adopt 同樣推導；`tests/route.test.js:317` |
| liveness 用 pid 量，不用時間戳猜 | `lib/live.js:9` 量到閒置時間從 0.1h 到 268.5h 都有活的 session，所以放棄時間閾值 |
| hook 先輸出再副作用 | `hooks/inject.js:163`、`hooks/resume.js:47`；每個副作用各自 try/catch |
| 一次真實事故換來機械修正 | `docs/registry.md:426` 兩小時的 session id 事故；`scripts/task.js:210` 現在對照 Claude Code 自己的 session 目錄拒絕陌生 id |
| gate 的文字對著具名事故收緊，每條有測試釘住 | `lib/stages.js:50-56`（design 以一段文字列三個編號選項收尾）、`:159`（九百字的 design）、`:71-82`（`\uXXXX` 壞掉的中文）、`tests/stages.test.js:256` |
| Stop hook 是算過三個成本才否決的 | `docs/pipeline.md:252-257`：多一個 model turn、`stop_hook_active` 迴圈、誤傷中途的普通問答 |
| 注入規則的三份副本有測試防漂移 | `tests/render.test.js:270` 逐字比對 pipeline.md 的兩處引文 |
| `positionIn` 誠實報告倒退 | `lib/stages.js:465` 是純函數，沒有高水位；verify 退回 build 會顯示 5 of 7 變 4 of 7 |
| 壞掉的 cost pair 換新不修補，有測試 | `lib/registry.js:393`；`tests/registry.test.js:289` 對五種壞形狀逐一測 |
| adopt 逐欄推理哪些跨 session、哪些不跨 | `scripts/task.js:776`；`docs/registry.md:366` clock 帶距離換原點、burn 留下 |
| ledger 的 ruling 是真的在用，含推翻自己 | 14 份 ledger 128 條 ruling 全帶 costs if wrong；`.fankeel/build/2026-08-26-dispatch/progress.md:65` 推翻 `:55` |
| verify 真的退回過 build | `.fankeel/build/2026-09-01-ready-backlog/progress.md:9` 三個任務重開；88cf28e 是其中一個修正 |
| `down` 不偽造完成 | `scripts/task.js:712-717` 只寫 `active=false`；`clear`（`:872`）與 adopt 的 source（`:821`）同樣不動 `stage` |
| `bounded` 對它自己的中位案例是對的預設 | 36/65 筆，全部到 land，中位 47.6 分鐘走 5 個 stage |
| 文件的雙軸模型是真的兩個問題 | `lib/docs.js:273-276` role 是目錄的歸檔決定；`:358` contract 是單頁的宣告；`docs/documents.md:184` |
| 每個可選層都有寫在程式裡的退路 | 沒有 docs.json 退回目錄推斷（`scripts/docs-audit.js:325-326`）；沒有 frontmatter 退回 git/mtime（`:142-145`） |
| 詞彙碰撞是被追捕的 | `lib/stages.js:11-33` 把 `step` 的三個意思寫清楚，gate 規則裡不再出現 |
| 不完整的輸出會自己說 | `scripts/ledger.js:115` 先驗證 `--range`；`:189-191` 數出沒有 range 的列；map 的每個 cap 都印 `... and N more` |
| 測試投資偏向狀態模型 | 939 個 case 中 559 個（59.5%）在 registry / stage / hook / collision 這半，scanner 那半的最壞失敗只是一行報告錯 |

一條被反駁掉的優點值得記：`README.md` 與 `TODO.md` 說 `## Waiting` 曾縮短四次、四次都是誤歸類。反駁者逐 commit 數 `## Waiting` 的條目，淨減少至少六次，其中兩次（0b8777c 等）不在那四次裡。這是 repo 對自己的說法不準，要不要重數是 §7 的開放問題。

## 4. 驗證過的問題

嚴重度：**high** 會產生錯的狀態、丟工作、誤導的 badge 或進度、使用者會撞到的矛盾；**medium** 在正常使用裡花掉回合、維護或清晰度；**low** 是打磨。每條標明 repo 有沒有承認過。

### A. 狀態機本身：只有集合檢查，沒有順序，也沒有棘輪

**A1 [medium] 單向棘輪只有散文，程式碼零強制。**
`README.md:88`、`docs/pipeline.md:364`、`skills/fankeel/SKILL.md:265`、`lib/stages.js:404` 四處宣稱 route 只升不降。`scripts/task.js:888-928` 的 `cmdRoute` 只拒絕會孤立當前 stage 的 route（`:904`），從不比較新舊 route，雖然 `before`（`:909`）和 `given`（`:896`）在寫入前都在手上。實跑：architectural 任務進到 design 後 `route survey,design,build` exit 0，砍掉 plan、verify、audit、land，刪掉 `class`，只印中性的前後對照。`tests/route.test.js:310-314` 把降級寫成預期行為。
已承認：`lib/stages.js:403-406` 說「enforced by nothing here, because neither is checkable」。對「縮短」這一半不成立：那是一個比較，兩個運算元都在。鏡像的規則在 `cmdStage`（`:555-557`）已經用同樣的理由機械強制了。
最小修法：縮短時印出被丟掉的 stage；完整修法是拒絕，`--force` 放行。

**A2 [medium] `clock`/`burn` 對回頭的 stage 把離開的時間全算進去。**
`lib/registry.js:409-413`（clock）與 `:420-424`（burn）存 (first, latest) 一對，沒有離開與重進的概念；唯一的重置在 `scripts/task.js:623-628`，觸發於改名而不是重進。verify 退回 build 是設計允許的路徑（`lib/stages.js:270`、`docs/pipeline.md:539`），`cmdStage` 只查成員（`scripts/task.js:559`）所以放行。離開一小時再回來碰一次，build 報 65 分鐘而不是 5 分鐘，多報的量等於離開的時間。`waited` 為同一情境改成累加（`docs/plans/2026-09-01-stage-timing-design.md:44-45`），這兩個沒跟上。只影響 `show`（`scripts/task.js:252-261`）、stage 轉換行（`:581-583`）和 adopt 帶過去的距離（`:796`）。`scripts/task.js:785-786` 寫著「bills a stage for the days nobody was on it」是要避免的事，正是這條路徑做的事。沒有測試涵蓋重進。
已承認：沒有。
最小修法：改成累加區間，或重進時重置 first。

**A3 [low] `note`/`next` 是唯二不檢查 active 的 mutator。**
`lib/registry.js:500`（addNote）與 `:558`（setNext）不查 `active`，而 `cmdStage`（`scripts/task.js:553`）、`cmdTask`（`:610`）、`cmdGuard`（`:681`）、`cmdDown`（`:714`）、`cmdRoute`（`:894`）全部拒絕已 stood down 的紀錄。實跑：`down` 之後 `note` 回「noted. 1 of 5 kept」、`next` 也成功，寫進死紀錄。`cmdNote` 的錯誤訊息（`:654`）宣稱一個從沒執行的 active 檢查；`cmdNext`（`:662`）的訊息是準的。沒有測試。
最小修法：兩個函數加 `active` guard，或改寫 cmdNote 的訊息。

**A4 [low] 兩個最常見的手排 route 沒有名字。**
`design>build>verify>land` 9/65，其中 7 個任務以 decide / define / settle 開頭，第 8 個是同形的中文；`survey>audit>land` 3/65，`skills/fankeel/SKILL.md:251` 與 `docs/pipeline.md:725` 都叫它 documentation sweep。`lib/stages.js:407` 的 `CLASSES` 只有三個，20/65 筆（31%）整個任務期間都沒有 `lib/render.js:91` 那句 class 說明。空 class 是刻意的（`lib/stages.js:432-433`、`tests/render.test.js:612-615`），缺口在命名而不是渲染。`spike` 零使用。
成本：加名字要動四張表加 `tests/route.test.js:246`，而且「when in doubt take the heavier one」對 `survey,audit,land` 無法比重。

順帶一條被駁回但值得知道的：`stage` 從 `survey` 一步跳 `land` 會成功，「7 of 7」的 badge 一跳可達。這是有紀錄的刻意選擇（`docs/archive/2026-08-27-gate-rules-design.md:91-96`），所以不算缺陷，但保證只活在散文裡。

### B. 持久化的邊界：狀態在 repo 裡，但不在 git 裡，也不在 worktree 之外

**B1 [high] plan 路線的 ruling 只存在被 gitignore 的 ledger 裡。**
`.fankeel/build/` 由 `scripts/map.js:37` 寫進被追蹤的 `.fankeel/.gitignore`，任何分支都沒追蹤過它。`show`（`scripts/ledger.js:201`）與 `ranges`（`:178`）對不存在的檔案印同一句「none yet ... Run `init`」，丟掉的 ledger 與從沒開始的 plan 無法區分，`:209` 卻叫讀者「Trust this and git log」。plan 路線的 ruling 唯一的落點是 `ledger.js ruling`（`skills/fankeel-build/SKILL.md:220`），`:223-225` 的 commit message 複製只適用於沒有 plan 的分支。14 份 ledger 128 條 ruling，543 個 commit 只有 5 個帶 costs if wrong；`.fankeel/build/2026-08-22-seven-stage-implementation/progress.md:10` 的 ruling 在 git 任何地方找不到，silent-losses 的 6 條有 2 條同樣消失。兩份已 commit 的頁面（`docs/archive/2026-08-28-task-end.md:706`、`docs/archive/2026-08-25-silent-losses.md:1045`）叫讀者去讀 clone 裡不存在的路徑。
已承認：`docs/archive/2026-08-22-seven-stage-implementation.md:1305` 一句「the ledger is scratch」，對 `complete` 行成立（git 可重建），對 ruling 行不成立（`lib/ledger.js:82-83` 說它存在是為了讓不在場的人日後審）。與 `docs/decisions/fankeel-shell.md:257`（之後加進 `.fankeel/` 的東西預設 versioned）和 `:248-250`（該跨機器的東西進 commit message）兩條都衝突。
最小修法：規則改一句，plan 路線的 ruling 也複製進 commit message；或整個 ledger 不再 ignore。

**B2 [medium] commit 到 `complete` 之間沒有任何落盤。**
BASE 由 `git rev-parse HEAD` 取到對話裡（`skills/fankeel-build/SKILL.md:130`），到第 7 步才落盤（`:207`）；resume 只認 `^Task (\d+): complete`（`lib/ledger.js:20`、`scripts/ledger.js:206-209`）。壓縮落在 review 或 fix round 裡，git 領先 ledger。BASE 可從 git 重建（commit 的 first parent），reviewer 跑過沒有、發現了什麼不能。並行路徑下最多四個任務 committed 而 ledger 沒有一行。
已承認：沒有；最接近的論證（`docs/archive/2026-08-26-dispatch-design.md:428-437` 拒絕 batching）講的是相反的原則。
最小修法：第 1 或第 4 步寫一行「opened <n> at BASE=<sha>」，完成行覆蓋它。

**B3 [medium] `bounded` 的 build 沒有持久的分母。**
`lib/stages.js:414`：design 在對話裡，沒有 spec、沒有 plan；`skills/fankeel-build/SKILL.md:62-68` 承認「a compaction takes the place with it」。36/65 筆是 bounded，51/65 筆的 route 有 build 沒有 plan。升級成 plan 的兩個觸發器（`lib/stages.js:130` 的 `## Ready` 多於一條、`:205` 的兩列互相獨立）看的都是數量，不是需不需要持久化；多列但互相依賴的檔案表兩個都不會觸發。`lib/context.js:125-142` 的壓縮警告不看 stage，處方 Adopt 只帶 notes 和 route，帶不走檔案表，而 `lib/stages.js:259` 的 build 模板仍要求印 `done: <n> of <m>`。
已承認：`skills/fankeel-build/SKILL.md:66-68` 承認洞，把判斷丟回模型。
最小修法：`contextLine` 拿到 stage（`lib/render.js:185` 手上已有），在無 plan 的 build 裡點名「升級成 plan」或「把剩下的列存進 notes」。

**B4 [medium] worktree 開在 repo 外面就自己一個 registry。**
`lib/registry.js:79-95` 的 `findStateRoot` 只往上找 `.fankeel/sessions/`。實測：`.claude/worktrees/foo` 解析到主 root，`../foo` 解析到 null 然後退回自己（`:104`）。兩個 session 讀兩個目錄，互相看不到，而 `lib/render.js:151` 那行「root 與 launch 不同就印出來」在這情況下 root 等於 launch，不會印。`lib/registry.js:55` 偏好 `CLAUDE_PROJECT_DIR`，所以要在那個路徑啟動 Claude Code 才會分裂；只是 cd 過去的 session 則完全不記 claim（`lib/guard.js:67`、`hooks/touch.js:36-37`）。ledger 的 root 是 cwd、不往上走（`scripts/ledger.js:95`、`lib/ledger.js:44`）。`skills/fankeel-land/SKILL.md:149-150` 只清 `.worktrees/` 或 `worktrees/` 下的 worktree。
已承認：`docs/decisions/fankeel-shell.md:97-115` 論證往上走，只講單 project 對多 project，worktree 一字未提。
最小修法：一句規則說 worktree 放在 registry root 底下；或 `rootFor` 加 `git rev-parse --git-common-dir` 的退路。

**B5 [medium] 同一個 source 可以被 adopt 兩次，兩份紀錄 `started` 相同，guard 對這一對失效。**
`cmdAdopt` 逐字複製 `source.started`（`scripts/task.js:769`），只檢查接手方自己的紀錄（`:745`），刻意不查 source 是否 active（`:839-841`，為了救回誤清的紀錄）。兩個 session 先後 adopt 同一個 source，不需要競態：兩筆都 active，`started` 與 `claims` 逐位元相同。`lib/guard.js:95-101` 把完全平手判成誰都不擋（`tests/guard.test.js:308` 明寫 an exact tie blocks nobody），`guard.decide()` 對兩筆真實紀錄雙向回 null（實跑，`guard: deny`）。警告層不受影響（`hooks/inject.js:161`、`lib/render.js:64-65` 用 `overlapPaths`），退化成 2026-08-30 之前的警告模式。第二次 adopt 印「is now stood down」，看不出是第二次。`carry.js:61` 走 `readActive` 所以不會再主動提供已 adopt 的 source，`show --all` 不印 session id，第二次 adopt 需要手上有 id。
已承認：`scripts/task.js:810-813` 講一次 adopt 自己的兩次寫入不原子，不是兩個 session 各做一次。
最小修法：adopt 檢查 source 狀態或同任務的其他 active 認領者；跨 `from` 的鎖只關得掉同時的情況。

**B6 [medium，條件式] fork 若保留 session id，guard、carry、inject 都用 id 排除自己，兩個活程序共用一份紀錄且互相隱形。**
`hooks/guard.js:45`、`hooks/carry.js:66`、`hooks/inject.js:148` 都以 `sessionId !== 自己` 篩掉同伴；registry 以 id 命名（`lib/registry.js:117`），紀錄不帶 pid（`scripts/task.js:505-508`）。`scripts/task.js:566` 無條件寫 `d.stage`，`lib/registry.js:413` 以共用紀錄當下的 `stage` 記 clock，`:466-469` 的 `gateAt` 不檢查既有 stamp，全部 last-writer-wins；`withLock`（`:293`）防撕裂寫入，不做衝突偵測。`lib/live.js:71-77` 丟掉了「兩個活 pid 帶同一個 sessionId」這個既能回答問題又能修它的訊號。
已承認：`docs/collisions.md:155-164` 宣告同 id 互不可見，但只對 subagent 講，那裡有補償控制（disjoint `**Files:**`、parent staging）。`docs/decisions/fankeel-shell.md:517-521` 只為 carry.js 的 orphan offer 討論 fork。`lib/registry.js:5` 的「no session ever writes another's」是 per id 不是 per owner。
最小修法：先量一次 fork 換不換 id；若不換，修飾 `registry.js:5` 那句，把「What is still a guess」的條目從 carry.js 擴到所有 writer。

### C. hook 層

**C1 [high] AskUserQuestion 答完後的短版注入沒有 session id、沒有壓縮警告。**
`contextLine` 只在 `render()`（`lib/render.js:185`）被呼叫；`renderResume`（`:247`）是 `whereLines` 加 `rulesLines`，兩者都不碰它。`hooks/resume.js:37` 送的就是這個短版。SessionStart 只對 `clear|fork`（`.claude-plugin/plugin.json:14`），壓縮不觸發任何 hook；`hooks/gate.js` 什麼都不寫；`renderBrief` 不帶 id。這條 pipeline 的 gate 就是 AskUserQuestion，`docs/pipeline.md:182-183` 記了一段 511 個 transcript entry、44 分鐘沒有 UserPromptSubmit 的 run（那是 resume.js 存在之前的事故，但它證明 gate 驅動的一段可以跑那麼長）。壓縮落在那裡，id 就不在 context 裡；`scripts/task.js:213-222` 會拒絕未知的 id，代價是被拒的呼叫加一個回合，但 stage 可能就此停止推進而沒人說。`skills/fankeel/SKILL.md:158` 無條件說 id 在 FANKEEL ACTIVE 區塊裡。`tests/resume.test.js` 沒有這一項。
已承認：`docs/registry.md:339` 說 id 只在那一行，沒接到 renderResume 省略了那一行。兩份「短版省略了什麼」的清單（`lib/render.js:217-219`、`docs/pipeline.md:239-241`）都沒列它，而省略理由「答題前後不會變、幾千 token 上面還在」正是壓縮會打破的兩個前提。
最小修法：renderResume 加一行「context: compacted, --session <id>」，`contextLine` 已經算好，不用重讀 transcript。

**C2 [medium] 自己的紀錄壞掉時 badge 會說謊到 session 結束。**
`lib/registry.js:136` 把 parse 失敗和不存在都變成 null；`hooks/inject.js:60` 走「從沒用過 plugin」分支；`:107` 那條清 badge 的分支只處理「讀得到但已 stood down」和 `init`。badge 只按 mtime 清（`lib/badge.js:169`），且 `pruneBadges` 跳過當前 session（`:165`）。實跑：把紀錄截成壞 JSON，hook 跑兩次都輸出空字串，badge 與 lead 檔逐位元不變，statusline 繼續顯示 build 4/7，而 `task.js show` 說 no entry，`down`（`scripts/task.js:718`）與 `clear`（`:854`）都以「No entry」失敗。觸發條件只有帶外的損壞：plugin 自己的寫入是原子的（`lib/registry.js:203-208`）。
已承認：`docs/decisions/fankeel-shell.md:262` 說壞掉的紀錄「由 /fankeel 報告」，實際只在 `show --all`（`scripts/task.js:423`）而且不點名是哪個 session。
最小修法：區分「檔案在但讀不懂」與「不存在」，前者清 badge。

**C3 [medium] `readActive` 每個 prompt、每次編輯都 parse 整個歷史，而歷史從不刪。**
`lib/registry.js:187-188`：`readAll` 再 filter；`:160-183` 無上限的 readdir 加 readFile 加 JSON.parse。熱路徑兩條：`hooks/inject.js:148`（每個 prompt，在 mode 裡的 session）、`hooks/guard.js:45`（每次 Edit/Write/NotebookEdit，guard 預設 `ask`）。唯一的成本註解 `hooks/guard.js:35-39` 量的是 3 筆的 registry，日期 08-30，那天這台機器的 registry 依 `started` 已有約 42 筆。反駁者在合成 registry 上量：65 / 250 / 1000 / 2000 筆對應 36 / 140 / 560 / 1110 ms。這個 repo 每天約 9 筆，一年約 3,400 筆、每次約 360ms，build 階段 50 次編輯多 18 秒。今天沒感覺是運氣不是不變量。
已承認：`docs/registry.md:242-247` 承認成長並說「the argument for a bound somewhere」，但三個既有的 bound 都在顯示層，沒有一個碰 hook 讀的東西。
最小修法：stood down 的紀錄移到 `sessions/closed/`，或維護一份 active 清單；先量一次 250 筆再決定。

### D. 文件狀態層

**D1 [high] docs-audit 的 landed 偵測器現在就有一個活的漏報。**
`scripts/docs-audit.js:202` 的 `pointsAt()` 沒套 `scripts/docs-check.js:220` 的 STATE_DIR 排除，也沒有 `:208-209` 的 trailing-slash guard；`.fankeel` 因 `docs.json` 被追蹤而是 tracked root，`:202` 的 roots guard 擋不住。實例：`docs/plans/2026-08-26-session-id-design.md:36` 一個示意用的 `` `.fankeel/sessions/ae79f756-....json` `` 被登記為 unbuilt，那份六天沒動、命名的八個檔案都存在的 plan 永遠不會被報 landed。2026-09-02 跑 `node scripts/docs-audit.js`：0 landed、exit 0。clean checkout 下 13 份 plan 有 8 份被同一原因擋住。`lib/docs.js:81-82` 在 STATE_DIR 的定義處寫著「nothing in it is ever a document's claim」，同一個函數已對 placeholder（`:198-201`）和 fence（`:224-227`）做了同樣的排除。
已承認：沒有；這是 repo 自己宣告的不變量被程式碼打破。
最小修法：`pointsAt()` 的 CODE-span 迴圈套兩個 guard，加一個 plan 角色文件內含 `.fankeel/sessions/…` 路徑的測試。

**D2 [medium] note 的 100 字上限沒量過，而且截斷是無聲的。**
`lib/registry.js:34` `MAX_NOTE_LEN = 100` 全史只有一個 commit（a2930da），`LINE_MAX` 則是量了 32/56 列超過才從 100 改 120（8b6c7cb）。65 筆紀錄 105 條 note，24 條剛好 100 字，36 條 95 字以上；抽查的每一條都切在字中間。`:495`/`:501` 無聲切掉，`scripts/task.js:656` 回報「N of 5 kept」，報的是沒撞到的那個上限。兩條共用 100 字前綴的 note 會合併成一條而回報成功（`:503-504`）。
已承認：`docs/decisions/fankeel-shell.md:243-245`「small by nature ... the shape of the thing rather than a limitation」，沒有量測。設上限的理由成立（第五個記憶 store 沒人審），數字沒有依據。
最小修法：截斷時說出來，像 `scripts/todo-check.js:228` 那樣；不要加大上限，note 每 prompt 重新注入，預算 2400 字現在 2394。

**D3 [low] hook 的數量在自己的頁面上過期了，而且這類失效三個掃描器按構造都抓不到。**
`README.md:245`「all six hooks」，gate.js 於 2026-09-01 成為第七個；`README.md:251`「The other three are not load-bearing」自 carry.js（08-28）起就錯，現在 PreToolUse 上有兩個會阻擋的 hook；`tests/hook.test.js:3` 同樣寫 six。371f78e 把上一行的 five 改成 six 卻留下這一行，93ea151 明說在找「這個分支弄假的三句話」，改了 245 留下 251。結構性的點：新增一個東西會讓 diff 沒碰到的頁面上的數字失效，docs-check（連結）、docs-audit（頁面日期）、`skills/fankeel-verify/SKILL.md:73`（範例全是 mutation）都不會報。
最小修法：改兩個數字；把「新增會弄假哪些數字」寫進 verify 的問法。

### E. gate.js 其實已經 fire 過，在隔壁的 project 裡

這一條是人手補跑補漏評審點名的缺口得到的，工作流本身沒讀 repo 外的 registry。

`F:/ymlab/EMU3000_Web/.fankeel/sessions/246f9b6f-27bf-4fb2-9516-68b08ff5bc3c.json` 帶著 `"gateAt": 1788234853022`，沒有 `waited`，`updated` 等於 `started`。對照該 session 的 transcript：

| 事件 | 時間 (UTC) |
|---|---|
| cache 裡帶 gate.js 條目的 `plugin.json` 寫入 | 08-31 18:03:37（本地 09-01 02:03） |
| 該 Claude Code 程序的第一行 transcript | 09-01 02:19:47 |
| `task.js start` | 09-01 03:53:27 |
| 最後一個 AskUserQuestion 呼叫 | 09-01 03:54:12.880 |
| `gateAt` | 09-01 03:54:13.022 |
| 那個問題的 tool_result 與 system 行（相隔 8ms，中斷而非回答） | 09-01 03:56:03 |

`gateAt` 的唯一寫入者是 `hooks/gate.js:31`；前面 13 個 AskUserQuestion 時還沒有 active 紀錄所以沒蓋章；那個程序在 manifest 之後八小時才開。結論：

- PreToolUse 對 AskUserQuestion **會** fire。
- 這個 repo 裡從沒 fire，是 `docs/registry.md:152-164` 的第二個候選：hook 註冊是 process 級，開發用的那個程序早於 manifest，`/clear` 不重載。
- `docs/registry.md:138`、`docs/decisions/fankeel-shell.md:456`、`skills/fankeel/SKILL.md:114` 與 `:130` 三頁四句「no record has carried a gateAt」對磁碟上這個檔案是假的。
- 那次 gate 沒關（沒有 `waited`），因為問題被中斷而不是回答，PostToolUse 對取消的呼叫不跑。`docs/registry.md:206` 說未消費的 `gateAt` 由下一個蓋掉，那是「session 死在 gate 上」的情況；「問題被 Esc 掉、session 繼續」是第二種，結果一樣是一個永遠不會被折進 `waited` 的 stamp。

同一批外部 registry 還有：四個 project 共 5 筆紀錄，3 筆仍 `active: true`、停在 survey / design / audit 沒人收，4 筆沒有 class，0 筆有 `next`。`§1` 之前的所有實證數字都只算了這個 repo，而這個 repo 的作者就是工具的作者、每個任務都在改工具本身。

### F. 比例：最重的子系統，實際用到的次數是個位數

| 碰撞子系統 | 數字 |
|---|---|
| 成本 | 每 prompt `git status -uall` +41ms（`docs/collisions.md:72`）；`readActive` 每 prompt 加每次編輯（C3）；`hooks/guard.js`、`lib/live.js`、`lib/tracked.js`、`lib/fanout.js` |
| 65 筆紀錄裡 `[started, updated]` 時間窗重疊的 session 對 | 4 |
| 其中共用字面相同 claim 路徑的 | 2（`tests/render.test.js`；`TODO.md`） |
| 另外 2 對 | 差在 `.claude/worktrees/` 前綴。反駁者指出兩個 checkout 是磁碟上兩個檔案，guard 的定義是「the file that actually gets overwritten」，所以這 2 對不算漏報，也不算命中 |
| 同時最多開著的 session | 3 |
| 帶 worktree 前綴 claim 的紀錄 | 9 |

其他比例數字：document 與 workspace scanner 合計約 4,448 / 9,371 行；`next` 4/65；gate.js 那件事一個死欄位四份散文副本，08-31 起 8 個 commit 只為了讓四份副本同步（c6054d1、51d40f0、9667f70、c7308e2、59d5582、0c285e0、fb948e2、56ac76c），`skills/fankeel/SKILL.md` 每個 session 花約 20 行講一個從沒出現的欄位。這些都不是缺陷，是「建在證據之前的機制」的價目表。

## 5. 改進建議

依價值除以成本排序。每條寫明它關掉的問題與大概的成本。

1. **三頁改一句，一個決定收掉。** 依 §4-E 更新 `docs/registry.md:138`、`docs/decisions/fankeel-shell.md:456`、`skills/fankeel/SKILL.md:114` 與 `:130`：gate.js 會 fire，此 repo 的沉默是 process 級註冊。TODO.md「gateClose 找不到 gateAt 時要不要講」可以據此決定：在 `/clear` 出來的 session 裡它一定找不到，講一次是對的。成本：文件。
2. **`pointsAt()` 套兩個 guard 加一個測試。** 關 D1。成本：約 10 行加 1 個測試。
3. **`renderResume` 加一行 context 與 session id。** 關 C1。成本：約 5 行加 1 個測試；`contextLine` 已算好。
4. **plan 路線的 ruling 也進 commit message。** `skills/fankeel-build/SKILL.md:223` 那句從「with no plan」改成「always」；或 `.fankeel/build/` 不再 ignore。關 B1，B2 關一半。成本：一句規則，或一行 `.gitignore`。
5. **`cmdRoute` 縮短時警告，並修 `lib/stages.js:404` 的理由。** 關 A1。成本：約 10 行加 1 個測試。
6. **`clock`/`burn` 改累加或重進時重置。** 關 A2。成本：`lib/registry.js` 兩處加測試；要確認 adopt 的「帶距離換原點」邏輯（`scripts/task.js:783-790`）仍成立。
7. **note 截斷時說出來。** 關 D2。成本：`scripts/task.js:656` 一行。
8. **三個小洞一起補：** `cmdDown` 印 `next`（它是 `task` 清、`adopt` 帶、`describe` 印、`renderCarry` 印的那一對裡唯一被拆開的地方，`scripts/task.js:723-730`）；`note`/`next` 加 active guard（A3）；README 的 hook 數量（D3）。成本：各幾行。
9. **`readActive` 只讀 active。** 先量一次 250 筆，再決定是移目錄還是加清單。關 C3。
10. **邊界三件：** worktree 放在 root 下的一句規則或 `--git-common-dir` 退路（B4）；adopt 的 consumed 標記（B5）；量一次 fork 換不換 id（B6，一個實驗解掉三條條件式發現）。
11. **可選：加 `decision` 與 `sweep` 兩個 class。** 關 A4。成本：四張表加 `tests/route.test.js:246`，還要決定它們在「heavier one」序列裡的位置。
12. **比例決定：** 碰撞子系統在此 repo 十三天命中 2 對。要嘛接受每 prompt 的成本是為多人環境買的保險，要嘛把 `-uall` 與 `readActive` 改成「registry 裡有第二筆 active 時才跑」。這是產品決定，不是缺陷。
13. **兩個沒人問過的設計問題：** 13 個欄位裡哪些可以在 prompt 時從樹和 git 推導而不必存（`claims` 已經這樣改過一次，`class` 已是推導值，`stage` 理論上可從 plan / ledger / archive 的存在推導；若成立，C2、B2、B1、B5、B6、C3 一起消失）；紀錄該不該帶寫入它的 plugin 版本（65 筆已跨至少四個欄位世代：20 筆無 class、51 無 clock、64 無 waited、9 無 claims，讀寫都是 read-modify-write）。

**相鄰的提案，不在這份審查的範圍內但由它引出：** 一個只在被叫到時載入的文件改寫 skill。`audit` 對 code 那半已經用 `lib/plugins.js` 借 ponytail，docs 那半 docs-audit 只做到「把四十份縮成這兩份」然後停在 report, then ask，沒有東西負責改寫。形狀：輸入 docs-audit 的一對頁面加它的 source_of_truth；操作三選一（review 只診斷、refactor 最小修改、recreate 從事實重寫，借 sepia 的分法）；規則分結構層（fankeel 自己的：一頁一個問題、快照對規則、role 決定可過期程度）與表層（繁中用 Humanizer-zh-TW 的 24 條，英文用 sepia 的 style-pass）；量化目標借 ponytail 的 net -N lines。不進每回合注入，不動 2400 字預算。靶子是 Trovara（319 份 md、6 MB、全繁中、已有 `.fankeel/docs.json`），但要先把 `.venv` 裡約 35 份排除在 bucket 外。這是一個 architectural class 的任務，survey 第一步是對 Trovara 跑 docs-audit 看 pairs 有幾對。

## 6. 被駁回的發現

34 條。列出來是因為每一條都是讀者「看起來像缺陷」的地方，下一個審查者會再撞到。

| 主張 | 為什麼駁回 |
|---|---|
| `stage` 只查集合不查順序 | 刻意且有紀錄：`docs/archive/2026-08-27-gate-rules-design.md:91-96` 逐字討論並否決了順序檢查 |
| stage 以散文結尾沒有偵測與自動恢復 | Stop hook 的否決（`docs/pipeline.md:252-257`）就是對著這個事故算的 |
| build 的「每任務一個 reviewer」與「never ask permission」衝突 | 後者是 survey 對 reader 的規則；build 的四個 stopper 是窮舉清單，主機禁 dispatch 不在其中，所以是 ruling；`ready-backlog` 的 ledger 已示範 in-session review |
| plan 歸檔自 08-29 停擺 | 假：之後有三個歸檔 commit；歸檔本來就是「offer, never done」（`scripts/docs-audit.js:44`、`:486-487`） |
| land 有兩個問題、形狀不一致 | ALWAYS[0] 管的是 stage 的結尾；整合選單是 stage 中途 |
| 四條規則的預算把不相干的紀律擠成一句 | 上限的理由是注意力不是價格（`lib/stages.js:38-42`） |
| `git status` 的成本模型外推太遠 | 反駁者在更大的 repo 上量了，論證成立 |
| fanout pool 是為此 repo 沒有的形狀建的 | 誤讀：它針對多 project 的 root，「worth nothing」講的是已經快的那種 |
| 文件機制花在維護自己的 commit 多於描述能力 | gate 的成本有算而且是設計的主要槓桿（`lib/stages.js:252` 先擋新文件） |
| `task` 一詞在 stage 間超載 | 證據是把 `step` 的三義表誤讀成 `task`；兩個意思分別在不同檔案 |
| 沒有一頁說哪些設定必要哪些可選 | TODO.md 的可選性在 `README.md:36`；frontmatter 從沒提是真的但屬 low |
| verify 與 audit 跑同一個 docs-check | 刻意：docs-check 是共用原語（`scripts/docs-check.js:8-13`） |
| registry 的 stage 與 ledger 是兩個真相源 | 它們回答不同問題，沒有可以 join 的 key |
| `start` 不自動推導 class | class 是使用者做或不做的宣告（`docs/pipeline.md:278`）；兩個推導點是防錯不是補值 |
| 較重 route 的預設沒對照短任務的 gate 次數 | `README.md:108` 正面回答；36 筆 bounded 只有 4 筆低於 25 分鐘 |
| docs-audit 是第二大檔案 | 唯讀 scanner，大小產生不了錯的狀態 |
| 「one caller」的測試沒套到第三個模組 | `docs/decisions/fankeel-shell.md:344-348` 的表對三個都套了 |
| record 與 entry 混用 | 詞彙規則是一詞多義不准，同義詞不在其中（`docs/plans/2026-09-01-stage-units-design.md:87`） |
| Waiting 戳章的證據成立（優點） | 可數的那半是假的：淨減少至少六次不是四次 |
| `next` 恰好在為它而建的情境 fire（優點） | `next` 不是為 carry 而建，是一般欄位 |
| worktree 前綴的 claim 比不到主 checkout 的同一檔 | 兩個 checkout 是兩個檔案；guard 的定義是實際被覆寫的檔案 |
| TODO.md 的耦合是 land 一次性的儀式 | `lib/stages.js:248`、`:260` 在 build 每個 prompt 注入 |
| 沒有自我 liveness 檢查 | resume.js 寫 `updated`，所以 gate.js 死掉時自己的 `updated` 一樣新鮮，那一行永遠是常數 |
| 心跳沒有 per-hook 歸屬 | `gateAt` 就是 per-hook 的；共用戳章有論證（`hooks/resume.js:47-49`） |
| plugin root 搬走或 node 不在，hook.js 的 try/catch 接不到 | 保證的範圍寫明是「a hook that throws」（`lib/hook.js:19-23`） |
| parse 失敗丟掉整筆紀錄 | 手改是唯一剩下的向量，`docs/registry.md:401-402` 有論證；原子寫入排除了部分寫入 |
| 什麼都不會被銷毀（優點） | 假：`task` 改名清 notes 與 next（`docs/registry.md:75-77`） |
| map 把 plugin root 烤進檔案且現在就過期 | 假：路徑解析得到，`scripts/map.js:51` 每次重寫，三個 stage 按名重跑 |
| 「regenerated so cannot be stale」沒有限定 | 有論證且限定於一種失效模式（`docs/pipeline.md:719-721`、`tests/stages.test.js:372-374`） |
| 模型無法表達一個任務兩個活 attachment | 有論證（`docs/subagents.md:189-190`）；舉的成本在例子裡不成立 |
| live.js 把 pid 列折成 id 集合 | `runningSessions` 保留兩列；只有上層的 Set 丟掉；`lib/live.js:85-86` 的政策 |
| `docs/registry.md` 的版本控制表少一列 `.fankeel/build/` | 刻意且在 `scripts/map.js:35-36`、`lib/registry.js:193-195` 論證 |
| 決策紀錄沒為「session 是被建模的實體」辯護 | `docs/decisions/fankeel-shell.md:258` 那句就是壓縮過的論證 |
| session id 命名買到無競爭的鎖（優點） | 假：adopt 與 clear 都寫別的 session 的檔（`scripts/task.js:821`） |

## 7. 沒跑的缺口與開放問題

補漏評審點名四個缺口，兩個由人手補跑（§4-E、§4-F），兩個開著：

- **stored vs derived。** 見 §5 第 13 條。這是 repo 裡沒人問過、而且會改變結論的設計問題。
- **紀錄的世代。** 沒有紀錄帶寫入它的 plugin 版本；讀寫都是 read-modify-write；安裝的 cache 落後 repo，而 claude-kit 把 fankeel 裝進四個已有狀態的 project。哪些程式路徑依紀錄形狀分支、跨世代雙向會怎樣，沒人讀過。

讀者留下的問題裡值得接的：

- 有沒有任何真實任務走過 verify 退回 build 的路徑，`show` 或轉換行有沒有印過膨脹的數字。65 筆紀錄查不到（後續往前走到 land 會蓋掉痕跡）。
- `## Waiting` 縮短的次數：`README.md` 與 `TODO.md` 說四次，反駁者數到至少六次。重數一次，改掉那句。
- 65 筆裡 62 筆走過 build，`.fankeel/build/` 只有 14 個目錄。哪些 build 真的沒有任何持久的 ledger，B3 的分母是多少。
- 14 個 ledger 目錄在任務全部 land 之後仍留在磁碟上，是刻意的歷史還是沒清的副作用，沒有文件說。

## 8. 附錄：數據

全部量於 2026-09-02，來源是 `.fankeel/sessions/` 的 65 個檔案、`git log`、與正文引用的檔案。

**session 紀錄**

| 項目 | 數字 |
|---|---|
| 紀錄數 / active | 65 / 0 |
| stage 停在 land / verify | 64 / 1 |
| class bounded / architectural / 無 | 36 / 9 / 20 |
| 手排 route 的形狀 | `design>build>verify>land` 9；`survey>audit>land` 3；`survey>audit>build>verify>land` 2；其餘六種各 1 |
| 有 notes / next / claims | 44 / 4 / 56 |
| 有 burn / clock / waited / gateAt | 37 / 14 / 1（手動戳章）/ 0 |
| notes 總數 / 剛好 100 字 / ≥95 字 | 105 / 24 / 36 |
| bounded 中位時長 | 47.6 分鐘（5 個 stage） |
| `design>build>verify>land` 中位時長 | 40.7 分鐘（4 個 stage） |

**commit**

| 項目 | 數字 |
|---|---|
| 總數 / 期間 | 543 / 2026-08-20 到 09-02 |
| 前綴 | docs 209、fix 138、feat 104、merge 35、chore 26、test 14、refactor 8 |
| 帶 costs if wrong 的 | 5 |
| 最忙的日子 | 09-01（85）、08-29（66）、08-26（63）、08-30（63） |

**程式碼**

| 項目 | 數字 |
|---|---|
| lib / hooks / scripts | 4,189 / 583 / 4,599 行 |
| 最大的檔案 | `scripts/task.js` 998、`scripts/docs-audit.js` 830、`lib/registry.js` 641、`scripts/orient.js` 550、`lib/stages.js` 511 |
| 測試 | 41 檔、980 個 case、全綠、約 18 秒 |
| 測試在狀態模型那半 | 559 / 939 個 case（59.5%） |

**外部 registry（同一台機器）**

| project | 紀錄 | active | 停在 | class | 備註 |
|---|---|---|---|---|---|
| claude-kit | 1 | true | survey | 無 | route 只有 survey |
| EMU3000_Web | 1 | true | design | 無 | 帶 `gateAt`，§4-E |
| PaperResearcher | 1 | false | build | spike | |
| sec-test | 2 | 1 true | land / audit | 無 / architectural | |

[Back to the index](../README.md) · [Back to the front page](../../README.md)
