---
judged: 2026-10-19T15:18:33.011Z
model: fable
agent: fankeel-judge
task: "每個任務 land 時寫六欄完成紀錄，監控站卡片與最後訊息都用它"
session: 8e505921-0314-4eac-98c7-45ca3e1370dc
stage: land
---

# 問題

## Question

# 問題

fankeel 的 suite 現在是什麼？其中有沒有測試是隨著迭代開發變得不需要的——它保護的東西已經被刪掉、改名、被另一個測試完全涵蓋，或只是在釘一段早已改寫的文字？

使用者原話：「幫我檢查看看這個專案 現在這個專案SUITE 是甚麼 然後 我們的 TEST 部分 是全部真的都有必要的嗎? 就是有沒有那種測試是根據時間迭代開發後不需要的」

# 選項

1. **刪一批**：列出可以直接刪的測試（檔案或單條 test），每條附理由與證據。
2. **合併／改寫一批**：重複或只釘文字的測試，改成一條更強的。
3. **都留著**：沒有找到真正可刪的，說明為什麼。

可以混合（例如「刪這 N 條、合併這 M 條、其他留著」），但 pick 要說出主要方向。

# 背景

- 根目錄 F:/ymlab/fankeel，純 Node（node:test），無依賴。`package.json`：
  - `test`: `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`
  - `test:fast`: 同上加 `--test-skip-pattern=@slow`
- `tests/` 下 312 個 `*.test.js`。最近一次完整跑：4757 pass, 1 fail（已修），約 340 秒；快速版約 4630 條、約 250 秒。
- `scripts/suite.js` 包裝這兩個指令並把結果記到 `.fankeel/build/<task>/suite.json`；land 要求完整 suite 綠燈。
- 已知的「元測試」：`tests/source.test.js`（匯出必須有人引用等）、`tests/docs.test.js`、`tests/stages.test.js`（很多是 grep SKILL.md 文字）。
- 有些測試只用 regex 檢查 skill／文件的文字（例如 tests/stages.test.js:1232-1237），對抗審查剛指出這類測試「不會因程式行為錯誤而失敗」。
- 專案每次改動都會 release，提交很多（git log 可查每個測試檔的最後修改與它所測模組是否還在）。

# 要讀的路徑

- package.json、scripts/suite.js、tests/subprocess-timeout.js
- tests/ 整個目錄（312 檔）：用 `git log --format=%cs -1 -- <file>` 看最後修改；看每檔 require 的模組是否還存在、被測的函式是否還被匯出／呼叫。
- tests/source.test.js、tests/docs.test.js、tests/stages.test.js 作為「文字釘子」類型的代表。
- docs/90-agent/reference/ 下描述測試或 suite 的頁面（grep "suite" / "@slow"）。
- 若有測試名稱含舊功能（已刪除的 curve、tour、v5 wav 等），對照 git log 確認該功能是否還在。

# 什麼算答案

- 先用 2–4 句說清楚「suite 是什麼」：指令、檔數、條數、時間、@slow 的意思、誰在跑它（verify 跑 fast，land 跑全部）。
- 再給候選清單，每條：`path[:line]` — 類別（被測物已刪／重複／只釘文字／過時日期或版本常數／其他）— 證據（哪個檔或提交說明它已不需要）— 建議（刪／合併到哪／改成行為測試）。
- 只列有證據的；猜的標「未證實」。
- 估計刪完能省多少條、多少秒（若讀得出來）。
- 若某類（例如文字釘子）數量大到不能逐條列，給計數與三個代表例，不要全列。

# 回答形狀

六欄（pick / why / risk / evidence / delegated / next），`pick:` 一行寫選了 1、2、3 或混合；之後 `## Summary` 放上面要求的 suite 說明與候選清單。

## Answer

pick: 混合，以 3「都留著」為主：0 個測試檔可直接刪，約 4 處可合併或拿掉重複斷言（選項 2 的小批），其餘留著。
why: 312 檔全部以腳本掃過：沒有任何 require 指向已刪模組、沒有解構到已不存在的匯出、沒有字串指到已消失的 repo 路徑（讀者 B）；curve/tour/wav/v5 的被測物都還在（assets/station/tour-ring.js:763,910、scripts/tour-record.js:32），被刪功能的測試已隨 7066c5ed、e3d89e7d 一起刪掉。15 組同名測試都是測不同 hook（inject.js vs resume.js、gate.js vs gate-write.js），不是重複。stages.test.js 的約 50 條「釘文字」是 audit skill 明文倚賴的機制（skills/fankeel-audit/SKILL.md:175-182），刪了就失去規則措辭的唯一紅燈。真正的重複只有 stages.test.js:1228（與 :427 同一句）、docs.test.js:682（:662 已蓋住）等零星斷言。
would flip if: 專案決定退役 promo30v3/v4 時間軸（那 tour-promo30v3/v4.test.js 與 tour-promo30v5.test.js:156 的 @slow 雜湊釘就可刪）；或 audit 不再用「拔掉措辭看哪個測試紅」當依賴訊號（那 stages.test.js 約 50 條文字斷言就成候選）。
unread: 沒有漏掉 brief 點名的路徑；但 312 個測試檔是讀者用腳本掃描（require／匯出／路徑／日期），逐檔人眼讀過的只有約 15 檔。
delegated: package.json、scripts/suite.js、lib/suite.js、tests/subprocess-timeout.js、skills/*/SKILL.md 與 lib/stages.js（grep）、.fankeel/build/task-20261019T115119/suite.json、task-20261019T101953/suite.json — sonnet；tests/*.test.js 全部 312 檔（require／匯出／路徑字面值掃描）— sonnet；tests/*.test.js git 日期、最舊 20 檔與其模組、tour 相關檔、git log 刪檔 — sonnet；tests/stages.test.js、docs/ 內 stages.test 引用 — opus；tests/source.test.js、tests/docs.test.js 及其它檔的重複 grep — sonnet；tests/*.test.js 同名、版本常數、日期、skip、無 assert 掃描 — opus；tests/record.test.js、record-docs、station-record、station-record-data、gatereport、stages 與 station（grep record）— sonnet；docs/01-guide/development.md、docs/90-agent/reference/*.md、docs/02-architecture/pipeline.md、skills/fankeel-build|verify|land|audit/SKILL.md、CONTRIBUTING.md、.fankeel/map.md — sonnet。
checklist: 1 package.json 指令 — answered；2 scripts/suite.js — answered；3 subprocess-timeout.js — answered；4 誰跑 fast／full — answered；5 suite.json 數字與 @slow 計數 — answered（每檔秒數無從讀出）；6 312 檔有無指向已刪模組／匯出 — answered（無）；7 git 日期與舊功能名 — answered；8 stages.test.js 文字釘分類 — answered；9 source/docs 元測試 — answered；10 同名、常數、skip — answered；11 本任務 record 系列重疊 — answered；12 專案對測試的規則 — answered。

## Summary

### Suite 是什麼

- 指令：`npm test` = `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`（package.json:11）；`npm run test:fast` 同上再加 `--test-skip-pattern=@slow`（package.json:12）；Node >=22.5（package.json:7-8）。`tests/subprocess-timeout.js:10-26` 把 execFileSync／spawnSync／execSync 包一層，沒給 timeout 的子行程預設 120 秒（:12），卡死時只紅一條而不是整個 suite 掛住。
- 規模：312 個 `*.test.js`，`^\s*test(` 共 4620 行（讀者 B）。最新完整跑 4759 pass／0 fail／364.6 秒；fast 跑約 4627–4630 pass／約 252 秒（.fankeel/build/task-20261019T115119/suite.json）。`@slow` 標籤出現在 47 檔、140 行（讀者 A 手加總），意思是「單條跑 10 秒以上」（docs/01-guide/development.md:27-35）；完整與 fast 的差約 110 秒就是這 140 條。
- 誰跑：build 收尾與 verify 的測試列都跑 `suite.js --session <id> --fast`（skills/fankeel-build/SKILL.md:531-532、skills/fankeel-verify/SKILL.md:89-94、docs/01-guide/development.md:36-38）；land 跑完整 `suite.js --session <id>`，且 `--check` 會拒絕 fast 紀錄（skills/fankeel-land/SKILL.md:62-67，已抽查原文）。`scripts/suite.js` 用 `--fast` 選 `test:fast`、取機器級鎖、把 pass／fail／ms 寫進 `.fankeel/build/task-<started>/suite.json`（scripts/suite.js:10,70-79,90；lib/suite.js:25-26,96）。

### 各讀者找到什麼，抽查結果

- 讀者 B（312 檔腳本掃描）：13 個「找不到的 require」全是測試寫進 fixture 的字串（例如 tests/requires.test.js:24，抽查屬實）；解構名稱對不上 module.exports 的：0；指向不存在 repo 路徑的字面值：只有 tests/skills.test.js:182,811,1189 的三個標籤，同一行讀的是新路徑。它列的「50 檔無本地 require」**不是**純文字測試——抽查 tests/station-hdl-b.test.js:14 是 readFileSync + vm 載入 station.js，tests/band-0108.test.js:9 是 import() hooks/*.ts，都是行為測試；這份清單只能當「不用靜態 require」看。
- 讀者 C（git 日期、舊功能）：最舊的是 2026-08-29 的 overlap／report／argv，它們的模組同日最後改動，名稱全對得上。tour 功能還在（scripts/tour-record.js、assets/station/tour*.js 共 10 檔）；promo30v3／v4 仍在 assets/station/tour-ring.js:763,910 註冊、scripts/tour-record.js:32 列名（我抽查屬實）。被刪的 tour-closing／doc／opening／stages／quickstart／wizard 測試已隨 7066c5ed、e3d89e7d 刪掉。station-wizard-motion.test.js 測的是 lib/profile.js 與 scripts/render.js（:13-14），station.js 內 wizard 仍有 11 處，不是殘留。
- 讀者 D（stages.test.js，opus）：102 條；嚴格「只讀檔案文字」的只有 1 條（:1232 讀 skills/fankeel-land/SKILL.md）；另約 50 條是從 `byName().rules`／`templateFor`／`ALWAYS` 取字串後只做 `assert.match`。三個代表：:479 `/denominator/`、:779 `ALWAYS[2]` 對 `/the constraint wins and the shape stays/`、:1232 對 SKILL.md 三個 regex。檔內重複：`` `/clear` after, never before ``在 :427 與 :1228（抽查屬實，同一來源 `byName('land').rules`）；`Option one is the approval` 在 :246 與 :303；`leaves a decision record behind` 在 :233 與 :1187。
- 讀者 E（source／docs 元測試）：source.test.js 6 條，核心是 :117「每個匯出都要有人 import」（抽查屬實，tests/ 內的使用也算），沒有「每個模組都要有測試」之類的規則；docs.test.js 52 條，多數是 fixture 上測 lib/docs.js 與 docs-check，讀真 repo 的只有 :513、:538、:574、:662、:682、:696。
- 讀者 F（同名、常數、日期，opus）：15 組同名，抽查 inject.test.js:177-195 與 resume.test.js:207-225 文字幾乎相同，但 HOOK 分別是 hooks/inject.js（inject.test.js:17）與 hooks/resume.js（resume.test.js:16），gate 與 gate-write 同理（gate.js:17 vs gate-write.js:18）——同名不同被測物，不是重複。沒有測試釘現在的版本號 0.111.37；日期全是 fixture 輸入或自身往返；只有 1 個條件 skip（station-launchers.test.js:58，win32）；沒有無 assert 的檔。
- 讀者 G（本任務 record 系列）：record.test.js 8 條、station-record 10 條、station-record-data 2 條、gatereport 24 條全是行為測試；record-docs.test.js 3 條是純文字釘。重疊：station-record.test.js:15 與 :80 同一 ask-row regex 但一走 `listAskRow`、一走 vm 內 `drawList`（抽查屬實，不同呼叫路徑）；record.test.js:67(85) 與 :111(115) 同一 `rec.file` 斷言但 :111 測「無 records bucket」分支。
- 讀者 H（規則）：沒有任何頁面禁止純文字測試，也沒有「刪測試」的規則；audit 把「拔掉一句規則、跑釘它的測試看紅不紅」當作措辭有無被依賴的判準（skills/fankeel-audit/SKILL.md:175-182，抽查屬實）；build 要求每條新測試附「red when: <mutation>」（skills/fankeel-build/SKILL.md:232-234）。

### 候選清單（只列有證據的）

1. tests/stages.test.js:1228 — 重複 — 與 :427 對同一個 `byName('land').rules` 斷同一句 `` `/clear` after, never before `` — 建議：拿掉 :1228 這一行斷言（測試本身 :1225 留，它釘的是六欄模板）。
2. tests/stages.test.js:303 — 重複 — `Option one is the approval` 已在 :246 釘過（同為 lib 常數）；render.test.js:247,252,274 另外對渲染輸出釘 — 建議：合併進 :242。
3. tests/stages.test.js:1187 — 重複 — `leaves a decision record behind` 已在 :233 釘過 — 建議：留 regex 較長的 :1187，刪 :233 那一行。
4. tests/docs.test.js:682 — 釘常數 — 硬寫 17／13／4；:662 已用 `assert.deepEqual(declared, actual)` 比對完整清單，清單相等則數量必相等 — 建議：併進 :662，:696 的中文數字句改成從 `actual.length` 推字，否則每加一個 trackedFiles 呼叫端要改三處。
5. tests/record-docs.test.js:10,18,26 — 只釘文字 — 三條對 plain-language.md／station.md／docs/README.md 做 includes；record.test.js:67(84) 已用行為驗六個欄名 — 建議：留（這三頁沒有別的紅燈），但不要再加同類。
6. 「只釘文字」類計數：stages.test.js 約 50 條（讀者 D 啟發式）、另外可確認的純文字檔有 record-docs、version-prose（:3-13，釘「十三個 skill」的字句）、title-docs 等（讀者 B 清單中名稱含 -doc／-docs／-prose／-rules 者約 12 檔，只抽查了 version-prose）。代表例：stages.test.js:479、:779、:1232。這類是 audit 的依賴訊號，不建議刪；對抗審查說的「不會因程式行為錯誤而失敗」屬實，但它們守的是會被注入 prompt 的規則措辭，措辭即產品。
7. tests/source.test.js:222 — 其他 — 「沒有出貨檔含 ponytail」是一條負向字詞守衛，`git log -S ponytail` 只見 docs 提及；為何需要這條，我沒讀 :216-221 的註解 — 標「未證實」，建議下次 audit 讀一次決定。
8. tests/tour-promo30v3.test.js、tests/tour-promo30v4.test.js、tests/tour-promo30v5.test.js:156（@slow，3600 幀 × 2 語 sha256）— 其他 — 被測的 v3／v4 時間軸仍存在，不算過時；但 v5（74 秒）已是現行成片，v3／v4 是否還需保留是產品決定，不是測試清理 — 標「未證實」。tests/tour-record.test.js:168 釘機器專屬路徑 `F:/ymlab/fankeel-videos/v5/`，是 scripts/tour-record.js 真實預設，照樣留。

被測物已刪：0。重複（整條測試）：0；重複（單行斷言）：3。只釘文字：約 50 條 + 約 12 檔，留。過時日期／版本常數：0 條釘現行版本；docs.test.js:682 的 17/13/4 是唯一硬編碼計數。

### 省多少

直接可拿掉的只有 3 行斷言與 1 條測試（docs.test.js:682 併入 :662）：約 1 條、不到 1 秒。suite.json 只記總秒數，讀不出每檔時間；若日後決定退役 v3／v4 時間軸，可省 3 檔（tour-promo30v3／v4 全部 + v5:156）與其中一條 @slow 的雜湊迴圈，估計數秒到十幾秒，未測。

### 風險與下一步

- 風險：讀者 B 的「無 require」清單若被當成「純文字」清單照刪會誤殺行為測試（station-hdl-*、pane-*、band-0108 都是 vm／import 載入）。stages.test.js 的 50／52 分法是 regex 啟發式，逐條沒讀。
- 下一步：把第 1–4 項當一個小 chore（四處改動、一次 fast suite）；第 6 項留給 audit 的「移出注入」流程處理，不在這裡刪；第 8 項先問使用者 v3／v4 成片還要不要。
