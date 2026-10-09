---
status: current
last_verified: 2026-10-09
---

# 落實 10-09 工作流評審：規則落到會拒絕的腳本，站 agent 層先縮回 survey

session 91cb51ef-804b-401e-be65-965d64be97b1 的 design。輸入是 [2026-10-09 工作流評審](../reports/2026-10-09-workflow-review.md) 的六條建議與使用者的指示：六條全做，並重新評估有沒有更好的整體設計，同時保住專案背景的理解、乾淨的專案樹和含 TDD 的完整開發流程。這頁寫的是要做的事，不是現狀。

一句話：六條建議用同一個原則落實——能由腳本查的出口條件改成腳本拒絕，prompt 只留判斷；站 agent 層在對照量測證明划算之前，只交出 survey。

## 整體設計的評估

結論是不換骨架，換規則放的位置。七站（survey、design、plan、build、verify、audit、land）本身就是一條完整的開發流程：需求的盤點、設計、拆工、測試先行的實作、驗證、文件稽核、整合。評審量到 298 個任務裡 248 個走到 land，問題不在站的劃分。

六條建議的共同根因有兩個。第一，幾條本來就能機械檢查的規則寫成了散文：reviewer 的選擇器表、land 的全套綠燈、TODO 要有理由、決策頁不追加、brief 不超過上限。專案自己的順位是「腳本能查的放腳本」，這幾條卻落在量到最弱的 skill 層，於是靠事故長補丁。第二，站 agent 層是唯一沒量到收益卻全開的機制，它的補丁（`hooks/gate.js` 331 行、`lib/handoff.js` 669 行、`agents/fankeel-brain.md` 10.6KB）是替一個未證明的機制付利息。

所以整體設計是：每一條可查的出口條件變成一支會拒絕的腳本，站 agent 層退回 opt-in，等 build 與 verify 的對照量測決定它的去留。另一條路是現在就拆掉站 agent 層，專案樹會立刻少掉上千行，但那等於丟掉唯一能回答「它值不值得」的實驗；先量，量完不划算再拆，拆的是有證據的東西。

使用者要求的三件事各有落點：

- **專案背景的理解**：`context.md`、`.fankeel/map.md` 與每站的 `reads:` 不動。brief 裁切只裁最舊的 context fact，並在 brief 裡留一行指向 `context.md` 的完整路徑，所以被裁掉的事實仍讀得到，不是丟掉。
- **乾淨的專案樹**：新檔只進 `.fankeel/docs.json` 已登記的 bucket——對照腳本與真實 brief 樣本進 `docs/90-agent/reports/evidence/`（fixture），報告進 `docs/90-agent/reports/`，沒有新的頂層目錄；決策頁改寫後變短；評審原文隨這份 design 一起 commit，不再是未追蹤檔。
- **含 TDD 的完整流程**：每一列程式改動都先寫一條現在會紅的測試；land 的「全套綠燈否則停」從規則變成 `task.js land` 的拒絕，TDD 的最後一步由腳本守住。

## 1. 站 agent 層縮回 survey，再量 build 與 verify

這一節做的是評審的第一條：先縮，再量。為什麼這樣：唯一有對照臂的 A/B 只量了 survey，結論是打平（成本 0.97 到 1.05 倍）；build 加 verify 占長任務花費的 63.9%，從沒量過（`docs/90-agent/reference/subagents.md:694-700`），而同一頁自己寫著「A default should wait for that measurement」（`subagents.md:716-717`）。

- 使用者在本站 gate 選 option one 時，controller 執行 `node scripts/task.js profile set stage.agents survey`，本任務從 plan 起各站在主 session 跑。這只改本 repo 的 `.fankeel/profile.json`；內建值本來就是 `false`（`lib/profile.js:44`），`PRESETS` 不動。這改掉的是使用者 2026-10-02 為本 repo 全站交出的決定，那次的理由是 remote control 看不到 context 堆積、Claude 沒有 context 回收（`lib/profile.js:434-438`）；後一半已由 10-05 的 compact mod 補上（`docs/01-guide/profile.md:60`）。
- 新增 `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh`：以 `2026-09-26-ab-profile-pin/ab.sh` 的 worktree 與 `pin.sh` 為底，兩臂只差 `stage.agents`（`false` 對 `build,verify`），同一模型、同一任務、同一 base sha、同一份 survey 輸入。注意：現有的 09-26 ab.sh 比的是 opus 對 sonnet，兩臂都是 `stage.agents false`（ab.sh 開頭註解與 `:99-100`），它不是評審要的那個對照，`stage-agents-15` 指的重跑因此不能直接拿來用。每臂上限由 `CAP` 給，預設 30 美元；`DRY=1` 只印命令。
- 判定規則在跑之前寫進腳本開頭與報告：受控臂的主控峰值 context 比對照臂低 30% 以上、且花費不超過 1.1 倍，才把 build、verify 加回 `stage.agents`；否則維持 survey，另開任務評估移除站 agent 層。每臂只有一次（n=1），所以規則偏向「不證明就不開」。
- 實跑是 Dispatch `user` 的任務：花費經使用者核准才跑。結果寫成 `docs/90-agent/reports/<date>-build-verify-ab.md`，依結果關閉或改寫 `stage-agents-5`、`-8`、`-15`、`-16`。
- `docs/01-guide/profile.md:60` 那段加兩句：本 repo 自 2026-10-09 起只交 survey，等這次量測；量測的報告路徑。

例子，DRY 跑一次確認兩臂只差一個值：

```
DRY=1 bash docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh | grep 'stage.agents'
```

## 2. reviewer 模板的機械檢查改成腳本

這一節做的是第二條。build skill 的 reviewer 模板在 `skills/fankeel-build/SKILL.md:348-504`，Part 2 從 `:367` 起要 reviewer 手做三件機械的事：產出選擇器對測試的表（`:413-417`）、確認每條新測試有 mutation 行（`:367`）、打開每個被引用的 `path:line` 核對行號（`:417-419`、`:427-430`），中間嵌著 10-01 那次十一輪退回的逐次記錄（`:430-466`）。repo 裡沒有任何腳本做這三件事；最接近的是 `scripts/docs-check.js` 的 `resolveRef` 與 `quoteBeside`，它只掃文件裡的 `file:line`。

- 新增 `lib/reviewcheck.js` 與 `scripts/review-check.js --sha <sha> [--base <sha>]`，印三張表：（a）diff 改到的 listener 裡每個 `closest`、`matches` 的選擇器與事件名，對到測試檔中含同一字串的 `file:line`，沒對到的一列標為 finding；（b）diff 新增的每個 `test(`，在 implementer 回傳的 `red when:` 行裡有沒有一條；（c）改到的測試檔 header comment 與表中每個 `path:line`，在 `<sha>` 上那行存在、旁引的字串還在那行。
- （c）重用 `scripts/docs-check.js` 的 `resolveRef` 與 `quoteBeside`：搬進 lib 由兩支腳本共用，不複製。
- Part 2 改成兩句：先跑 `review-check.js` 並貼上輸出；reviewer 只判斷每一列的測試是否真的斷言那個效果。`:430-466` 的事故記錄搬出 skill，留一行指向 2026-10-01 那份記錄。
- mutation 的紅綠實跑仍由 `fankeel-mutator` 做（`lib/stages.js:721`）：一句散文描述的 mutation，腳本無法自己套用；腳本只查每條新測試有沒有 mutation 行。

例子：`node scripts/review-check.js --sha 31440af9 --base 97ea3aec` 印出三張表；一個差兩行的引用（10-01 的 `hdl-j:385` 實為 `:387`，`skills/fankeel-build/SKILL.md:435-436`）出現在（c）表，標 `off by 2`。

## 3. brief 不再溢出

這一節做的是第三條。實測（本機 transcript）：內嵌的 brain brief 最大 8,292 字元，被存成檔的最小 10,333 字元，共 36 份存檔、6 筆記錄到 `Output too large`；中間沒有樣本，所以 10,000 是不是 Claude Code 的確切上限仍無法確認，但 9,500 以下一律內嵌、10,333 以上一律存檔。溢出的來源是 `pushContext`（`lib/render.js:654-659`）把 `context.md` 整份貼進來而沒有上限，`context.md` 最多 40 條（`scripts/context.js:24`）。現有的上限測試 `tests/brief.test.js:129` 只跑一個沒有 context 的小 fixture。

- `lib/render.js` 的 `renderBrainBrief` 與 `renderBrief` 共用一個常數 `BRIEF_MAX = 9500`：成品超過時，從最舊的 context fact 起刪，刪掉的換成一行「另有 N 條，在 <context.md 的絕對路徑>」。
- 真實樣本：從本機存檔的那份 16,792 字元 brief 取出 context 段與 already-answered 段，放進 `docs/90-agent/reports/evidence/2026-10-09-brief-overflow/`。`tests/brief.test.js` 用它渲染 build brain、plan brain 與一般 reader 三種 brief，斷言都小於 `BRIEF_MAX`。這條測試現在會紅。
- `tests/brief.test.js` 其餘七處寫死的 `10000` 改用同一個常數。
- `brief-2` 的根因（brief 被存成檔、brain 沒開）由此消失，該條目關閉；`agents/fankeel-brain.md` 開頭「先讀存檔」那段留作後備，不再加規則。

## 4. HEAD 轉綠，land 的全套綠燈由腳本拒絕

這一節做的是第四條。HEAD 的紅燈是 `tests/source.test.js:177` 那條：`status`、`last_verified`、`source_of_truth`、`link` 以外的 frontmatter key 不得帶裸的 repo 路徑（`:212`），而 `build-8`、`station-18`、`station-20` 的 `description` 各帶一個。land 的規則寫著「Red stops everything」（`skills/fankeel-land/SKILL.md:44`），但 `scripts/land.js` 只跑 git、`scripts/commit.js` 不讀任何測試結果，沒有一支腳本會在紅燈時拒絕。

- 三條 `description` 裡的路徑加反引號；`node --test tests/source.test.js` 由 5 pass 1 fail 變成 6 pass。
- 新增 `scripts/suite.js`：跑一次 `node --test`，把 `{ sha, pass, fail, at }` 寫進 `.fankeel/build/task-<started>/suite.json`（`.fankeel/.gitignore:3` 已忽略的目錄）。
- `task.js land` 拒絕記錄整合，除非 `suite.json` 存在、`fail` 為 0、且從它的 `sha` 到 HEAD 沒改到 `.md` 以外的檔（`git diff --name-only <sha> HEAD`）。land 第 2 到 4 節只改文件與 map，所以照常通過；第 2a 節改了版本號就得重跑。`task.js land` 是 land 第 6 節一定會跑的那一步（`skills/fankeel-land/SKILL.md:219`），所以它是收口。
- land skill 第 1 節與 `lib/stages.js:398` 的輸出改成跑 `scripts/suite.js`、貼它的那一行。

例子：`node scripts/suite.js --session <id>` 印 `suite: 2412 pass, 0 fail @ 1a2b3c4d`；紅燈時接著跑 `task.js land merge` 會印 `task.js: suite is red at 1a2b3c4d (3 fail) — land stops` 並以非零結束。

## 5. 決策頁改寫，TODO 補理由

這一節做的是第五條。`docs/03-decisions/fankeel-shell.md` 834 行，有四段 `(Superseded …)`（`:157`、`:183`、`:187`、`:338`）連同被取代的舊文都還留著。`scripts/todo-check.js` 唯一碰 body 的規則只量長度（`:293-297`，至少 200 字元），所以只寫「來源：根目錄 TODO.md 第 N 行…」再抄一次舊條目的 body 照樣通過。

- `fankeel-shell.md` 改寫成只寫現行決定：四段 Superseded 與它們取代掉的段落刪除，歷史留在 git；每一節說決定、理由、出處各一次。
- `scripts/docs-check.js` 對 role 為 `decision` 的頁，遇到以 `Superseded` 或 `已取代` 開頭的段落報一條 finding；測試先紅，改寫後全 repo 乾淨。
- 17 條未完成、只帶遷移樣板的 TODO：`build-6`、`build-7`、`build-8`、`design-2`、`docs-3`、`hooks-1`、`render-2`、`session-1`、`stage-agents-15`、`stage-agents-16`、`station-18` 到 `station-23`、`tests-4`。每條補一段「為什麼要做、做完長什麼樣」，或改成 done 並寫明不做的理由。
- `scripts/todo-check.js` 加 `no reason`：未完成的條目，body 扣掉遷移那段與重複 `description` 的那行後不到 200 字元，就報。測試先紅。

## 6. 在別的專案跑一週，數崩壞

這一節做的是第六條。這條的結果要一週後才有，本任務交付的是量具與排程，不是結果。`scripts/sessions.js` 已經按 session 數「倒退次數」（`scripts/sessions.js:4-6`），但沒有一支腳本跨任務數崩壞。本機已有 `.fankeel` 的非 fankeel 專案有 KilnPC、EMU3000_Web、PaperResearcher、claude-kit 與 sec-test。

- `scripts/sessions.js` 加 `--breakdowns`：對 `--project <dir>` 的每個任務數四樣——verify 退回 build、沒到 land 就 stood down、fankeel hook 拒絕的 tool call、hook 逾時或出錯——每筆附 session id 與時間，可以回頭查。測試用 `tests/tmp.js` 造的記錄先紅。
- Dispatch `user` 的任務：使用者挑一個上面的專案用 fankeel 跑一週，之後跑 `node scripts/sessions.js --breakdowns --project <dir> --since <date>`，結果寫成 `docs/90-agent/reports/<date>-foreign-week.md`。
- 這條在本任務 land 時尚未完成，記成一條 TODO（`timing: after:` 那一週），不擋 land。

## 測試與驗收

每一列程式改動都是測試先行：

| 改動 | 現在會紅的那條測試 |
|---|---|
| 三條 description | `tests/source.test.js:177`，已紅 |
| brief 裁切 | `tests/brief.test.js` 新案例，真實樣本超過 9,500 |
| review-check | 新測試：差兩行的引用、沒對到測試的選擇器、沒有 mutation 行的新測試，各報一條 |
| suite 紀錄與 land 拒絕 | 新測試：沒有紀錄、紀錄為紅、紀錄後改了 `.js`，`task.js land` 都非零結束 |
| docs-check 決策頁 | 新測試：decision 頁含 Superseded 段報 finding |
| todo-check `no reason` | 新測試：只帶遷移樣板的條目報 finding |
| sessions `--breakdowns` | 新測試：造好的四種事件各數到一次 |

成品的一列：A/B 報告裡每臂的花費與峰值，要和 `summary.json` 算出來的一致，報告的結論段用的是同一組數字（評審點名 controller multiplier 報告改了表、沒改結論）。

## 未驗證

- 一對 A/B 的實際花費：09-26 的腳本每臂上限 62.50 美元，`stage-agents-15` 寫約 30 美元，這一對從沒跑過。
- implementer 回傳的 `red when:` 行是否落在 `review-check.js` 讀得到的檔（推測是 `.fankeel/build/task-<started>/task-N.md`，未開）。
- hook 逾時與 hook 拒絕是否寫進 transcript，讓 `sessions.js` 數得到。
- 10,000 是否為 Claude Code 的確切上限；`BRIEF_MAX = 9500` 只保證落在所有已觀察到的溢出之下。
