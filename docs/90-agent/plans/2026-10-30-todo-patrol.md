---
status: design-intent
last_verified: 2026-10-30
---

# TODO 全表盤點 Implementation Plan

**Goal:** 這輪盤點的 Ready 條目與使用者追加的格式改動一次做完：gate 的階段名、header 與選項標籤改首字大寫；手機對話的圖片與輸入框；focus 頁空白、手機 gate 畫圖、station 圖真瀏覽器驗證；gate 頁按鈕截圖確認；design 站依專案決定畫不畫手機版。
**Architecture:** 十八個任務分五組，檔案互不重疊的組可並行：格式改動（Task 1-7）以 `lib/handoff.js` 的 `stageWord` 為唯一來源，其餘規則文字與測試跟著改；手機對話（Task 8-10）加 `GET /phone/img` 與縮圖；focus 頁與手機圖（Task 11-13）補 `focusShell` 的模組清單、phone.json 帶 `diagrams`；按鈕與 design（Task 14-16）；最後兩個 `user` 任務（Task 17-18）在真瀏覽器與真手機上確認。station 拆模組（station-52）不在本計畫：它照既有的 `2026-10-28-station-shell-6.md` 與 `-7.md` 在本計畫落地後依序跑，本計畫不動 `assets/station/station.js` 與 `nav.js`。
**Tech Stack:** Node `>=22.5`（package.json），零 runtime 依賴，無 build；station 前端是 classic script 掛 `window.FK_*`；測試 `node --test` 與 `node:vm`。
**Spec:** ../../../.fankeel/build/task-20261029T202553/survey.md

## Global Constraints

### 來源 (part a)

- `package.json`：`"version": "0.134.0"`、`"engines": { "node": ">=22.5" }`；測試指令 `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`（`"test"` script）。不新增相依套件。
- repo 根目錄沒有 `CLAUDE.md`（已確認 `F:/ymlab/fankeel/CLAUDE.md` 不存在），慣例取自既有程式碼：4 格縮排（`lib/handoff.js`、`tests/gate-format.test.js`）、`'use strict';` 開頭、單引號字串、`node:test` + `node:assert`。
- 記憶規則：每次 fankeel 變更都發版——改規則文字與 gate 檢查屬 bug fix／格式變更，版本號由 land 階段處理，本 part 不改 `package.json`、不改 `skills/*/SKILL.md` 的 `version:` frontmatter。
- 計畫格式（`skills/fankeel-plan/SKILL.md`）：每個 `Modify:` 最多 3 個（`FILE_CAP` 3）；超過 `READ_CAP` 1500 行的檔案要寫成 `path:a-b`（本 part 的 Modify 檔都在 1500 行以下：`lib/handoff.js` 878、`lib/stages.js` 764、`lib/render.js` 856、`skills/fankeel/SKILL.md` 1094）；每個語言 code fence 之前 3 行內要有該 task Files 區塊內的路徑（反引號）。
- gate 欄位寬度規則維持不變：`header` 最多 12 欄，CJK 字算 2（`Survey`、`Verify` 都在內）；問題第一行 `<Stage> -> <Next> | <project> : <task>`；選項 3 個以上、第一題含「暫停」。
- `lib/handoff.js` 的 `formatProblem` 只檢查第一題；patrol 的後續題保留自己的 header（`tests/gate-format.test.js` 的 "only the first question is held to it"）。
- `hooks/gate.js:367` 的 `headerOf` 本來就 `toLowerCase()` 比對，大小寫不影響它，不必動。

### 來源 (part b)

本 repo 沒有 `CLAUDE.md`（`CONTRIBUTING.md` 開頭寫明：`There is no `CLAUDE.md` and no `AGENTS.md` in this repository.`），所以約束改抄 `CONTRIBUTING.md`、決策頁與現有測試。

- CONTRIBUTING.md「Core logic」：`Pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction.`
- CONTRIBUTING.md「CLI entry points」：`Thin wrappers over `lib/`. A new flag on the station CLI needs a row on `docs/90-agent/reference/station.md`, or `tests/station-doc.test.js` fails.`（本案不加 CLI flag，但新路由寫進同一份 station.md 的 `/phone/upload` 段落。）
- CONTRIBUTING.md「Tests」：`node --test. Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.`（本案不新增任何 export；三個新測試檔寫完要 `git add`。）
- CONTRIBUTING.md「Version numbers」：`Run it to move the number. It is what keeps eighteen files in agreement; hand-editing any one of them is how they stop agreeing.`（本案不動版號。）
- CONTRIBUTING.md「Generated station output」：`Never hand-edit a file `station.js serve` writes.`
- docs/03-decisions/2026-10-24-station-vanilla-modules.md「決定」：`每個畫面是一個 classic script，沿用既有模組的 CJS guard：瀏覽器裡掛在 `window.FK_*`，node 測試 `require` 同一個檔。`
- 同頁：`index.html 是唯一手寫的模組清單；`lib/station.js` 的 `MODULES` 與 `scripts/station.js` 的 `STATIC` 從它讀出，`tests/station-module-lists.test.js` 斷言三者一致。`（本案不新增前端檔案，所以清單不動。）
- 同頁「為什麼」：`伺服器是 `node:http`、零依賴、無 build` —— 不加依賴，不用 ESM、不用框架；`assets/station/mobile.js` 維持 ES5 風格（`var`、`function`、無箭頭函式）。
- `tests/station-mobile-page.test.js` 的 XSS 測試（約 :150-168）：每個畫面 `assert.ok(!html.includes('<img'))` 在 `bad` 文字上成立；縮圖只能由符合 `/^\d+-[0-9a-f]{6}\.(png|jpeg|gif|webp)$/` 的檔名產生，其餘 `[圖片]` 行仍走 `esc()`。
- `tests/station-mobile-page.test.js:402`：`a /phone/say refusal keeps the draft in the composer and says why` —— 送出被拒時輸入框的字要回來，且 `<p class="note" role="status">測站沒收下（409）：not attached</p>` 不變。
- `tests/station-phone.test.js:137`：`/phone/upload` 回 201 加絕對路徑；`phone/upload` 的 401／403／404／413／415 既有行為不變。
- `lib/remote.js:56-61` `policy()`：GET 預設 `device`，從 tailnet 來的 `/phone/img` 不用改 policy 就要配對過的 cookie。

### 來源 (part c)

這個 repo 沒有 `CLAUDE.md`（CONTRIBUTING.md 第 3 行：「There is no `CLAUDE.md` and no `AGENTS.md` in this repository.」）。下面照 CONTRIBUTING.md、決定頁與測試原文抄。

- 「Pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction.」（CONTRIBUTING.md，Core logic）
- 「`node --test`. Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.」（CONTRIBUTING.md，Tests）
- 「Never hand-edit a file `station.js serve` writes.」（CONTRIBUTING.md，Generated station output）
- 「Run it to move the number. It is what keeps eighteen files in agreement; hand-editing any one of them is how they stop agreeing.」（CONTRIBUTING.md，Version numbers；`scripts/version.js`）
- 「每個畫面是一個 classic script，沿用既有模組的 CJS guard：瀏覽器裡掛在 `window.FK_*`，node 測試 `require` 同一個檔。」（docs/03-decisions/2026-10-24-station-vanilla-modules.md）
- 「`index.html` 是唯一手寫的模組清單；`lib/station.js` 的 `MODULES` 與 `scripts/station.js` 的 `STATIC` 從它讀出，`tests/station-module-lists.test.js` 斷言三者一致。」（同上）
- 「vm 測試經 `tests/station-src.js` 依 `index.html` 的順序載入全部腳本，跟瀏覽器看到的一樣。」（同上；所以 vm 測試看不到「focus 殼少載模組」，Task 11 的測試因此自己照 `focusShell` 的清單載入）
- 四格縮排；`lib/station.js`、`lib/mobile.js`、測試檔在工作樹是 LF，`assets/station/mobile.js`、`assets/station/mobile.css` 在工作樹是 CRLF（`git ls-files --eol`：`i/lf w/crlf`，`.gitattributes` 是 `* text=auto eol=lf`）。
- tests/station-modules.test.js:88-94 斷言 focus 殼的 script 與 stylesheet 清單逐項相等；tests/station-module-lists.test.js:17 斷言 `MODULES`；tests/station-mobile-page.test.js:171 斷言 `STR.en` 與 `STR.zh` 的 key 相同、英文值無 CJK；tests/station-mobile-page.test.js:195 斷言畫面用到的每個 class 在 mobile.css 或 station.css 有規則。
- 回覆與 gate 用繁體中文；程式碼與 commit 訊息照舊（使用者 memory）。commit 結尾加 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。

### 來源 (part d)

來源：repo 根目錄與 `~/.claude` 都找不到 `CLAUDE.md`（`find . -maxdepth 2 -name CLAUDE.md` 無結果），所以約束取自使用者的 auto-memory `MEMORY.md`、決定文件與測試。

- `MEMORY.md`：「Release on every fankeel change — bug fix bumps patch, feature/UI bumps minor, major untouched; commit, plugin update after each land; full suite only when code/skill/agent changed, docs-only runs version.js + todo-check.js」
- `MEMORY.md`：「Suite needs Chrome's full path — set FANKEEL_BROWSER to chrome.exe's path and pass --session, or the suite fails or silently runs nothing」
- `MEMORY.md`：「Reply in Traditional Chinese — chat, recaps and gates in 繁體中文; code and commits unchanged」
- `MEMORY.md`：「Parallel sessions share one checkout — neighbour commits land on your branch; cherry-pick to land, switch back to main before plugin update」
- `docs/03-decisions/2026-10-24-station-vanilla-modules.md:8`：「station 的前端維持手寫的 classic script 加 `window.FK_*` 全域、零依賴、無 build」
- 同檔 `:14`：「每個畫面是一個 classic script，沿用既有模組的 CJS guard：瀏覽器裡掛在 `window.FK_*`，node 測試 `require` 同一個檔。」
- 同檔 `:16`：「`index.html` 是唯一手寫的模組清單；`lib/station.js` 的 `MODULES` 與 `scripts/station.js` 的 `STATIC` 從它讀出」。本部分不新增也不改名任何 station 模組，只改 `assets/station/gate-frame.css` 的現況驗證，所以此條不動。
- `package.json` 沒有 `dependencies`（`scripts/render.js:5`：「Zero dependencies, like everywhere else in this repository」）；本部分不新增依賴。
- `skills/fankeel-plan/SKILL.md`：`FILE_CAP` 3（一個 task 最多 3 個 `Modify:`），`READ_CAP` 1500（`lib/plantasks.js:387`）。
- `tests/station-gate-pick-style.test.js:17-26`：`.gq-pick` 要有 `min-height:32px`、`border:1px solid var(--rule2)`、`box-shadow:none`、不含 `inset`；`.gq-pick:hover` 含 `border-color:var(--keel)`；`.gt-send` 含 `border-color:var(--keel-deep)`。
- `tests/design-guide.test.js:15-17`：design-guide.md 不得超過 150 行；`tests/design-guide.test.js:29-32`：design SKILL.md 必須仍含 `` `design.mockup: auto` `` 與 `` `design.skill` is a list ``，本部分只加段落、不改這兩句。
- `tests/design-skill.test.js:13-16`：design SKILL.md 不得出現「方向」「逐塊」二字，新增的段落一律不用這兩個詞。
- `lib/shots.js:12-13`：page 的 `viewport` 是 `"W,H"`，解析規則 `/^[0-9]+,[0-9]+$/`（`lib/shots.js:57`）。
- `skills/fankeel-design/SKILL.md:81`（步驟 3 標題）：「The mockup — frontend work only」；`lib/stages.js:264`：mockup 一步放在 `when: 'design.mockup'` 之後，沒有前端的專案到不了這一步。

## Risks

- 舊的全大寫形式（`SURVEY -> PLAN`、`Go to PLAN`、`Stay in SURVEY`）在新檢查下一律被拒絕——這是刻意的：只留一種格式，避免模型兩種都寫、使用者兩種都看到。代價是任何還在跑的 session 若已讀過舊規則文字，第一次 gate 會被 `formatProblem` 退回一次，錯誤訊息會教它新格式。影響 Task 1，它先寫「舊形式被拒」的測試。
- 所有 task 之間檔案互不重疊，可以並行；但 Task 1 一合進去，Task 4–7 列的舊測試在它們各自的 task 完成前會是紅的。建造時不要在中途拿全套件當綠燈，等四個測試 task 都完成再跑 `suite.js --fast`。
- `tests/stages.test.js` 被 Task 2（line 267 的規則句）與 Task 3（line 1080 的 land 技能文字）都寫，`Files` 衝突，build 會讓它們依序跑，不能同批。
- `INIT -> SURVEY` 這個形式：`lib/stages.js` 的 `INIT` 規則（158-163 行）本身沒有講 header／stem，`STAGE_WORDS` 也不含 INIT，所以程式碼裡沒有「INIT」要改；使用者要的 `Init -> Survey` 只在 `ALWAYS[0]` 的 `THIS -> NEXT` 模板裡以 `Init` 開頭自然成立（`stageWord('init')` 也回 `Init`）。若之後要讓 init 的 gate 也被 `formatProblem` 檢查，需另外把 `'init'` 加進 `STAGE_WORDS`——本 part 不做。
- `lib/render.js:623` 的 brief 文字被 `tests/brief.test.js:702-703` 以字串比對鎖住；兩處要同一個 task 一起改，否則 brief 測試紅。
- `skills/fankeel-land/SKILL.md:269` 的 `Stay in LAND` 被 `tests/stages.test.js:1080` 的 regex 鎖住（Task 3 同步改）。
- 掃過 `assets/station`、`lib/notify.js`、`lib/remote.js`、`hooks/*.ts`：顯示 `q.header` 時原樣輸出，沒有依賴大寫；`hooks/pane-band.ts`、`hooks/pane-svg.ts` 的 `FANKEEL ${stage.toUpperCase()}` 是狀態列招牌、不是 gate 格式，不改。未驗證：Windows 上使用者自己的 `~/.claude` 內是否另有教大寫形式的 memory／自訂 skill（repo 外，掃不到）。

- 經由其他電腦（`/station/peer/<machine>`）看的對話，縮圖網址是相對的 `/phone/img?...`，會打到本機測站而不是對端 —— 命中 Task 9 —— Task 9 先確認 `bubble()` 沒有 `via()` 可用（`via` 在 boot 閉包 `assets/station/mobile.js:1360`，純函式 `screen()` 拿不到），縮圖載入失敗時顯示 `alt` 文字；peer 轉發是否能帶二進位 body（`peers.forward`，`scripts/station.js:563`）未驗證，不在本案範圍，列為後續 TODO。
- `[圖片] <path>` 只在路徑檔名符合測站存檔格式時才換成縮圖；桌面端使用者自己打的同形狀行也會被換 —— 命中 Task 9 —— 測試固定「不符格式的行留作文字」。
- `GET /phone/img` 是新的讀檔面 —— 命中 Task 8 —— 檔名只收 `^\d+-[0-9a-f]{6}\.(png|jpeg|gif|webp)$`、目錄固定為 `phone.dirOf(root, id)/uploads`，測試涵蓋 `..`、斜線、未知 id、未知 root。
- 輸入框一送出就清空，相片列仍留到 201 才清 —— 命中 Task 9 —— 在飛行中再按送出會把同一批相片再送一次（現況本來就如此，本案不修，不擴大）；失敗時文字放回 `st.ui.draft`，期間新打的字接在後面，不覆蓋。
- `assets/station/mobile.js`（1899 行）超過 `READ_CAP`，Task 9 把縮圖與輸入框清空兩件事收成一個任務，用三段行範圍（27-98、752-849、1660-1760）；縮圖的部分在 849 行以前加約 30 行，後兩段以函式名 `act`、`say` 定位而不是行號。
- `scripts/station.js`（1613 行）與 `docs/90-agent/reference/station.md`（1695 行）超過 `READ_CAP`，Task 8 只寫範圍。

- station-shell-6 / -7 還會把函式從 `station.js` 搬進新的 `FK_*` 模組（-6 加 search.js、擴 float.js；-7 刪 nav.js 的舊 live 死碼，`shellsHtml`、`icon` 留著）。focus 頁走 `mod()` 碰到的模組只要多一個，`focusShell` 就要多載一個 — Task 11 — 它的 vm 測試會丟 `station: X is not loaded` 擋住；先跑 `node --test tests/station-focus-shell-load.test.js` 再動手，並確認 `FOCUS_NEEDS` 還涵蓋 `station.js` 裡每個 `mod('FK_…', '….js')`。本計畫不改 `station.js`、`nav.js`，與 -6/-7 的範圍不重疊。
- `assets/station/mobile.js`（1899 行）、`mobile.css` 在工作樹是 CRLF — Task 13 — 用 Edit 時 `old_string` 只放單行（多行會因 `\r\n` 對不上）；行號會因 Task 13 前半加行而位移，以文字錨點為準，行號只是範圍上限。
- Task 13 的 `DG()` 在瀏覽器取 `window.FK_DIAGRAM`，這要 Task 12 先讓 `/m` 殼載入 diagram.js；Task 12 沒落地時 `diagramsHtml` 回空字串，畫面不壞但沒圖。
- 手機端 `diagrams` 取自整份報告 `text`（lib/gatereport.js:255 `read` 的 `text`），桌面 gate 頁只畫 `parts.rest`（assets/station/gate-tab.js:40-48）— Task 12 — 報告裡落在已辨認欄位內的 mermaid 圖手機會畫、桌面不畫；接受這個差異。
- `phoneModel` 在 gate 持有時每次輪詢（2 秒）多讀一次 session 檔與報告檔 — Task 12 — 只在 `gate` 非空時讀，其餘狀態不碰。另一台電腦若跑舊版 fankeel，經 peer 轉來的 phone.json 沒有 `diagrams`，手機畫面照舊無圖、不報錯。
- `tests/station-mobile-page.test.js:195` 的 class 規則檢查只涵蓋不含 diagrams 的 fixture — Task 13 — `dg-*` 的規則在 diagram.css（`/m` 殼現在載入它），新的 `gc-dg`、`gc-dgh` 由 Task 13 自己的測試擋。
- 手機上圖的觸控（單指平移、雙指縮放）和 `.cv` 的捲動（mobile.css:92 `overflow:hidden`）vm 測不到 — Task 18 — 只能真手機看；Task 18 沒做之前 station-66 只算「程式與單元測試完成」。
- Task 17、18 要一個報告裡有 ```mermaid 圖、正停在 gate 的 session；沒有就先請那個 session 在報告貼一張 flowchart — Task 17 — 它先確認頁面上有 `[data-mermaid][data-drawn]`。
- 英文介面：diagram.js 的按鈕字從 `window.FK_I18N.lang` 取 — Task 13 — `/m` 不載 i18n.js，`DG()` 每次把 `w.FK_I18N = { lang }` 設成頁面當下語言；`mobile.js` 其他處沒讀 `FK_I18N`（grep 過）。
- 新增的測試檔要 `git add` 才進得了 tests/source.test.js — Task 11、12、13。
- 本部分各 Task 不動版本號；69 是修補（patch），66 是新功能（minor），由 land 照 `scripts/version.js` 處理；三條 TODO 的關閉（`node scripts/todo.js done <id> --sha <sha>`）也在 land。

- station-65 的 CSS 與測試已在 `58ad85d0`（main 上，`fix: gate page pick buttons match the station's own (station-65)`）落地，`assets/station/gate-frame.css:55-57`、`:71` 就是判官寫的改法，`tests/station-gate-pick-style.test.js` 已存在 — Task 14 — 先用 `git show 58ad85d0 --stat` 確認，不重寫 CSS，只補改前改後截圖並等使用者確認。
- 判官那次 gate 頁渲染是空白（頁面 JS 沒畫出來），所以「很醜」是否就是這個按鈕仍未證實 — Task 14 — 截圖用 `gate-frame.js` 的 `frame()` 靜態產出的 HTML，不靠執行中的 station；若使用者說醜的是 Claude Desktop 自己的問答框，這個 TODO 只能改成「改文字」，不能算完成。
- `.fankeel/build/` 在 git ignore 下，截圖不進 repo — Task 14 — 在 TODO 內文只記路徑與 commit，不假裝附檔。
- design-guide.md 第 75、78 行（「Every multi-column block declares its narrow fallback」「Touch targets are at least 44 by 44px wherever the page can be touched」）可能讓 mockup 代理自己多畫窄版 — Task 16 — 新增的 Widths 段明說這兩條只約束 CSS，不是多畫一個畫面。
- `catalog/include.json:2511` 的 `in-ui-grid`（手機 4 欄……每個斷點都要測）種類是 `ui`，而 `agents/fankeel-mockup.md` 只叫代理取 `palette`、`type`、`app`、`direction` 四種，所以目錄本身不會讓代理預設畫手機；風險在代理自行多取 — Task 16 — 在 Widths 段把 `ui`、`ix` 兩種的斷點條目列為「沒宣告手機就不照畫」。
- `mobileDeclared` 只被測試與 `node -e` 一行呼叫，`knip.json` 可能把它報成未使用的匯出 — Task 15 — 先跑 `npx knip` 看是否真的報，報了就在 `knip.json` 的 ignore 加上它，不改成別的寫法。
- 「手機」的判斷門檻取 480 寬以下（fankeel 自己列 `412,900`）；平板寬度 768 不算手機 — Task 15 — 測試把 480 與 481 都釘住。
- 發版：本部分 Task 14 是文件、Task 15、16 動 lib 與 skill，要走一次 minor（design 行為改變）；版本與 plugin update 屬 land，不寫進 task。

### 根因（path:line）

**station-69：focus 頁整頁空白，不只「有殼」時。**

- `lib/station.js:1139-1163` `focusShell` 只載 `i18n.js`、`tip.js`、`diagram.js`、`board-edit.js`、`gate-frame.js`、`focus-page.js`、`station.js`。
- `assets/station/station.js:204-208` `mod(name, file)`：`window[name]` 不在、又沒有 `require`（瀏覽器）就丟 `station: <file> is not loaded`。
- `station.js` 靠 `mod()` 懶載入：`FMT()` :246（`family`）、`CHART()` :277（`stageNow` :301）、`NAV()` :362（`icon` :386、`shellsHtml` :394）、`DASH()` :573（`keelProgress` :582）、`DETAILH()` :743（`planNewest` :767）、`GATEV()` :868（`gateTabHtml` :870）。這六個檔案 `assets/station/index.html` 都載，focus 殼沒載。
- focus 頁畫面用到它們：`assets/station/focus-page.js:65-70` 把 `icon`、`keelProgress`、`stageNow`、`planNewest`、`gateTabHtml`、`shellsHtml` 轉給 `FK_KIT`；`focusHeader` :75 一開頭就叫 `keelProgress`。
- 實測（在沒有 `require` 的 vm 裡照 `focusShell` 清單載入）：plan 頁無殼也丟 `dash.js is not loaded`，gate 頁無殼丟 `gate-tab.js is not loaded`，兩頁有殼都丟 `nav.js is not loaded`。所以 TODO 裡「/plan 頁會不會也一樣」的答案是：會，而且不需要有殼。
- 為什麼測試沒擋：`tests/station-focus-page.test.js:127-129` 的 `focusDom` 載入 `SHELL_MODS`（index.html 的全部模組）再載 `station.js`，與真正的 `focusShell` 清單不同。來源：station-52 搬模組的提交（`9a52cdaa` nav.js、`621e1798` list-page.js 等）沒改 `focusShell`。

**station-66：手機 gate 畫面沒有圖。**

- `lib/mobile.js:286-301` `shell()` 只載 station.css、mobile.css、mobile.js，沒有 diagram.css / diagram.js。
- `lib/mobile.js:56-62` `gateOf` 與 `:236-255` `phoneModel` 的 gate 只有 `questions`、`since`、`until`，沒有報告；報告在 `lib/gatereport.js:255-286` `read(root, data).text`。
- `assets/station/mobile.js:723` `prose()` 把文字全部 `esc()`，mermaid 圍欄只是純文字；`gateCard` :810 只畫選項與「自己寫」框，沒有圖。桌面是 `assets/station/gate-tab.js:43-48` 用 `FK_DIAGRAM.fence`，`assets/station/gate-frame.js:254-256` 用 `FK_DIAGRAM.draw(root, { mark: true, onMark })`，標記行格式在 gate-frame.js:232-241（`標記：A「label」、B「label」`）。

**entry-4：第二步被 station-69 擋住。**

- `scripts/render.js:260` 的 `--act` 與 `lib/act.js:6` 的 `click/drag/type/wait/shot` 已能驅動真 gate 頁；沒有東西能在真 gate 上點 node，是因為 focus 頁根本畫不出來。Task 11 之後才能做；「hooks/gate.js 收到答案」需要人在真瀏覽器按送出，所以是 `user` 任務（Task 17）。

## Coverage

| promise | task |
|---|---|
| 階段名改成首字大寫：stem、header、Go to / Stay in / Back to 標籤 | Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7 |
| 手機對話送出的圖片顯示成路徑 | Task 8, Task 9, Task 10 |
| 手機對話送出後輸入框不清空 | Task 9 |
| gate 頁有殼時空白 | Task 11 |
| 手機 gate 頁不顯示任務圖 | Task 12, Task 13, Task 18 |
| station 圖需要真瀏覽器驗證 | Task 17 |
| gate 頁按鈕與測站一致 | Task 14 |
| design 依專案決定手機版 | Task 15, Task 16 |
| Blocked 九條條件未成立，各自重蓋今天的日期 | struck — land 跑 `todo-check.js` 時以 `todo.js` 重蓋，不佔 build 任務 |
| station 留 vanilla、拆完模組 | struck — 由既有的 2026-10-28-station-shell-6.md 與 -7.md 在本計畫之後跑 |

## Task 1: `stageWord` 與 `formatProblem` 改收首字大寫

**Files:**
- Modify: `lib/handoff.js` — 新增 `stageWord`，`STAGE_WORDS`、`formatProblem` 的 header／stem／選項一／選項二改首字大寫，匯出 `stageWord`
- Test: `tests/gate-format.test.js`
- Test: `tests/handoff.test.js`
- Test: `tests/handoff-patrol.test.js`
- Test: `tests/handoff-patrol-split.test.js`

**Interfaces:**
- Consumes: none
- Produces: `stageWord(name: string): string` 由 `lib/handoff.js` 匯出——`stageWord('survey')` 回 `'Survey'`、`stageWord('SURVEY')` 回 `'Survey'`、`stageWord('init')` 回 `'Init'`、空值回 `''`。`STAGE_WORDS` 變成 `['Survey', 'Design', 'Plan', 'Build', 'Verify', 'Audit', 'Land']`（不匯出）。

**Dispatch:** implementer, sonnet — 規則與程式碼都在計畫裡，逐字轉寫加測試。

- [ ] **Step 1: 先改測試（讓它先紅）。** 在 `tests/gate-format.test.js` 把整個檔的 stem／header／標籤換成首字大寫，並把「header 不是大寫」那條測試改成新語意，再補一條「舊全大寫形式被拒」。把第 19-23 行的測試換成：

```js
test('a header that is not the stage with a capital first letter is refused', () => {
    const bad = formatProblem(gate('盤點', 'Survey -> Plan | fankeel : x　？', 'Go to Plan', 'Stay in Survey'), 'plan', ROUTE);
    assert.equal(bad.at, 'questions[0].header');
    assert.equal(formatProblem(gate('plan', 'Plan -> Build | fankeel : x　？', 'Go to Build', 'Stay in Plan'), 'build', ROUTE).at, 'questions[0].header');
});

test('the old all-capitals form is refused at every field, so there is one format', () => {
    assert.equal(formatProblem(gate('PLAN', 'PLAN -> BUILD | fankeel : x　？', 'Go to BUILD', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].header');
    assert.equal(formatProblem(gate('Plan', 'PLAN -> BUILD | fankeel : x　？', 'Go to Build', 'Stay in Plan'), 'build', ROUTE).at, 'questions[0].question');
    assert.equal(formatProblem(gate('Plan', 'Plan -> Build | fankeel : x　？', 'Go to BUILD', 'Stay in Plan'), 'build', ROUTE).at, 'questions[0].options[0].label');
    assert.equal(formatProblem(gate('Plan', 'Plan -> Build | fankeel : x　？', 'Go to Build', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].options[1].label');
});
```

  `tests/gate-format.test.js` 其餘斷言照同樣規則換字：`gate('PLAN', 'PLAN -> BUILD | …', 'Go to BUILD (Recommended)', 'Stay in PLAN')` → `gate('Plan', 'Plan -> Build | …', 'Go to Build (Recommended)', 'Stay in Plan')`；`VERIFY`/`LAND`/`SURVEY` 同理（`LAND -> 收工` → `Land -> 收工`）；第 57-62 行的 `at` 輔助函式改成：

```js
    const at = (h, one, next) => (formatProblem(gate(h, h + ' -> Build | fankeel : x　？', one, 'Stay in ' + h), next, ROUTE) || {}).at;
    assert.equal(at('Plan', 'Go to Land', 'build'), 'questions[0].options[0].label');
    assert.equal(at('Plan', 'Back to Land', 'build'), 'questions[0].options[0].label');
    assert.equal(at('Plan', 'Back to Plan', 'build'), 'questions[0].options[0].label');
    assert.equal(at('Verify', 'Back to Build', 'land'), undefined);
    assert.equal(at('Verify', 'Back to Verify', 'land'), 'questions[0].options[0].label');
```

  並在 `tests/gate-format.test.js` 檔尾補 `stageWord` 的單元測試（同檔頂端 `require` 改成 `const { formatProblem, stageWord } = require('../lib/handoff.js');`）：

```js
test('stageWord keeps the first letter capital and the rest lower', () => {
    assert.equal(stageWord('survey'), 'Survey');
    assert.equal(stageWord('SURVEY'), 'Survey');
    assert.equal(stageWord('init'), 'Init');
    assert.equal(stageWord(''), '');
    assert.equal(stageWord(null), '');
});
```

- [ ] **Step 2: 同樣改 `tests/handoff.test.js`、`tests/handoff-patrol.test.js`、`tests/handoff-patrol-split.test.js`。** `tests/handoff.test.js` 第 1-20 行的 `formatted` 輔助函式改成呼叫 `stageWord`（頂端把 `stageWord` 加進從 lib/handoff.js 解構的名單），在 `tests/handoff.test.js` 寫成：

```js
const formatted = (g, from, to) => {
  Object.assign(g.questions[0], { header: stageWord(from), question: stageWord(from) + ' -> ' + stageWord(to) + ' | fankeel : t　？' });
  g.questions[0].options[1].label = 'Stay in ' + stageWord(from);
  return g;
};
```

  呼叫處 `formatted(gateOf('v'), 'VERIFY', 'AUDIT')` 保持傳什麼都行（`stageWord` 會正規化）。第 129、139、149、488-489、511-512、519 行的選項標籤換成 `Go to Audit`、`Back to Build`、`Go to Design`、`Stay in Survey — 改走 bounded`、`Go to Verify`、`Stay in Build — 暫停`、`Back to Build`。`tests/handoff-patrol.test.js:11`、`tests/handoff-patrol-split.test.js:16,61-62` 的 `GATE` 與 `questions` 內 `header: 'SURVEY'`→`'Survey'`、`'SURVEY -> PLAN |'`→`'Survey -> Plan |'`、`Go to PLAN (Recommended)`→`Go to Plan (Recommended)`、`Stay in SURVEY`→`Stay in Survey`。

- [ ] **Step 3: 跑四個測試檔，確認紅。** 命令（不是 code）：

```sh
node --test tests/gate-format.test.js tests/handoff.test.js tests/handoff-patrol.test.js tests/handoff-patrol-split.test.js
```

  預期：失敗，原因是 `formatProblem` 仍只收大寫、`stageWord` 不存在。

- [ ] **Step 4: 實作。** 在 `lib/handoff.js`，把 262-296 行（`// gate-19 …` 註解到 `formatProblem` 結尾）換成下面這段。`STAGE_WORDS` 由 `stageWord` 產生，是 header、stem、選項標籤唯一的來源：

```js
// gate-19 (docs/90-agent/todo/gate-19.md): a stage gate reads the same at every
// stage — the finished stage as the header with only its first letter capital,
// the move and the task at the head of the question, and a verb on the first
// two options. Only the first question: a patrol's per-entry questions after it
// keep their own. The all-capitals form was retired on 2026-10-30; it is refused
// so there is one format.
const stageWord = (name) => {
    const s = String(name || '');
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};
const STAGE_WORDS = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'].map(stageWord);
const WRAP_UP = 'Wrap up — 收工';

function formatProblem(gate, next, route) {
    const q = gate.questions[0];
    const at = 'questions[0].';
    const header = String(q.header || '').trim();
    if (!STAGE_WORDS.includes(header)) {
        return { at: at + 'header', detail: 'header "' + q.header + '" is not the finished stage with only its first letter capital — one of ' + STAGE_WORDS.join(', ') };
    }
    const m = /^([A-Z][a-z]+) -> ([A-Z][a-z]+|收工) \| [^:]+ : \S/.exec(String(q.question || ''));
    if (!m || m[1] !== header) {
        return { at: at + 'question', detail: 'question must open "' + header + ' -> <Next> | <project> : <task>"' };
    }
    // A gate the main session typed comes here unchecked for shape (hooks/gate.js),
    // where a throw is caught and lets the gate out.
    const options = Array.isArray(q.options) ? q.options : [];
    const label = String((options[0] && options[0].label) || '');
    const stages = Array.isArray(route) ? route.map(stageWord) : [];
    const earlier = stages.slice(0, Math.max(stages.indexOf(header), 0));
    const forward = next === null ? label.startsWith(WRAP_UP) : label.startsWith('Go to ' + stageWord(next));
    const one = forward || earlier.some((s) => label.startsWith('Back to ' + s));
    if (!one) {
        return { at: at + 'options[0].label', detail: 'option one "' + label + '" must read "' + (next ? 'Go to ' + stageWord(next) : WRAP_UP) + '" or "Back to <a stage earlier than ' + header + '>"' };
    }
    const two = String((options[1] && options[1].label) || '');
    if (!/^(Stay in|Back to) [A-Z][a-z]+\b/.test(two)) {
        return { at: at + 'options[1].label', detail: 'option two "' + two + '" must open "Stay in <Stage>" or "Back to <Stage>"' };
    }
    return null;
}
```

  第 247-261 行（`PAUSE`、`CLASS_ORDER`、`MIN_FIRST_OPTIONS`）原樣保留，只換掉 262 行起的段落。

- [ ] **Step 5: 匯出。** 在 `lib/handoff.js` 第 878 行 `module.exports` 的 `formatProblem,` 之後加 `stageWord,`：

```js
module.exports = { tailEntries, checkoutFor, withCheckout, baseFor, dirFor, handoffPath, commitPath, answerPath, contextPath, relayPath, pendingPath, readPending, answersSince, answeredOf, handedOffSince, ledgerCommitPath, readGate, isPatrol, patrolEntries, patrolProblem, reportProblem, formatProblem, stageWord, skipReason, gateMatches, answersGate, writeAnswer, lapOf, lapsUsed, readsOf, workflowOf, previousHandoff, width, awaitState, awaitHandoff, newestCommit, pendingTool, owesReply, launched, caseOfPrompt, promptOf, liveMarks };
```

- [ ] **Step 6: 再跑四個測試檔，確認綠。**

```sh
node --test tests/gate-format.test.js tests/handoff.test.js tests/handoff-patrol.test.js tests/handoff-patrol-split.test.js
```

- [ ] **Step 7: 提交。** `git add lib/handoff.js tests/gate-format.test.js tests/handoff.test.js tests/handoff-patrol.test.js tests/handoff-patrol-split.test.js`，訊息 `feat: gate stage names take only a first capital (stageWord)`。

## Task 2: 規則句與 brief 的 gate 文字改首字大寫

**Files:**
- Modify: `lib/stages.js:120-130` — `ALWAYS[0]`（125 行）的 header／stem／標籤模板
- Modify: `lib/render.js:21-623` — 21 行的解構加 `stageWord`，623 行 survey brief 的 gate 說明改呼叫它
- Modify: `docs/02-architecture/pipeline.md:120-210` — 122、207 行兩份規則範例同步
- Read: `lib/handoff.js` — `stageWord` 的定義與匯出（Task 1 產出）
- Test: `tests/stages.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: `stageWord(name: string): string` from `lib/handoff.js`（Task 1）
- Produces: `ALWAYS[0]` 的新句子，含 `` Header: `This`; stem `This -> Next | project : task` `` 與 `` Label: `Stay in This` ``

**Dispatch:** implementer, sonnet — 兩處字串替換加兩條斷言，程式碼在計畫裡。

- [ ] **Step 1: 先改測試。** `tests/stages.test.js` 第 261-268 行那條測試換成：

```js
test('the always-on block carries the gate-19 format', () => {
  const all = ALWAYS.join(' ');
  assert.match(all, /Header: `This`; stem/);
  assert.match(all, /This -> Next \| project : task/);
  assert.match(all, /`Go to` it/);
  assert.match(all, /Wrap up — 收工/);
  // lib/handoff.js formatProblem refuses a gate whose option two does not open
  // "Stay in <Stage>" or "Back to <Stage>"; without this the first a model hears
  // of it is the refusal.
  assert.match(ALWAYS[0], /Option two names the open decision, or none — never unfinished work\. Label: `Stay in This`./);
  assert.match(ALWAYS[0], /first letter capital/);
});
```

  （保留該測試原有的函式頭部與其他斷言位置，只改上面這幾行；`tests/stages.test.js` 其餘地方不在本 task 範圍，1080 行留給 Task 3。）`tests/brief.test.js` 第 702-703 行改成：

```js
  assert.match(text, /option one's label names `design`: `Go to Design`/);
  assert.match(text, /option two `Stay in Survey` \(or `Back to <Stage>`\)/);
```

- [ ] **Step 2: 跑，確認紅。**

```sh
node --test tests/stages.test.js tests/brief.test.js
```

- [ ] **Step 3: 改 `lib/stages.js` 125 行。** 整行換成：

```js
    'Never end a stage silently or in prose. Ask with AskUserQuestion, three at least, never dropping the pause. Header: `This`; stem `This -> Next | project : task` — stage names take only their first letter capital (`Survey`, `Plan`, not `SURVEY`). Option one is the approval: {{NEXT}} — `Go to` it, or `Wrap up — 收工`; mark your pick `(Recommended)` rather than moving it. Option two names the open decision, or none — never unfinished work. Label: `Stay in This`.',
```

  `{{NEXT}}` 替換結果（`substitute` 填的是 route 上下一站名）若在 `lib/stages.js` 內是小寫 `verify`，保持原狀：那是給模型讀的名字，檢查器用 `stageWord(next)` 比對，模型照 `Go to` 加首字大寫寫即可；同一行已用 `first letter capital` 教了。

- [ ] **Step 4: 改 `lib/render.js`。** 頂端 21 行的解構加入 `stageWord`：

```js
const { handoffPath, commitPath, answerPath, contextPath, readsOf, previousHandoff, answeredOf, liveMarks, baseFor, stageWord } = require('./handoff.js');
```

  在 `lib/render.js` 的 623 行把 `'names \`' + next + '\`: \`Go to ' + next.toUpperCase() + '\`'` 換成 `stageWord(next)`，把 `' + stage.toUpperCase() + '` 換成 `stageWord(stage)`，並把 `(or \`Back to <STAGE>\`)` 換成 `(or \`Back to <Stage>\`)`。換完的片段是：

```js
(next ? 'names `' + next + '`: `Go to ' + stageWord(next) + '`' : 'is `Wrap up — 收工`') + ', option two `Stay in ' + stageWord(stage) + '` (or `Back to <Stage>`); one option\'s label says `暫停` (or `pause`), no option names a class lighter than the task\'s floor, and `next` is never empty.
```

  623 行其餘文字（`header` 12 欄那段、`Write` 與 `gate-check.js` 那段）逐字不動。

- [ ] **Step 5: 改 `docs/02-architecture/pipeline.md` 122、207 行。** 兩行都是 `ALWAYS[0]` 的展開結果，把 `` Header: `THIS`; stem `THIS -> NEXT | project : task` `` 換成 `` Header: `This`; stem `This -> Next | project : task` — stage names take only their first letter capital (`Survey`, `Plan`, not `SURVEY`) ``，`` Label: `Stay in THIS` `` 換成 `` Label: `Stay in This` ``。該頁的程式碼區塊以外的行不動。

- [ ] **Step 6: 再跑，確認綠。**

```sh
node --test tests/stages.test.js tests/brief.test.js
```

  注意：`tests/stages.test.js:1080` 要等 Task 3 才會綠，這一步只看 261-268 那條與 `brief.test.js`。

- [ ] **Step 7: 提交。** 訊息 `feat: stage rule and brief teach first-capital gate names`。

## Task 3: 技能與 agent 文字改首字大寫

**Files:**
- Modify: `skills/fankeel/SKILL.md:362-370` — 365-368 行 gate 表格
- Modify: `skills/fankeel-land/SKILL.md:265-272` — 267-269 行
- Modify: `agents/fankeel-brain.md:216-228` — 219-225 行
- Test: `tests/stages.test.js`
- Test: `tests/gate-capitals-text.test.js`

**Interfaces:**
- Consumes: none（文字須與 Task 1 的 `formatProblem` 一致：`Land -> 收工`、`Stay in Land`）
- Produces: none

**Dispatch:** implementer, sonnet — 純文字替換，每處新文字都在計畫裡。

- [ ] **Step 1: 寫新測試檔。** 新建 `tests/gate-capitals-text.test.js`，鎖住「文字教的是新格式」：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\s+/g, ' ');

test('the gate table teaches the first-capital form, not capitals', () => {
    const skill = read('skills', 'fankeel', 'SKILL.md');
    assert.match(skill, /the finished stage with only its first letter capital — `Plan`/);
    assert.match(skill, /`Go to <Next>` — the next stage with only its first letter capital/);
    assert.match(skill, /`THIS -> NEXT \\\| project : task`|`This -> Next \\\| project : task`/);
    assert.doesNotMatch(skill, /in capitals/);
});

test('the land skill and the brain agent name the new form', () => {
    const land = read('skills', 'fankeel-land', 'SKILL.md');
    assert.match(land, /Header `Land`, question opens `Land -> 收工 \| <project> : <task>`/);
    assert.match(land, /2\. `Stay in Land`/);
    const brain = read('agents', 'fankeel-brain.md');
    assert.match(brain, /the first header the stage with only its first letter capital/);
    assert.match(brain, /`Go to <Next>`/);
    assert.match(brain, /`Stay in <Stage>`/);
    assert.doesNotMatch(brain, /in capitals/);
});
```

- [ ] **Step 2: 改 `tests/stages.test.js` 第 1080 行。** 這個 regex 鎖 land 技能的選項順序，換成新形式：

```js
  assert.match(land, /1\. `Wrap up — 收工 \(Recommended\)`.*2\. `Stay in Land`.*3\. `匯出並回顧`.*4\. `暫停`/);
```

- [ ] **Step 3: 跑，確認紅。**

```sh
node --test tests/gate-capitals-text.test.js tests/stages.test.js
```

- [ ] **Step 4: 改 `skills/fankeel/SKILL.md` 365-367 行。** 三格各換成（表格其他欄與 368 行以下原樣）。header 列：

```md
| header | the finished stage with only its first letter capital — `Plan` | 12 columns, CJK counts two |
| question | `This -> Next \| project : task`, then the decision only (`Init -> Survey`, `Land -> 收工`) | ~40 characters after it, 20 if CJK |
```

  第 367 行 option 1 列的開頭換成 `` `Go to <Next>` — the next stage with only its first letter capital, `Back to <Stage>` sending work back, or `Wrap up — 收工` at the route's end. `` ，之後從 `**Its description is where the approval happens**` 起逐字保留；368 行 option 2 列的 `` `Stay in <STAGE>` or `Back to <STAGE>` `` 換成 `` `Stay in <Stage>` or `Back to <Stage>` ``。

- [ ] **Step 5: 改 `skills/fankeel-land/SKILL.md` 267-269 行。**

```md
1. `Wrap up — 收工 (Recommended)` — stands the task down; its description
   names the month file and anchor. Header `Land`, question opens
   `Land -> 收工 | <project> : <task>` (`formatProblem`).
2. `Stay in Land` — option two as every gate has it.
```

- [ ] **Step 6: 改 `agents/fankeel-brain.md` 219-225 行。**

```md
check `hooks/gate.js` runs when the controller asks it — three options at
least on the first question, every header 12 columns at most with a CJK
character counting two, the gate-19 format — the first header the stage with only its first letter capital,
its question opening `<Stage> -> <Next> | <project> : <task>`,
option one `Go to <Next>` (on the last stage `Wrap up — 收工`) or
`Back to <Stage>` on this route, option two `Stay in <Stage>` or
`Back to <Stage>` — a pause, no TODO entry named by its id
```

  `agents/fankeel-brain.md` 其餘行不動。

- [ ] **Step 7: 再跑，確認綠；再用 `node scripts/docs-check.js` 看文件檢查沒新增發現。**

```sh
node --test tests/gate-capitals-text.test.js tests/stages.test.js tests/docs-audit.test.js
```

- [ ] **Step 8: 提交。** 訊息 `docs: skill and agent text teach first-capital gate names`。

## Task 4: gate hook 測試的 gate 改首字大寫（一）

**Files:**
- Modify: `tests/gate.test.js`
- Modify: `tests/gate-notify.test.js`
- Modify: `tests/drive.test.js`
- Read: `lib/handoff.js` — `stageWord` 的簽名（Task 1 產出）

**Interfaces:**
- Consumes: `stageWord(name: string): string` from `lib/handoff.js`（Task 1）
- Produces: none

**Dispatch:** implementer, sonnet — 機械式字串替換，每一處的新形式都在計畫裡。

- [ ] **Step 1: 先看紅。** 在 Task 1 完成後執行：

```sh
node --test tests/gate.test.js tests/gate-notify.test.js tests/drive.test.js
```

  預期：凡是經過 `formatProblem` 的 gate 都失敗（`header "SURVEY" is not the finished stage with only its first letter capital`）。

- [ ] **Step 2: `tests/gate.test.js`。** 把每一個 gate 的 `question` 開頭、`header` 與選項標籤換成首字大寫：`SURVEY -> DESIGN | fankeel :` → `Survey -> Design | fankeel :`、`header: 'SURVEY'` → `header: 'Survey'`、`Go to DESIGN` → `Go to Design`、`Stay in SURVEY` → `Stay in Survey`；同理處理第 129、311、313-329（`verifyGate(root, 'Back to Build')`、`'Back to Design'`）、563、613（`Go to Land：收尾 (Recommended)`、`Back to Build：補測試`）、718、723、734、759、802-808、829、892-893 行。第 892-893 行那段改成：

```js
  header: 'Design', question: q.question.replace('Survey -> Design', 'Design -> Plan'),
  options: [Object.assign({}, q.options[0], { label: 'Go to Plan' }), Object.assign({}, q.options[1], { label: 'Stay in Design' }), ...q.options.slice(2)],
```

  `Stay in Survey，改走 bounded`（723 行）→ `Stay in Survey，改走 bounded`（只改前半）。在 `tests/gate.test.js` 補一條測試證明舊形式被 hook 擋下，放在檔內第一個 `formatProblem` 相關測試之後：

```js
test('a gate typed in the old all-capitals form is refused with the new form named', () => {
  const old = [{ question: 'SURVEY -> DESIGN | fankeel : t　survey 的結論？', header: 'SURVEY', multiSelect: false, options: [{ label: 'Go to DESIGN', description: 'a' }, { label: 'Stay in SURVEY', description: 'b' }, { label: '暫停', description: 'c' }] }];
  assert.match(JSON.stringify(old), /SURVEY/);
  const { formatProblem } = require('../lib/handoff.js');
  const bad = formatProblem({ questions: old }, 'design', ['survey', 'design']);
  assert.equal(bad.at, 'questions[0].header');
  assert.match(bad.detail, /first letter capital/);
});
```

- [ ] **Step 3: `tests/gate-notify.test.js` 25-27、117 行。**

```js
    { header: 'Design', question: 'Design -> Plan | fankeel : 設計可以進 plan 嗎？', multiSelect: false, options: [
        { label: 'Go to Plan', description: '照這份設計寫計畫' },
        { label: 'Stay in Design', description: '先改再問' },
```

  117 行的 `'Stay in DESIGN'` → `'Stay in Design'`。第二題 `header: 'design'` 不是第一題，保持不動。

- [ ] **Step 4: `tests/drive.test.js` 16-25 行。** 輔助函式改用 `stageWord`，頂端加 `const { stageWord } = require('../lib/handoff.js');`：

```js
    const STAGE = stageWord(stage);
    // ...
            question: `${STAGE} -> ${nextStage ? stageWord(nextStage) : '收工'} | fankeel : drive test`,
            // ...
                { label: nextStage ? `Go to ${stageWord(nextStage)}` : 'Wrap up — 收工', description: '進下一站。' },
```

  `header` 欄位若引用 `STAGE`，隨之成為 `Survey` 之類。其餘行不動。

- [ ] **Step 5: 跑，確認綠。**

```sh
node --test tests/gate.test.js tests/gate-notify.test.js tests/drive.test.js
```

- [ ] **Step 6: 提交。** 訊息 `test: gate hook fixtures use first-capital stage names (1/4)`。

## Task 5: gate-check 測試的 gate 改首字大寫（二）

**Files:**
- Modify: `tests/gate-check.test.js`
- Modify: `tests/gate-check-patrol.test.js`
- Modify: `tests/gate-check-review.test.js`

**Interfaces:**
- Consumes: none（行為由 Task 1 的 `formatProblem` 決定）
- Produces: none

**Dispatch:** implementer, sonnet — 機械式字串替換。

- [ ] **Step 1: 先看紅。**

```sh
node --test tests/gate-check.test.js tests/gate-check-patrol.test.js tests/gate-check-review.test.js
```

- [ ] **Step 2: `tests/gate-check.test.js`。** 第 36、42、49、65、72、79、87、100、112、115、122 行的選項標籤陣列首字大寫，例如：

```js
    const out = main(['--session', SESSION, '--root', root, handoff(root, ['Go to Build (Recommended)', 'Stay in Plan', '暫停'])]);
```

  49 行：`['結束任務', 'Stay in Land', '暫停'], 'Land', '收工'`。100 行：`'Stay in Plan。' + '這'.repeat(81)`。112、115 行：`'Go to Build：做 cleanup-2 (Recommended)'`、`'Go to Build：刪掉重複的讀檔函式 (Recommended)'`。該檔內 `handoff(root, labels, header, next)` 輔助函式若自行用 `toUpperCase()` 組 `header`／stem，改成呼叫 lib/handoff.js 匯出的 stageWord（在 `tests/gate-check.test.js` 頂端 require 進來）。

- [ ] **Step 3: `tests/gate-check-patrol.test.js:13`。**

```js
const GATE = { questions: [{ header: 'Survey', question: 'Survey -> Plan | fankeel : TODO 全表盤點　plan?', multiSelect: false, options: [{ label: 'Go to Plan', description: 'a' }, { label: 'Stay in Survey', description: 'b' }, { label: '暫停', description: 'c' }] }] };
```

  （該行原本尾端若有其他欄位，逐字保留，只換上面的字。）

- [ ] **Step 4: `tests/gate-check-review.test.js` 17、67 行。**

```js
const LABELS = ['Go to Land (Recommended)', 'Stay in Verify', '暫停'];
```

  同一個 `tests/gate-check-review.test.js` 的 67 行：

```js
    const questions = [{ header: 'Plan', question: 'Plan -> Build | fankeel : t　要進下一站嗎？', options: ['Go to Build (Recommended)', 'Stay in Plan', '暫停'].map((label) => ({ label, description: 'd' })) }];
```

  該檔建 stem 的輔助函式（若有 `'VERIFY ->'`）同樣換 `Verify ->`。

- [ ] **Step 5: 跑，確認綠。**

```sh
node --test tests/gate-check.test.js tests/gate-check-patrol.test.js tests/gate-check-review.test.js
```

- [ ] **Step 6: 提交。** 訊息 `test: gate-check fixtures use first-capital stage names (2/4)`。

## Task 6: gate-write 測試的 gate 改首字大寫（三）

**Files:**
- Modify: `tests/gate-write.test.js`
- Modify: `tests/gate-write-ids.test.js`
- Modify: `tests/gate-write-patrol.test.js`

**Interfaces:**
- Consumes: `stageWord(name: string): string` from `lib/handoff.js`（Task 1；只有 `gate-write.test.js` 的 `gateBlock` 用到）
- Produces: none

**Dispatch:** implementer, sonnet — 機械式字串替換。

- [ ] **Step 1: 先看紅。**

```sh
node --test tests/gate-write.test.js tests/gate-write-ids.test.js tests/gate-write-patrol.test.js
```

- [ ] **Step 2: `tests/gate-write.test.js`。** 第 56 行與 75 行的標籤換字；`gateBlock` 內 `const STAGE = stage.toUpperCase();` 換成 `stageWord`（頂端加 `const { stageWord } = require('../lib/handoff.js');`）：

```js
  options: [{ label: 'Go to Design', description: 'a' }, { label: 'Stay in Survey', description: 'b' }, { label: '暫停', description: 'c' }],
```

  `gateBlock` 內的 `STAGE`，同在 `tests/gate-write.test.js`：

```js
    const STAGE = stageWord(stage);
```

  `gateBlock` 內原本用 `nextStage.toUpperCase()` 的地方同樣改 `stageWord(nextStage)`；75 行 `gateBlock('Go to DESIGN')` → `gateBlock('Go to Design')`。

- [ ] **Step 3: `tests/gate-write-patrol.test.js:15`。**

```js
const GATE = { questions: [{ header: 'Survey', question: 'Survey -> Plan | fankeel : t　plan?', multiSelect: false, options: [{ label: 'Go to Plan', description: 'a' }, { label: 'Stay in Survey', description: 'b' }, { label:
```

  該行 `label:` 之後的內容逐字保留。

- [ ] **Step 4: `tests/gate-write-ids.test.js:31-32`。**

```js
  const gate = { questions: [{ header: 'Survey', question: 'Survey -> Plan | fankeel : t　' + question(entry), multiSelect: false,
    options: [{ label: 'Go to Plan (Recommended)', description: 'a' }, { label: 'Stay in Survey', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };
```

- [ ] **Step 5: 跑，確認綠。**

```sh
node --test tests/gate-write.test.js tests/gate-write-ids.test.js tests/gate-write-patrol.test.js
```

- [ ] **Step 6: 提交。** 訊息 `test: gate-write fixtures use first-capital stage names (3/4)`。

## Task 7: patrol 與 resume 測試的 gate 改首字大寫（四）

**Files:**
- Modify: `tests/gate-patrol.test.js`
- Modify: `tests/resume.test.js`
- Modify: `tests/resume-board-changes.test.js`

**Interfaces:**
- Consumes: none（行為由 Task 1 的 `formatProblem` 決定）
- Produces: none

**Dispatch:** implementer, sonnet — 機械式字串替換。

- [ ] **Step 1: 先看紅。**

```sh
node --test tests/gate-patrol.test.js tests/resume.test.js tests/resume-board-changes.test.js
```

- [ ] **Step 2: `tests/gate-patrol.test.js` 20-21 行。**

```js
const QUESTIONS = [{ header: 'Survey', question: 'Survey -> Plan | fankeel : t　plan?', multiSelect: false, options: [
  { label: 'Go to Plan (Recommended)', description: 'a' }, { label: 'Stay in Survey', description: 'b' }, { label: '暫停', description: 'c' }] }];
```

- [ ] **Step 3: `tests/resume.test.js:335`。**

```js
const GATE_QUESTIONS = [{ question: 'Survey -> Design | fankeel : t　survey 的結論可以進 design 嗎？', header: 'Survey', multiSelect: false, options: [{ label: 'Go to Design', description: 'a' }, { label: 'Stay in Survey', des
```

  該行 `des` 之後逐字保留。

- [ ] **Step 4: `tests/resume-board-changes.test.js:28`。**

```js
const GATE = [{ question: 'Survey -> Design | fankeel : t　可以進 design 嗎？', header: 'Survey', multiSelect: false, options: [{ label: 'Go to Design (Recommended)', description: 'a' }, { label: 'Stay in Survey', de
```

  該行 `de` 之後逐字保留。

- [ ] **Step 5: 跑，確認綠。然後跑快速全套件確認整個 part 閉環。**

```sh
node --test tests/gate-patrol.test.js tests/resume.test.js tests/resume-board-changes.test.js
node scripts/suite.js --fast
```

- [ ] **Step 6: 提交。** 訊息 `test: patrol and resume fixtures use first-capital stage names (4/4)`。

## Task 8: GET /phone/img 把上傳的照片送回給自己的對話

station-67 的未知數已查：沒有任何路由把 uploads 送回來。證據：`scripts/station.js:1074` 只有 `POST /phone/upload`，檔案寫到 `scripts/station.js:1104` 的 `<phone dir>/uploads/<ms>-<6 hex>.<ext>` 後只回路徑；`scripts/station.js:79` 的 `STATIC` 只服務 `SERVED` 清單裡的 `assets/station/` 檔案（`scripts/station.js:1132-1136`）；`lib/remote.js:56-61` 沒有 `/phone/img`。所以要新增一條路由，縮圖才有地方載。

**Files:**
- Modify: `scripts/station.js:1068-1075` — 在 `POST /phone/upload` 之前加 `GET /phone/img`
- Modify: `docs/90-agent/reference/station.md:1477-1486` — `/phone/upload` 段落加一句 `GET /phone/img` 與縮圖
- Read: `lib/phone.js` — `dirOf(root, sid)` 回 `<state>/station/phone/<sid>`，查不到 session 回 null
- Read: `lib/remote.js` — `policy()` 對 GET `/phone/img` 回預設 `device`
- Read: `tests/station-phone.test.js` — `fixture()`、`fakeTailscale()`、`start()` 的寫法，複製進新測試
- Test: `tests/station-phone-img.test.js`

**Interfaces:**
- Consumes: `phone.dirOf(root, sid)`（`scripts/station.js:66` 已 require `lib/phone.js`）、`modelNow()`、`send()`、`fail()`（都在同一個 handler 內）
- Produces: `GET /phone/img?root=<abs root>&id=<session id>&name=<file name>` → 200、`content-type: image/<ext>`、body 為檔案位元組；404 `no such photo on this station`。Task 9 的 `<img src>` 用這個網址形狀。

**Dispatch:** implementer, sonnet — 路由與測試的程式碼都在計畫裡，照抄加測試。

- [ ] **Step 1: 先寫失敗的測試。** 建立 `tests/station-phone-img.test.js`：

```js
'use strict';
// GET /phone/img (docs/90-agent/todo/station-67.md): the photo the phone uploaded, served back to the
// session it belongs to. The name is only ever the saved file's own shape, so nothing outside
// <phone dir>/uploads can be asked for. `tailscaleRun` is faked: no test runs the real tailscale.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const remote = require('../lib/remote.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'station.example.invalid';
const SID = 'ffffffff-9999-4999-8999-000000000001';
const TAILNET = { host: NAME, origin: 'https://' + NAME };

function fixture() {
    const base = tmp('fankeel-station-img-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    registry.writeSession(r1, SID, { task: 't', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: '2026-10-22T08:00:00.000Z', updated: new Date().toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({ pid: process.pid, sessionId: SID, cwd: r1, startedAt: Date.now() }));
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(r1)]: '2026-10-22T08:00:00.000Z' }) + '\n');
    fs.writeFileSync(profile.machineFile(cfg), JSON.stringify({ 'station.remote': true }) + '\n');
    const now = Date.now();
    const paired = remote.pair(cfg, remote.newCode(cfg, now).value, 'S24', now);
    return { cfg, r1, cookie: 'fk_device=' + paired.token };
}

function fakeTailscale() {
    let config = {};
    const run = (args) => {
        if (args[0] === 'status') return { status: 0, stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (args[0] === 'serve' && args[1] === 'status') return { status: 0, stdout: JSON.stringify(config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') {
            config = { TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + args[2] } } } } };
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + args.join(' ') };
    };
    return { run };
}

// Bytes, not text: the body is a picture.
const request = (url, o) => new Promise((resolve, reject) => {
    const opts = o || {};
    const post = opts.body !== undefined;
    const req = http.request(url, { method: post ? 'POST' : 'GET', headers: opts.headers || {} }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', reject);
    if (post) req.write(opts.body);
    req.end();
});
const was = process.cwd();
test.after(() => process.chdir(was));
const start = (f, ts) => (process.chdir(path.dirname(f.cfg)), serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false, tailscaleRun: ts.run }));

test('GET /phone/img answers the uploaded photo to a paired phone, and refuses everything that is not a saved photo of that session', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    const as = Object.assign({ cookie: f.cookie }, TAILNET);
    const q = (name, id) => '?root=' + encodeURIComponent(f.r1) + '&id=' + (id || SID) + '&name=' + encodeURIComponent(name);
    try {
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
        const up = await request(s.url + 'phone/upload?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&ext=png', { headers: Object.assign({ 'content-type': 'image/png' }, as), body: png });
        assert.equal(up.status, 201);
        const name = path.basename(up.body.toString().trim());
        assert.equal((await request(s.url + 'phone/img' + q(name), { headers: TAILNET })).status, 401, 'an unpaired phone');
        const ok = await request(s.url + 'phone/img' + q(name), { headers: as });
        assert.equal(ok.status, 200);
        assert.equal(ok.headers['content-type'], 'image/png');
        assert.deepEqual(ok.body, png);
        for (const bad of ['../../../registry.json', '..%2Fx.png', 'a.txt', '1-abc123.svg', '123-abc12.png', '123-ABCDEF.png', '999-abcdef.png', '']) {
            assert.equal((await request(s.url + 'phone/img' + q(bad), { headers: as })).status, 404, bad);
        }
        assert.equal((await request(s.url + 'phone/img' + q(name, 'nope'), { headers: as })).status, 404, 'another session');
        assert.equal((await request(s.url + 'phone/img?root=' + encodeURIComponent(path.join(f.r1, '..')) + '&id=' + SID + '&name=' + name, { headers: as })).status, 404, 'another root');
    } finally {
        s.close();
    }
});

test('GET /phone/img on this machine needs no nonce, like phone.json', async () => {
    const f = fixture();
    const s = await start(f, fakeTailscale());
    try {
        const gif = Buffer.from('GIF89a\u0001\u0002', 'latin1');
        const up = await request(s.url + 'phone/upload?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&ext=gif', { headers: Object.assign({ 'content-type': 'image/gif' }, { cookie: f.cookie }, TAILNET), body: gif });
        assert.equal(up.status, 201);
        const name = path.basename(up.body.toString().trim());
        const r = await request(s.url + 'phone/img?root=' + encodeURIComponent(f.r1) + '&id=' + SID + '&name=' + name);
        assert.equal(r.status, 200);
        assert.equal(r.headers['content-type'], 'image/gif');
    } finally {
        s.close();
    }
});
```

- [ ] **Step 2: 跑測試，確認失敗。**

```sh
node --test tests/station-phone-img.test.js
```

預期：兩個測試都失敗（`/phone/img` 目前落到 404 以外的路徑，狀態碼不是 200）。

- [ ] **Step 3: 加路由。** 在 `scripts/station.js` 的 `A photo from the phone's answer box` 註解之前（`:1071` 附近，`phone.json` 那個 `return send(200, 'application/json', ...)` 的右大括號之後）加入：

```js
        // The photo a phone message carried, back to the bubble that shows it (station-67). The name
        // is only the shape /phone/upload saves under, and the directory is the session's own, so
        // nothing outside <phone dir>/uploads can be asked for.
        if (req.method === 'GET' && url.pathname === '/phone/img') {
            const reg = modelNow().registries.find((r) => r.root === path.resolve(url.searchParams.get('root') || ''));
            const id = url.searchParams.get('id') || '';
            const name = url.searchParams.get('name') || '';
            const dir = reg && reg.sessions.find((x) => x.sessionId === id) ? phone.dirOf(reg.root, id) : null;
            const kind = /^\d+-[0-9a-f]{6}\.(png|jpeg|gif|webp)$/.exec(name);
            if (!dir || !kind) return fail(404, 'no such photo on this station');
            let bytes;
            try {
                bytes = fs.readFileSync(path.join(dir, 'uploads', name));
            } catch (e) {
                return fail(404, 'no such photo on this station');
            }
            return send(200, 'image/' + kind[1], bytes, { 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' });
        }
```

- [ ] **Step 4: 跑測試，確認通過，再跑相鄰的測試。**

```sh
node --test tests/station-phone-img.test.js tests/station-phone.test.js tests/remote.test.js
```

- [ ] **Step 5: 補文件。** 在 `docs/90-agent/reference/station.md` 的 `/phone/upload` 段落（`:1477-1486`）、`image, another type, or bytes that do not match the type.` 之後插入一句：

```md
`GET /phone/img?root=&id=&name=` answers a saved photo back to the page that sent it: `name` must be the saved file's own shape (`<ms>-<6 hex>.<png|jpeg|gif|webp>`), the directory is the session's `uploads/`, and anything else — another session, a path, an unknown name — is 404 `no such photo on this station`; a paired phone's cookie is needed through the tailnet (`remote.policy` default), none on this machine. The conversation draws each `[圖片] <path>` line of a phone message as a thumbnail from this route instead of the path.
```

- [ ] **Step 6: 暫存新測試並提交。**

```sh
git add tests/station-phone-img.test.js scripts/station.js docs/90-agent/reference/station.md
git commit -m "feat: GET /phone/img serves an uploaded photo back to its session (station-67)"
```

## Task 9: 手機氣泡把 `[圖片]` 行畫成縮圖，送出後輸入框立刻清空

**Files:**
- Modify: `assets/station/mobile.js:27-98` — 中英字典加 `chat.shot`（27、98 行）
- Modify: `assets/station/mobile.js:752-849` — `bubble()` 分出縮圖，`cvInner()` 把 `{ root, id }` 傳進去
- Modify: `assets/station/mobile.js:1660-1760` — `act()` 加 `undo`、`say()` 先清後送（前半在 849 行以前加了約 30 行，以函式名 `act`、`say` 定位而不是行號）
- Read: `tests/station-mobile-page.test.js` — `sess()`、`HOME`、`APP`、`P.screen(...)`、`boot()`、`composerForm`、`submit`、`routed`、`settle` 的寫法，複製進新測試
- Test: `tests/station-mobile-shots.test.js`
- Test: `tests/station-mobile-say-clear.test.js`

**Interfaces:**
- Consumes: Task 8 的 `GET /phone/img?root=&id=&name=`（只用網址字串形狀）；`st.ui.draft`、`strip()`、`drop()`、`post()`、`talking()`、`loadChat()`（都在 `mobile.js` 的同一個 boot 閉包）
- Produces: 手機氣泡裡 `<span class="shots"><img class="shot" ...></span>`；Task 10 的 CSS 用 `.shots`、`.shot` 兩個 class。`bubble(role, text, at, sent, fold, img)` 的第六個參數 `img` 是 `{ root, id }`，不給就維持原樣（全部走 `esc(text)`）。`act(url, fields, done, undo)`——第四個參數可省略，省略時行為與原本相同

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡，是轉錄加測試。

- [ ] **Step 1: 先寫失敗的測試。** 建立 `tests/station-mobile-shots.test.js`：

```js
'use strict';
// station-67: a phone message's "[圖片] <saved path>" lines are the photos it carried. The conversation
// draws each as a thumbnail served by GET /phone/img and never shows the path; a line that is not the
// shape /phone/upload saves under stays plain, escaped text.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');

const NOW = new Date(2026, 9, 30, 9, 0).getTime();
const HOME = { host: 'h', at: NOW, gates: [], tasks: [], done: [] };
const sess = (extra) => Object.assign({ id: 'aaaaaaaa-5', root: '/w', task: 't', project: 'proj', stage: 'build', route: [], state: 'holding', attached: true, waiting: null, chat: [], gate: null, background: [], at: NOW }, extra);
const R = P.parseRoute('#/s/aaaaaaaa-5');
const draw = (extra) => P.screen(HOME, R, NOW, { mode: 'app', open: {} }, sess(extra));
const WIN = 'F:\\w\\.fankeel\\build\\station\\phone\\aaaaaaaa-5\\uploads\\1730000000000-abc123.png';
const POSIX = '/w/.fankeel/build/station/phone/aaaaaaaa-5/uploads/1730000000001-def456.jpeg';

test('a phone message with [圖片] lines draws its text, then one thumbnail per photo, and no path', () => {
    const html = draw({ chat: [{ role: 'phone', text: '看這兩張\n[圖片] ' + WIN + '\n[圖片] ' + POSIX, at: NOW }] });
    assert.match(html, /<p class="bub">看這兩張<\/p>/);
    assert.equal((html.match(/<img class="shot"/g) || []).length, 2);
    assert.ok(html.includes('src="/phone/img?root=%2Fw&amp;id=aaaaaaaa-5&amp;name=1730000000000-abc123.png"'));
    assert.ok(html.includes('src="/phone/img?root=%2Fw&amp;id=aaaaaaaa-5&amp;name=1730000000001-def456.jpeg"'));
    assert.match(html, /<span class="shots">/);
    assert.match(html, /alt="傳來的圖片"/);
    assert.doesNotMatch(html, /\[圖片\]|uploads|abc123\.png<|F:\\/);
});

test('photos alone draw no empty text bubble', () => {
    const html = draw({ chat: [{ role: 'phone', text: '[圖片] ' + POSIX, at: NOW }] });
    assert.equal((html.match(/<img class="shot"/g) || []).length, 1);
    assert.doesNotMatch(html, /<p class="bub"><\/p>/);
});

test('a [圖片] line that is not a saved photo stays escaped text, and the queued message gets thumbnails too', () => {
    const html = draw({ chat: [{ role: 'phone', text: '[圖片] /etc/passwd\n[圖片] <img src=x>', at: NOW }], waiting: { text: '等著\n[圖片] ' + POSIX, at: NOW } });
    assert.ok(html.includes('[圖片] /etc/passwd'));
    assert.ok(html.includes('[圖片] &lt;img src=x&gt;'));
    assert.equal((html.match(/<img class="shot"/g) || []).length, 1, 'only the queued message has a real photo');
    assert.equal((html.match(/<img /g) || []).length, 1);
});

test('English labels the thumbnail', () => {
    const html = P.screen(HOME, R, NOW, { mode: 'app', open: {}, lang: 'en' }, sess({ chat: [{ role: 'phone', text: '[圖片] ' + POSIX, at: NOW }] }));
    assert.ok(html.includes('alt="傳來的圖片"') || html.includes('alt="Photo sent"'));
});
```

最後一個測試只證明 `alt` 有值；語言切換由模組載入時的 `lang` 決定，不在本任務內重做。

- [ ] **Step 2: 跑測試，確認失敗。**

```sh
node --test tests/station-mobile-shots.test.js
```

預期：前三個測試失敗（沒有 `<img class="shot"`）。

- [ ] **Step 3: 字典。** 在 `assets/station/mobile.js` 的中文字典（`:27`）把 `'chat.sent': '已送進 session', ` 換成：

```js
'chat.sent': '已送進 session', 'chat.shot': '傳來的圖片', 
```

在 `assets/station/mobile.js` 的英文字典（`:98`）把 `'chat.sent': 'Sent to the session', ` 換成：

```js
'chat.sent': 'Sent to the session', 'chat.shot': 'Photo sent', 
```

- [ ] **Step 4: `bubble()`。** 在 `assets/station/mobile.js` 的 `function bubble(` 之前（`:752`）加入兩個小函式，並把 `bubble` 的簽名與最後的手機／電腦分支改成下面的樣子：

```js
    // A phone message's "[圖片] <saved path>" lines are the photos it carried (say() in the composer).
    // Only a name shaped like what /phone/upload saves counts; any other line stays text.
    var SHOT_LINE = /^\[圖片\] (.+)$/;
    var SHOT_NAME = /^\d+-[0-9a-f]{6}\.(?:png|jpeg|gif|webp)$/;
    function shotsOf(text) {
        var names = [];
        var rest = String(text).split('\n').filter(function (line) {
            var m = SHOT_LINE.exec(line);
            var name = m ? m[1].trim().split(/[\\/]/).pop() : '';
            if (!SHOT_NAME.test(name)) return true;
            names.push(name);
            return false;
        }).join('\n').trim();
        return names.length ? { text: rest, names: names } : { text: String(text), names: names };
    }
    function shotsHtml(names, img) {
        return '<span class="shots">' + names.map(function (n) {
            return '<img class="shot" loading="lazy" alt="' + t('chat.shot') + '" src="/phone/img?root=' + encodeURIComponent(img.root) + '&amp;id=' + encodeURIComponent(img.id) + '&amp;name=' + encodeURIComponent(n) + '">';
        }).join('') + '</span>';
    }

    function bubble(role, text, at, sent, fold, img) {
```

並把 `assets/station/mobile.js` 裡 `bubble()` 最後的

```js
        var pc = role === 'desktop';
        return '<div class="msg me ' + (pc ? 'pc' : 'ph') + '"><span class="who">' + ic(pc ? 'laptop' : 'phone') + t(pc ? 'who.pc' : 'who.ph') + when + '</span>'
            + '<p class="bub">' + esc(text) + '</p>' + (sent ? '<span class="sent">' + sent + '</span>' : '') + '</div>';
```

在 `assets/station/mobile.js` 換成：

```js
        var pc = role === 'desktop';
        var got = img ? shotsOf(text) : { text: String(text), names: [] };
        return '<div class="msg me ' + (pc ? 'pc' : 'ph') + '"><span class="who">' + ic(pc ? 'laptop' : 'phone') + t(pc ? 'who.pc' : 'who.ph') + when + '</span>'
            + (got.text || !got.names.length ? '<p class="bub">' + esc(got.text) + '</p>' : '')
            + (got.names.length ? shotsHtml(got.names, img) : '')
            + (sent ? '<span class="sent">' + sent + '</span>' : '') + '</div>';
```

- [ ] **Step 5: `cvInner()`。** 在 `assets/station/mobile.js` 的 `cvInner()` 把兩處 `bubble(` 呼叫補上第六個參數，第一處：

```js
            return bubble(g.role, g.text, g.at, i === lastPhone ? ic('check') + t('chat.sent') : '', fold(i), { root: p.root, id: p.id });
```

第二處，同在 `assets/station/mobile.js`：

```js
        if (p.waiting) out += bubble('phone', p.waiting.text, p.waiting.at, t('chat.queued'), null, { root: p.root, id: p.id });
```

- [ ] **Step 6: 跑測試，確認通過，再跑相鄰測試。**

```sh
node --test tests/station-mobile-shots.test.js tests/station-mobile-page.test.js tests/station-mobile-photos.test.js tests/mobile-model.test.js
```

- [ ] **Step 7: 暫存並提交。**

```sh
git add tests/station-mobile-shots.test.js assets/station/mobile.js
git commit -m "feat: phone chat draws [圖片] lines as thumbnails, not paths (station-67)"
```

- 以下是同一個任務的第二半（station-68，輸入框清空）。

station-68 的原因：`assets/station/mobile.js:1703` 的 `say()` 先設 `st.ui.draft = text`，直到 `act()` 的成功回呼（`:1705`）才清；POST 在飛行中、或上一句還在等時，任何重畫（輪詢、`hashchange`）都會從 `st.ui.draft` 把舊字放回 `<textarea>`（`mobile.js:917`）。修法：一送出就清 `st.ui.draft` 與欄位本身；`act()` 新增第四個參數 `undo`，被拒或測站斷線時把字放回（飛行中新打的字接在後面）；成功回呼不再清 draft，以免吃掉飛行中新打的字。

- [ ] **Step 8: 先寫失敗的測試。** 建立 `tests/station-mobile-say-clear.test.js`：

```js
'use strict';
// station-68: a message leaves the field the moment it is queued. A redraw while it is still in flight
// (a poll, a hash change) must not put it back; a refusal or a lost station does, with anything typed
// since after it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.js'), 'utf8');
const NOW = new Date(2026, 9, 30, 9, 0).getTime();
const ROW = { id: 'aaaaaaaa-5', root: '/w', task: 't', project: 'proj', stage: 'build', route: [], gate: false, updated: NOW, state: 'holding', attached: true, background: [], last: null };
const HOME = { host: 'my-pc', at: NOW, gates: [], tasks: [ROW], done: [] };
const sess = (extra) => Object.assign({ id: 'aaaaaaaa-5', root: '/w', task: 't', project: 'proj', stage: 'build', route: [], state: 'holding', attached: true, waiting: null, chat: [], gate: null, background: [], at: NOW }, extra);
const reply = (status, body) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) });
const settle = () => new Promise((r) => setTimeout(r, 30));
const PHONE = '/station/phone.json?id=';

function boot(fetchFn) {
    const app = { innerHTML: '' };
    const on = { doc: {}, win: {} };
    const listen = (where) => (type, fn) => { (on[where][type] = on[where][type] || []).push(fn); };
    const doc = { getElementById: (id) => (id === 'app' ? app : null), documentElement: {}, body: { insertAdjacentHTML() {} }, addEventListener: listen('doc'), querySelector: () => null, visibilityState: 'visible' };
    const win = {
        document: doc, location: { hash: '#/s/aaaaaaaa-5' }, navigator: { language: 'zh-TW', userAgent: 'x' },
        localStorage: { getItem: () => null, setItem() {} }, addEventListener: listen('win'), setInterval() {}, setTimeout, URLSearchParams,
        fetch: fetchFn,
    };
    vm.runInNewContext(SRC, { window: win });
    return { app, fire: (type, e) => (on.doc[type] || []).forEach((fn) => fn(e)), fireWin: (type) => (on.win[type] || []).forEach((fn) => fn({})) };
}
const form = (box) => ({ id: 'composer', getAttribute: () => null, querySelector: (s) => (s === 'textarea' ? box : null) });
const submit = (box) => ({ target: form(box), preventDefault() {} });
const typing = (value) => ({ target: { id: 'cmp-box', value, style: {}, scrollHeight: 40, getAttribute: () => null } });
const textarea = (page) => (/<textarea[^>]*id="cmp-box"[^>]*>([^<]*)<\/textarea>/.exec(page.app.innerHTML) || [])[1];

function held(say) {
    return (url) => (url === '/phone/say' ? say() : url === '/station/mobile.json' ? reply(200, HOME) : url.startsWith(PHONE) ? reply(200, sess()) : reply(201, ''));
}

test('a message still in flight is gone from the field, and a redraw does not put it back', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const page = boot(held(() => gate.then(() => reply(201, ''))));
    await settle();
    const box = { value: '跑測試' };
    page.fire('submit', submit(box));
    assert.equal(box.value, '', 'the field itself is emptied at once');
    page.fireWin('hashchange');
    assert.equal(textarea(page), '', 'a redraw while the request is out');
    release();
    await settle();
    assert.equal(textarea(page), '');
});

test('a queued message leaves the disabled field empty', async () => {
    let said = false;
    const page = boot((url) => {
        if (url === '/phone/say') { said = true; return reply(201, ''); }
        if (url === '/station/mobile.json') return reply(200, HOME);
        if (url.startsWith(PHONE)) return reply(200, sess(said ? { waiting: { text: '跑測試', at: NOW } } : {}));
        return reply(201, '');
    });
    await settle();
    page.fire('submit', submit({ value: '跑測試' }));
    await settle();
    page.fireWin('hashchange');
    assert.match(page.app.innerHTML, /<textarea[^>]*id="cmp-box"[^>]*disabled[^>]*><\/textarea>/);
});

test('a refusal puts the text back, after anything typed while it was out', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const page = boot(held(() => gate.then(() => reply(409, 'not attached'))));
    await settle();
    page.fire('submit', submit({ value: '跑測試' }));
    page.fire('input', typing('再補一句'));
    release();
    await settle();
    assert.equal(textarea(page), '跑測試\n再補一句');
    assert.ok(page.app.innerHTML.includes('測站沒收下（409）：not attached'));
});

test('a lost station puts the text back too, and a success keeps what was typed meanwhile', async () => {
    const lost = boot(held(() => Promise.reject(new Error('offline'))));
    await settle();
    lost.fire('submit', submit({ value: '跑測試' }));
    await settle();
    assert.equal(textarea(lost), '跑測試');
    let release;
    const gate = new Promise((r) => { release = r; });
    const ok = boot(held(() => gate.then(() => reply(201, ''))));
    await settle();
    ok.fire('submit', submit({ value: '第一句' }));
    ok.fire('input', typing('第二句'));
    release();
    await settle();
    assert.equal(textarea(ok), '第二句');
});
```

- [ ] **Step 9: 跑測試，確認失敗。**

```sh
node --test tests/station-mobile-say-clear.test.js
```

預期：第一個測試失敗（`box.value` 仍是 `跑測試`）、第四個測試的「第二句」被成功回呼清掉而失敗。

- [ ] **Step 10: 改 `act()`。** 在 `assets/station/mobile.js` 把整個 `act` 函式換成：

```js
        // A refusal or a lost station says so under the conversation; `undo` gives back what the
        // caller took out of the page before sending.
        function act(url, fields, done, undo) {
            st.ui.note = '';
            return post(url, fields).then(function (r) {
                if (r.ok) { if (done) done(); return talking(route()) ? loadChat() : load(); }
                return r.text().then(function (text) { if (undo) undo(); st.ui.note = t('gate.refused', { code: r.status, why: String(text || '').trim() }); draw(); });
            }, function () { if (undo) undo(); st.ui.note = t('gate.failed'); draw(); });
        }
```

- [ ] **Step 11: 改 `say()`。** 在 `assets/station/mobile.js` 把 `say` 函式裡從 `st.ui.draft = text;` 到函式結尾的部分換成：

```js
            // Out of the field the moment it is queued, so no redraw can put it back; a refusal or a
            // lost station gives it back in front of whatever was typed since.
            st.ui.draft = '';
            if (box) box.value = '';
            strip();
            act('/phone/say', { root: p.root, id: p.id, text: body }, function () {
                list.forEach(function (x) { drop(x.key); });
                st.ui.over = false;
                st.P = null;
            }, function () {
                st.ui.draft = st.ui.draft ? text + '\n' + st.ui.draft : text;
            });
        }
```

（`say` 開頭的 `var body = ...` 行與前面的檢查不動。）

- [ ] **Step 12: 跑測試，確認通過，再跑相鄰測試。**

```sh
node --test tests/station-mobile-say-clear.test.js tests/station-mobile-page.test.js tests/station-mobile-photos.test.js tests/station-unreg-route.test.js
```

- [ ] **Step 13: 暫存並提交。**

```sh
git add tests/station-mobile-say-clear.test.js assets/station/mobile.js
git commit -m "fix: phone composer empties the moment a message is queued (station-68)"
```

## Task 10: 縮圖的樣式

**Files:**
- Modify: `assets/station/mobile.css:106-109` — `.msg.ai .bub` 與 `.sent` 之間加 `.shots`、`.shot`
- Test: `tests/station-mobile-shots-css.test.js`

**Interfaces:**
- Consumes: Task 9 的 `<span class="shots"><img class="shot">` 結構（class 名稱 `.shots`、`.shot` 就寫在這裡，不必讀 Task 9 的檔案）
- Produces: none

**Dispatch:** implementer, sonnet — 兩條 CSS 規則與一個讀檔斷言。

- [ ] **Step 1: 先寫失敗的測試。** 建立 `tests/station-mobile-shots-css.test.js`：

```js
'use strict';
// station-67: the thumbnails of a phone message sit under its text, to the right like the bubble,
// a square each, so a photo never stretches the 84% message column.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.css'), 'utf8');

test('mobile.css: .shots wraps its photos to the right, .shot is a fixed square that crops', () => {
    assert.ok(css.includes('\n.shots{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}'));
    assert.ok(css.includes('\n.shot{width:112px;height:112px;object-fit:cover;border-radius:var(--r-sm);background:var(--inset)}'));
});
```

- [ ] **Step 2: 跑測試，確認失敗。**

```sh
node --test tests/station-mobile-shots-css.test.js
```

- [ ] **Step 3: 加規則。** 在 `assets/station/mobile.css` 的 `.msg.ai .bub{...}`（`:106`）那行之後加入：

```css
.shots{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
.shot{width:112px;height:112px;object-fit:cover;border-radius:var(--r-sm);background:var(--inset)}
```

- [ ] **Step 4: 跑測試，再跑讀 `mobile.css` 的相鄰測試。**

```sh
node --test tests/station-mobile-shots-css.test.js tests/station-mobile-page.test.js tests/station-mobile-cards.test.js tests/station-resize-css.test.js
```

- [ ] **Step 5: 暫存並提交。**

```sh
git add tests/station-mobile-shots-css.test.js assets/station/mobile.css
git commit -m "fix: style the phone chat's photo thumbnails (station-67)"
```

## Task 11: focus 殼補載 station.js 懶載入的六個模組

**Files:**
- Modify: `lib/station.js` — `focusShell` 的 script 清單加 `FOCUS_NEEDS`
- Modify: `tests/station-modules.test.js` — focus 殼的 script 清單斷言加六個檔名
- Test: `tests/station-focus-shell-load.test.js`

**Interfaces:**
- Consumes: none
- Produces: `focusShell(id, tab)` 回傳的 HTML 在 `tip.js` 與 `diagram.js` 之間依序多載 `fmt.js`、`chart.js`、`detail-html.js`、`gate-tab.js`、`dash.js`、`nav.js`

**Dispatch:** implementer, sonnet — 程式與測試都寫在計畫裡，照抄加跑測試。

- [ ] **Step 1: 寫會失敗的測試**

寫 `tests/station-focus-shell-load.test.js`（新檔）。它照 `focusShell` 列的 script 順序，在沒有 `require` 的 vm 裡載入，所以少載模組會丟 `station: X is not loaded`：

```js
'use strict';
// The focus shell (lib/station.js focusShell) in a page with no `require`, as a
// browser has it: assets/station/station.js reaches nav.js, dash.js, gate-tab.js,
// fmt.js, chart.js and detail-html.js through window.FK_*, so the shell has to
// load them. tests/station-focus-page.test.js loads every module of index.html and
// so could not see the page go blank (station-69).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const station = require('../lib/station.js');

const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const ROW = { id: SID, task: '讓 gate 頁畫得出來', stage: 'plan', route: ['survey', 'plan', 'build'], state: 'live', step: 2, steps: 3 };
const SHELL = { id: 'b1', state: 'running', command: 'node scripts/suite.js', startedAt: new Date().toISOString(), code: null };
const HEAD = { plan: 'data-block="focus-header"', gate: 'data-block="gate-head"' };

// The scripts focusShell names, run in order in one context that has `window`
// and `document` and nothing else a browser lacks; returns what #focus holds.
function drawn(tab, shells) {
    const html = station.focusShell(SID, tab);
    const names = [...html.matchAll(/<script src="\/station\/([^"]+)"><\/script>/g)].map((m) => m[1]).filter((n) => !n.startsWith('focus/'));
    const focus = { innerHTML: '', addEventListener() {}, classList: { toggle() {} } };
    const doc = { hidden: false, head: { appendChild() {} }, getElementById: () => focus, createElement: () => ({}), addEventListener() {}, querySelectorAll: () => [] };
    const win = { STATION_FOCUS: { id: SID, tab }, STATION: { serve: false, pricesVerified: '2026-09-04', sessions: [ROW] },
        STATION_DETAIL: { [SID]: { tasks: [], gate: null, shells } }, location: { hash: '' },
        setInterval() {}, setTimeout() {}, clearTimeout() {}, addEventListener() {} };
    const box = vm.createContext({ window: win, document: doc, URLSearchParams });
    for (const n of names) vm.runInContext(fs.readFileSync(path.join(ASSETS, n), 'utf8'), box, { filename: n });
    return focus.innerHTML;
}

for (const tab of station.FOCUS_TABS) {
    test('the ' + tab + ' page draws its header and the session\'s task with no require in the page', () => {
        const html = drawn(tab, []);
        assert.ok(html.includes(HEAD[tab]), tab);
        assert.ok(html.includes('讓 gate 頁畫得出來'), tab);
    });
    test('the ' + tab + ' page draws a session\'s background shells under its header', () => {
        const html = drawn(tab, [SHELL]);
        assert.ok(html.indexOf('data-block="s-shells"') > html.indexOf(HEAD[tab]), tab);
        assert.ok(html.includes('node scripts/suite.js'), tab);
    });
}

test('every script the focus shell loads is a module the station serves', () => {
    const html = station.focusShell(SID, 'gate');
    const names = [...html.matchAll(/<script src="\/station\/([^"]+)"><\/script>/g)].map((m) => m[1]).filter((n) => !n.startsWith('focus/'));
    for (const n of names) assert.ok(['i18n.js', 'station.js', ...station.MODULES].includes(n), n);
});
```

- [ ] **Step 2: 跑，看它失敗**

```bash
node --test tests/station-focus-shell-load.test.js
```

預期四個 `draws` 測試失敗，訊息是 `station: dash.js is not loaded`、`gate-tab.js is not loaded`、`nav.js is not loaded`；最後一個（served）通過。

- [ ] **Step 3: 補 `focusShell`**

在 `lib/station.js` 裡，`// The tabs the focus page draws; scripts/station.js sends any other to the full station.` 那行註解的正上方加：

```js
// The modules assets/station/station.js builds on first use through `mod()` and the focus
// page reaches by its kit (fmt, chart, detail-html, gate-tab, dash, nav). index.html loads
// them; the focus shell has to as well, or the page throws `nav.js is not loaded` and stays
// blank (station-69). tests/station-focus-shell-load.test.js runs the shell without `require`.
const FOCUS_NEEDS = ['fmt.js', 'chart.js', 'detail-html.js', 'gate-tab.js', 'dash.js', 'nav.js'];

```

`lib/station.js` 的 `focusShell` 裡，緊接在 `tip.js` 那一行後面加一行：

```js
        + '<script src="/station/tip.js"></script>\n'
        + FOCUS_NEEDS.map((n) => '<script src="/station/' + n + '"></script>\n').join('')
```

（第一行是原有的錨點，不要重複。）

- [ ] **Step 4: 更新 focus 殼清單的既有測試**

在 `tests/station-modules.test.js` 裡，把 `test('the focus page loads tip, diagram, board-edit, gate-frame and focus-page between i18n.js and station.js', () => {` 這一行的標題改成 `test('the focus page loads tip, the modules station.js builds on, diagram, board-edit, gate-frame and focus-page between i18n.js and station.js', () => {`，並把下面的 `assert.deepEqual(scripts, [...])` 那一行換成：

```js
    assert.deepEqual(scripts, ['focus/' + SID + '.js', 'i18n.js', 'tip.js', 'fmt.js', 'chart.js', 'detail-html.js', 'gate-tab.js', 'dash.js', 'nav.js', 'diagram.js', 'board-edit.js', 'gate-frame.js', 'focus-page.js', 'station.js']);
```

- [ ] **Step 5: 跑，看它通過**

```bash
node --test tests/station-focus-shell-load.test.js tests/station-modules.test.js tests/station-focus.test.js tests/station-focus-page.test.js tests/focus-board.test.js tests/station-diagram.test.js tests/station-module-lists.test.js
```

預期全部通過。

- [ ] **Step 6: Commit**

```bash
git add tests/station-focus-shell-load.test.js lib/station.js tests/station-modules.test.js
git commit -m "fix: focus page loads the modules station.js builds on, so gate and plan pages draw (station-69)"
```

## Task 12: 伺服器把報告的 mermaid 圖放進 phone.json，並讓 /m 殼載入 diagram

**Files:**
- Modify: `lib/mobile.js` — `diagramsOf`、`reportText`、`phoneModel` 的 `diagrams`、`shell()` 載 diagram.css 與 diagram.js、匯出 `diagramsOf`
- Read: `lib/gatereport.js` — `read(root, data)` 回 `{ text, … }` 或 `null`
- Read: `lib/registry.js` — `readSession(root, id)`
- Read: `tests/tmp.js` — 測試的暫存目錄 helper
- Test: `tests/mobile-diagrams.test.js`

**Interfaces:**
- Consumes: `gatereport.read(root, data) -> { text: string, … } | { error, … } | null`；`registry.readSession(root, id) -> object | null`
- Produces: `mobile.diagramsOf(text) -> Array<{ line: number, code: string }>`；`phoneModel(...)` 多一個欄位 `diagrams: Array<{ line: number, code: string }>`（gate 沒持有時是 `[]`）；`/m` 殼在 `station.css` 後、`mobile.css` 前連 `/station/diagram.css`，在 `mobile.js` 前載 `/station/diagram.js`

**Dispatch:** implementer, sonnet — 程式與測試都寫在計畫裡，照抄加跑測試。

- [ ] **Step 1: 寫會失敗的測試**

寫 `tests/mobile-diagrams.test.js`（新檔）：

```js
'use strict';
// station-66: the phone's gate screen draws the report's mermaid diagrams, so
// phone.json carries them while a gate is held (lib/mobile.js diagramsOf), and
// the /m shell loads the drawing script and its sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mobile = require('../lib/mobile.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const NOW = Date.parse('2026-10-30T10:00:00.000Z');
const SID = 'bbbbbbbb-1111-4111-8111-00000000000a';
const STARTED = '2026-09-11T10:00:00.000Z';
const TASK = '.fankeel/build/task-20260911T100000';
const Q = [{ question: '往下走？', multiSelect: false, options: [{ label: 'build (Recommended)' }, { label: '再想想' }] }];
const REPORT = ['結論先說：圖在下面。', '', '```mermaid', 'flowchart TD', '  A["Start"] --> B["Done"]', '```', '', '```json gate', '{"questions":[]}', '```', '',
    '```mermaid', 'flowchart LR', '  X --> Y'].join('\n');
const row = (o) => Object.assign({ sessionId: SID, task: 't', project: '', stage: 'survey', route: ['survey', 'design'], state: 'live', updated: NOW - 60e3, ended: null, cost: null, agentCost: null, stages: [], pending: null, gateAt: null }, o);
const model = (root, sessions) => ({ registries: [{ root, profiles: {}, sessions }] });

// A registry holding SID at survey, its survey.md written where gatereport.read looks.
function fixture(text) {
    const r = tmp('fankeel-mobile-diagrams-');
    registry.ensureLayout(r);
    registry.writeSession(r, SID, { task: 't', stage: 'survey', route: ['survey', 'design'], active: true, started: STARTED, moves: [['survey', 1]] });
    const dir = path.join(r, TASK);
    fs.mkdirSync(dir, { recursive: true });
    if (text !== null) fs.writeFileSync(path.join(dir, 'survey.md'), text);
    return r;
}

test('diagramsOf: every mermaid fence with the line it opens on; other fences and a fence left open', () => {
    assert.deepEqual(mobile.diagramsOf(REPORT), [
        { line: 3, code: 'flowchart TD\n  A["Start"] --> B["Done"]' },
        { line: 12, code: 'flowchart LR\n  X --> Y' },
    ]);
    assert.deepEqual(mobile.diagramsOf('```js\nx\n```'), []);
    assert.deepEqual(mobile.diagramsOf('  ``` Mermaid\r\nA-->B\r\n```\r\n'), [{ line: 1, code: 'A-->B' }]);
    assert.deepEqual(mobile.diagramsOf(null), []);
    assert.deepEqual(mobile.diagramsOf(''), []);
});

test('phoneModel carries the held gate\'s report diagrams, and none without a gate, a report or a registry entry', () => {
    const r = fixture(REPORT);
    const held = row({ pending: { questions: Q, until: NOW + 60e3, at: NOW - 1e3 }, gateAt: NOW - 1e3 });
    const p = mobile.phoneModel(model(r, [held]), SID, NOW, new Set(), null);
    assert.equal(p.state, 'gate');
    assert.equal(p.diagrams.length, 2);
    assert.equal(p.diagrams[0].code, 'flowchart TD\n  A["Start"] --> B["Done"]');
    assert.deepEqual(mobile.phoneModel(model(r, [row()]), SID, NOW, new Set(), null).diagrams, [], 'no gate held');
    const bare = fixture(null);
    assert.deepEqual(mobile.phoneModel(model(bare, [held]), SID, NOW, new Set(), null).diagrams, [], 'no report written yet');
    assert.deepEqual(mobile.phoneModel(model('/nowhere/ws', [held]), SID, NOW, new Set(), null).diagrams, [], 'no registry entry');
});

test('the /m shell loads diagram.css before mobile.css and diagram.js before mobile.js', () => {
    const html = mobile.shell();
    const at = (s) => html.indexOf(s);
    assert.ok(at('href="/station/station.css"') < at('href="/station/diagram.css"') && at('href="/station/diagram.css"') < at('href="/station/mobile.css"'));
    assert.ok(at('<script src="/station/diagram.js"></script>') > 0 && at('<script src="/station/diagram.js"></script>') < at('<script src="/station/mobile.js"></script>'));
});
```

- [ ] **Step 2: 跑，看它失敗**

```bash
node --test tests/mobile-diagrams.test.js
```

預期三個測試都失敗（`mobile.diagramsOf is not a function`、`p.diagrams` 為 undefined、殼裡沒有 diagram）。

- [ ] **Step 3: 實作**

在 `lib/mobile.js` 裡，`const station = require('./station.js');` 那行之後加兩行：

```js
const gatereport = require('./gatereport.js');
const registry = require('./registry.js');
```

在`lib/mobile.js` 裡，`// /station/phone.json: one session's conversation screen.` 那行註解的正上方加：

```js
// The mermaid fences of a gate report, as { line, code }, in the order written: what the phone
// draws over the gate card so a node can be marked (lib/gatereport.js text is the report as the
// desktop gate page reads it). A fence left open runs to the end of the text.
const MERMAID = /^\s*```\s*mermaid\b/i;
function diagramsOf(text) {
    const lines = String(text == null ? '' : text).split(/\r?\n/);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        if (!MERMAID.test(lines[i])) continue;
        let e = i + 1;
        while (e < lines.length && !/^\s*```/.test(lines[e])) e++;
        out.push({ line: i + 1, code: lines.slice(i + 1, e).join('\n') });
        i = e;
    }
    return out;
}

// The report a session's current stage waits at its gate with, '' when it has none or none reads.
function reportText(root, id) {
    const rep = gatereport.read(root, registry.readSession(root, id));
    return rep && typeof rep.text === 'string' ? rep.text : '';
}

```

`lib/mobile.js` 的 `phoneModel` 回傳物件裡，`gate, background: p ? p.background : [], at: now,` 那行之後加一行：

```js
        diagrams: gate ? diagramsOf(reportText(root, s.sessionId)) : [],
```

`lib/mobile.js` 的 `shell()` 裡，`'<link rel="stylesheet" href="/station/mobile.css">\n'` 那行的正上方加：

```js
        + '<link rel="stylesheet" href="/station/diagram.css">\n'
```

在 `lib/mobile.js` 的 `shell()` 裡，`'<script src="/station/mobile.js"></script>\n'` 那行的正上方加：

```js
        + '<script src="/station/diagram.js"></script>\n'
```

`lib/mobile.js` 最後一行的匯出改成（加 `diagramsOf`）：

```js
module.exports = { mobileModel, phoneModel, diagramsOf, contextOf, limitsOf, shell, manifest, icon, unregOf, rcLive, unregModel };
```

- [ ] **Step 4: 跑，看它通過**

```bash
node --test tests/mobile-diagrams.test.js tests/mobile-model.test.js tests/mobile-data.test.js tests/station-mobile-route.test.js tests/station-mobile-data.test.js
```

預期全部通過（既有的 mobile 測試不受 `diagrams` 欄位影響）。

- [ ] **Step 5: Commit**

```bash
git add tests/mobile-diagrams.test.js lib/mobile.js
git commit -m "feat: phone.json carries a held gate's report diagrams and the /m shell loads diagram.js (station-66)"
```

## Task 13: 手機 gate 畫面在卡片上方畫報告的圖，點節點把「標記：」行寫進答案框

**Files:**
- Modify: `assets/station/mobile.js:47-880` — 字串表加 `dg.label`、`dg.hint`、`dg.marked`（中 47 行、英 118 行各一行）；`DG()`、`diagramsHtml(p)`，`cvInner` 的 gate 分支先畫圖
- Modify: `assets/station/mobile.js:1490-1580` — `boot()` 裡的 `markText`、`writeMarks`、`drawDiagrams`，`draw()` 與 `patch()` 呼叫它（前半在 880 行以前加了約 30 行，以函式名定位）
- Modify: `assets/station/mobile.css:680-691` — 檔尾加 `.gc-dg` 一組規則
- Read: `assets/station/diagram.js` — `fence(code, line)` 回 `<figure class="dg" data-mermaid data-l="…">`；`draw(root, { mark, marked, onMark })`：`onMark` 收 `[{ fig, id, label }]`，`marked` 收 `[{ fig, id }]`
- Test: `tests/station-mobile-diagram.test.js`
- Test: `tests/station-mobile-diagram-marks.test.js`

**Interfaces:**
- Consumes: `phoneModel` 的 `p.diagrams: Array<{ line: number, code: string }>`（Task 12）；`FK_DIAGRAM.fence(code, line) -> string`；`typed({ target, type })`（`boot()` 內既有，勾選「自己寫」的 radio）；`FK_DIAGRAM.draw(root, opts)`
- Produces: `cvInner(p, at, u)` 在 `p.state === 'gate'` 時於 gate 卡片前輸出 `<section class="gc-dg" data-block="m-gate-diagrams">…`；模組內 `DG() -> FK_DIAGRAM | null`；`STR.zh/en` 的 `dg.marked`（`標記：` / `Marked: `）。點圖上的節點，答案框 `#gc-own0` 的內容 `標記：A「label」、B「label」` 被既有的 `answer()` 當第一題的「自己寫」答案送出

**Dispatch:** implementer, sonnet — 程式與測試都寫在計畫裡，照抄加跑測試。

- [ ] **Step 1: 寫會失敗的測試**

寫 `tests/station-mobile-diagram.test.js`（新檔）：

```js
'use strict';
// station-66: the phone's gate screen draws the report's mermaid diagrams over the gate card
// (phone.json `diagrams`, lib/mobile.js), narrowed to the phone by mobile.css.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../assets/station/mobile.js');

const read = (n) => fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', n), 'utf8');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const NOW = new Date(2026, 9, 30, 10, 0).getTime();
const ID = 'aaaaaaaa-5';
const Q = [{ question: '往下走？', multiSelect: false, options: [{ label: 'build (Recommended)' }, { label: '再想想' }] }];
const HOME = { host: 'h', at: NOW, device: null, gates: [], tasks: [], stopped: [], done: [] };
const APP = { mode: 'app', open: {} };
const DIAGRAMS = [{ line: 3, code: 'flowchart TD\n  A["Start"] --> B["<b>Done</b>"]' }, { line: 12, code: 'flowchart LR\n  X --> Y' }];
const gate = (extra) => Object.assign({ id: ID, root: '/w', task: 't5', project: 'proj', stage: 'survey', route: ['survey', 'design'], state: 'gate', attached: false,
    waiting: null, chat: [], gate: { questions: Q, until: NOW + 760e3 }, diagrams: DIAGRAMS, background: [], at: NOW, holdUntil: null, context: null, limits: null }, extra);
const screen = (p) => P.screen(HOME, P.parseRoute('#/s/' + ID), NOW, APP, p);

test('a held gate draws its report\'s diagrams in .gc-dg, in order, before the gate card; the source is escaped', () => {
    const html = screen(gate());
    const at = html.indexOf('<section class="gc-dg"');
    assert.ok(at > 0 && at < html.indexOf('<form class="gc gopts"'));
    assert.equal((html.match(/<figure class="dg" data-mermaid data-l="/g) || []).length, 2);
    assert.ok(html.indexOf('data-l="3"') < html.indexOf('data-l="12"'));
    assert.ok(html.includes('&lt;b&gt;Done&lt;/b&gt;') && !html.includes('<b>Done</b>'));
    assert.ok(html.includes('點圖上的方塊標記它'));
});

test('no diagrams, or a gate that is not held, draws no .gc-dg', () => {
    assert.doesNotMatch(screen(gate({ diagrams: [] })), /gc-dg/);
    assert.doesNotMatch(screen(gate({ diagrams: undefined })), /gc-dg/);
    assert.doesNotMatch(screen(gate({ state: 'running', gate: null })), /gc-dg/);
});

test('English: the diagram strings are in both tables and the English screen\'s heading holds no CJK', () => {
    for (const k of ['dg.label', 'dg.hint', 'dg.marked']) assert.ok(P.STR.zh[k] && P.STR.en[k], k);
    assert.equal(P.STR.zh['dg.marked'], '標記：');
    assert.equal(P.STR.en['dg.marked'], 'Marked: ');
    P.setLang('en');
    try {
        const ascii = JSON.parse(JSON.stringify(gate()).replace(/[^\x00-\x7f]+/g, 'x'));
        const html = screen(ascii);
        assert.match(html, /<section class="gc-dg"/);
        assert.equal(CJK.exec(/<p class="gc-dgh">[\s\S]*?<\/p>/.exec(html)[0]), null);
    } finally {
        P.setLang('zh');
    }
});

test('mobile.css styles .gc-dg, its heading and its figure, and hides the desktop hint that says "on the right"', () => {
    const css = read('mobile.css');
    for (const rule of ['.gc-dg{', '.gc-dgh{', '.gc-dg .dg{', '.gc-dg .dg-hint{display:none}', '.gc-dg .dg-pan{']) assert.ok(css.includes(rule), rule);
});
```

- [ ] **Step 2: 跑，看它失敗**

```bash
node --test tests/station-mobile-diagram.test.js
```

預期四個測試都失敗（畫面沒有 `gc-dg`、`STR` 沒有 `dg.*`、css 沒有規則）。

- [ ] **Step 3: 字串表**

`assets/station/mobile.js` 的 `STR.zh` 裡，找到含 `'gate.sending': '送出中…'` 的那一行（它也含 `'gate.needAll': '每一題都要有答案',`），在那一行之後插入一行（四格縮排的十二格）：

```js
            'dg.label': '報告裡的流程圖', 'dg.hint': '點圖上的方塊標記它，標記會寫進下面「自己寫答案」', 'dg.marked': '標記：',
```

`assets/station/mobile.js` 的 `STR.en` 裡含 `'gate.sending': 'Sending…'` 的那一行之後插入：

```js
            'dg.label': 'Diagrams in the report', 'dg.hint': 'Tap a box on the diagram to mark it; the marks go into "Write your own answer" below', 'dg.marked': 'Marked: ',
```

- [ ] **Step 4: 畫圖的函式與 gate 分支**

`assets/station/mobile.js` 裡，`function gateCard(p, at, u) {` 這行的正上方（它前面是 `bgPanel` 結尾）加：

```js
    // diagram.js (FK_DIAGRAM): the window global on the page, the file beside this one under node's tests.
    function DG() {
        var dg = w && w.FK_DIAGRAM ? w.FK_DIAGRAM : typeof require === 'function' ? require('./diagram.js') : null;
        // diagram.js words its buttons from FK_I18N.lang; this page loads no i18n.js, so the language is ours.
        if (w && dg) w.FK_I18N = { lang: lang };
        return dg;
    }

    // The gate report's mermaid diagrams (phone.json `diagrams`, lib/mobile.js), over the gate card:
    // drawn after the page is written (drawDiagrams), a tap on a node marks it into the card's own box.
    function diagramsHtml(p) {
        var list = (p.diagrams || []).filter(function (x) { return x && typeof x.code === 'string'; });
        var dg = DG();
        if (!list.length || !dg) return '';
        return '<section class="gc-dg" data-block="m-gate-diagrams" aria-label="' + t('dg.label') + '"><p class="gc-dgh">' + ic('gate') + t('dg.hint') + '</p>'
            + list.map(function (x) { return dg.fence(x.code, x.line); }).join('') + '</section>';
    }

```

`assets/station/mobile.js` 的 `cvInner` 裡，把這一行

```js
        if (p.state === 'gate') out += gateCard(p, at, u);
```

換成（`assets/station/mobile.js`）：

```js
        if (p.state === 'gate') out += diagramsHtml(p) + gateCard(p, at, u);
```

- [ ] **Step 5: 樣式**

在 `assets/station/mobile.css` 檔尾（`.mm-pair .cta{…}` 之後）加：

```css
/* the gate report's diagrams over the gate card (station-66): the desktop sheet's figure, narrowed to the phone */
.gc-dg{flex:none;align-self:stretch;margin:0;border-radius:var(--r);background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule);overflow:hidden}
.gc-dgh{display:flex;align-items:flex-start;gap:6px;margin:0;padding:10px 12px 0;font-size:13px;line-height:1.5;color:var(--ink2)}
.gc-dg .dg{margin:8px 0 0;border-width:1px 0 0;border-radius:0}
.gc-dg .dg-hint{display:none}
.gc-dg .dg-pan{height:min(52vh,420px)}
```

- [ ] **Step 6: 跑，看它通過**

```bash
node --test tests/station-mobile-diagram.test.js tests/station-mobile-page.test.js tests/station-mobile-shell.test.js tests/station-mobile-route.test.js
```

預期全部通過（`STR.en`/`STR.zh` key 相同、英文值無 CJK、既有 class 規則檢查都不受影響）。

- [ ] **Step 7: Commit**

```bash
git add tests/station-mobile-diagram.test.js assets/station/mobile.js assets/station/mobile.css
git commit -m "feat: phone gate screen draws the report's mermaid diagrams over the gate card (station-66)"
```

- 以下是同一個任務的第二半（點節點寫標記行）。

- [ ] **Step 8: 寫會失敗的測試**

寫 `tests/station-mobile-diagram-marks.test.js`（新檔）。它在 vm 裡啟動 `mobile.js`，`window.FK_DIAGRAM` 換成會記下每次 `draw(root, opts)` 的假物件，再直接呼叫記下的 `onMark`：

```js
'use strict';
// station-66: on the phone's gate screen a tap on a diagram node writes the one 標記 line into
// question 1's own box and ticks that box's radio, as the desktop gate page does (tests/station-gate-mark.test.js);
// a redraw puts the marks back, and a new gate starts with none.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'mobile.js'), 'utf8');
const NOW = Date.now();
const ID = 'aaaaaaaa-5';
const Q = (q) => [{ question: q, multiSelect: false, options: [{ label: 'build (Recommended)' }, { label: '再想想' }] }];
const HOME = { host: 'h', at: NOW, device: null, gates: [], tasks: [], stopped: [], done: [] };
const phoneJson = (q, until) => ({ id: ID, root: '/w', task: 't5', project: 'proj', stage: 'survey', route: ['survey', 'design'], state: 'gate', attached: false,
    waiting: null, chat: [], gate: { questions: Q(q), until }, diagrams: [{ line: 3, code: 'flowchart TD\n  A["Start"] --> B["Done"]' }], background: [], at: NOW, holdUntil: null, context: null, limits: null });
const reply = (body) => Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
const settle = () => new Promise((r) => setTimeout(r, 30));
// the page ran in its own vm context: its arrays are not this realm's
const plain = (x) => JSON.parse(JSON.stringify(x));

// /m booted on #/s/<id> with a fake FK_DIAGRAM that records each draw(root, opts), and a document
// whose #gc-own0 is one box inside a label holding the radio `typed` ticks.
function boot(state) {
    const on = { doc: {}, win: {} };
    const listen = (where) => (type, fn) => { (on[where][type] = on[where][type] || []).push(fn); };
    const radio = { checked: false };
    const label = { querySelector: (s) => (s === 'input[value="__other"]' ? radio : null) };
    const own = { value: '', id: 'gc-own0', getAttribute: (a) => (a === 'data-own' ? '0' : null), closest: (s) => (s === 'label' ? label : null) };
    const root = {};
    const draws = [];
    const app = { innerHTML: '' };
    const doc = {
        getElementById: (id) => (id === 'app' ? app : null), documentElement: {}, body: { insertAdjacentHTML() {} }, addEventListener: listen('doc'),
        querySelector: (s) => (s === '.gc-dg' && app.innerHTML.includes('class="gc-dg"') ? root : s === '#gc-own0' ? own : null), visibilityState: 'visible',
    };
    const win = {
        document: doc, location: { hash: '#/s/' + ID }, navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0 (Linux; Android 10; K) Chrome/141.0 Mobile Safari/537.36' },
        localStorage: { getItem: () => null, setItem() {} }, addEventListener: listen('win'), setInterval() {}, setTimeout, URLSearchParams,
        fetch: (url) => reply(url === '/station/mobile.json' ? HOME : state.one),
        FK_DIAGRAM: { fence: (code, line) => '<figure class="dg" data-mermaid data-l="' + line + '"></figure>', draw: (r, o) => draws.push({ root: r, o }) },
    };
    vm.runInNewContext(SRC, { window: win });
    const fire = (where, type, e) => (on[where][type] || []).forEach((fn) => fn(e));
    return { win, own, radio, root, draws, app, poll: () => { fire('doc', 'visibilitychange', {}); return settle(); }, goto: (h) => { win.location.hash = h; fire('win', 'hashchange', {}); return settle(); } };
}
const tap = (page, list) => page.draws[page.draws.length - 1].o.onMark(list);

test('the gate screen draws its figures once the page is written, with marks on and none marked', async () => {
    const page = boot({ one: phoneJson('往下走？', NOW + 760e3) });
    await settle();
    assert.equal(page.draws.length, 1);
    assert.equal(page.draws[0].root, page.root);
    assert.equal(page.draws[0].o.mark, true);
    assert.deepEqual(plain(page.draws[0].o.marked), []);
    assert.equal(page.win.FK_I18N.lang, 'zh', 'diagram.js words its buttons from the page\'s language');
});

test('marking writes one 標記 line after the reader\'s own text, ticks 自己寫, and unmarking removes it', async () => {
    const page = boot({ one: phoneJson('往下走？', NOW + 760e3) });
    await settle();
    page.own.value = 'my words';
    tap(page, [{ fig: 0, id: 'A', label: 'Start' }]);
    assert.equal(page.own.value, 'my words\n標記：A「Start」');
    assert.equal(page.radio.checked, true);
    tap(page, [{ fig: 0, id: 'A', label: 'Start' }, { fig: 0, id: 'B', label: 'Done' }]);
    assert.equal(page.own.value, 'my words\n標記：A「Start」、B「Done」');
    tap(page, []);
    assert.equal(page.own.value, 'my words');
});

test('a redraw of the same gate puts the marks back into the box and onto the figure; a new gate starts clean', async () => {
    const state = { one: phoneJson('往下走？', NOW + 760e3) };
    const page = boot(state);
    await settle();
    tap(page, [{ fig: 0, id: 'A', label: 'Start' }]);
    page.own.value = '';
    await page.goto('#/s/' + ID + '/talk');
    const again = page.draws[page.draws.length - 1].o;
    assert.deepEqual(plain(again.marked), [{ fig: 0, id: 'A', label: 'Start' }]);
    assert.equal(page.own.value, '標記：A「Start」');
    state.one = phoneJson('要不要換方向？', NOW + 900e3);
    await page.poll();
    assert.deepEqual(plain(page.draws[page.draws.length - 1].o.marked), []);
});
```

- [ ] **Step 9: 跑，看它失敗**

```bash
node --test tests/station-mobile-diagram-marks.test.js
```

預期失敗：`page.draws.length` 是 0（`mobile.js` 還沒呼叫 `FK_DIAGRAM.draw`）。

- [ ] **Step 10: 實作**

`assets/station/mobile.js` 的 `boot()` 裡，`function draw() {` 這行（下一行是 `stopScan();`）的正上方加：

```js
        // The one 標記 line the marks own in question 1's own box, as the desktop gate page writes it
        // (assets/station/gate-frame.js markLine); the reader's other lines stay, and no marks removes the line.
        function markText(text, list) {
            var lines = String(text || '').split('\n'), at = -1, head = t('dg.marked');
            var line = list.length ? head + list.map(function (m) { return m.id + '「' + m.label + '」'; }).join('、') : null;
            lines.forEach(function (l, i) { if (at < 0 && (l.indexOf('標記：') === 0 || l.indexOf('Marked: ') === 0)) at = i; });
            if (at >= 0 && line === null) lines.splice(at, 1);
            else if (at >= 0) lines[at] = line;
            else if (line !== null) return text + (text && !/\n$/.test(text) ? '\n' : '') + line;
            return lines.join('\n');
        }
        function writeMarks(list) {
            var own = d.querySelector ? d.querySelector('#gc-own0') : null;
            if (!own) return;
            own.value = markText(own.value, list);
            typed({ target: own, type: 'input' });
        }
        // After .cv is written: the figures over the gate card drawn, with the nodes this gate had marked put back.
        function drawDiagrams() {
            var dg = DG(), root = d.querySelector ? d.querySelector('.gc-dg') : null;
            if (!dg || !root) return;
            var marks = st.ui.marks || [];
            dg.draw(root, { mark: true, marked: marks, onMark: function (list) { st.ui.marks = list; writeMarks(list); } });
            if (marks.length) writeMarks(marks);
        }
```

`assets/station/mobile.js` 的 `draw()` 裡，把這一行

```js
            if (gk !== st.gk) { st.ui.pin = false; st.gk = gk; }
```

換成（`assets/station/mobile.js`；新 gate 清掉上一個 gate 的標記）：

```js
            if (gk !== st.gk) { st.ui.pin = false; st.ui.marks = []; st.gk = gk; }
```

`assets/station/mobile.js` 的 `draw()` 裡，`if (keep) keep(cv());` 那行之後加：

```js
            drawDiagrams();
```

`assets/station/mobile.js` 的 `patch()` 裡，`c.innerHTML = talk ? cvInner(st.P, at, st.ui) : paneInner(st.P, R.pane, at, st.ui, st.M);` 後面緊接的 `keep(c);` 之後加：

```js
            if (talk) drawDiagrams();
```

- [ ] **Step 11: 跑，看它通過**

```bash
node --test tests/station-mobile-diagram-marks.test.js tests/station-mobile-diagram.test.js
node --test tests/station-mobile-page.test.js tests/station-mobile-refresh.test.js tests/station-mobile-photos.test.js tests/station-mobile-shell.test.js tests/station-mobile-route.test.js
```

預期全部通過。

- [ ] **Step 12: Commit**

```bash
git add tests/station-mobile-diagram-marks.test.js assets/station/mobile.js
git commit -m "feat: a tap on a diagram node writes the 標記 line into the phone's answer box (station-66)"
```

## Task 14: station-65 gate 頁按鈕 — 補改前改後截圖並收尾

CSS 已由 `58ad85d0` 改完（`assets/station/gate-frame.css:55` 的 `.gq-pick` 是 `min-height:32px`、`border:1px solid var(--rule2)`、`box-shadow:none`，`:56` hover、`:57` 推薦與按下、`:71` `.gt-send` 加 `border-color:var(--keel-deep)`），與判官 `docs/90-agent/judgements/2026-10-29-desktop-pane-button-style.md` 記的改法逐字相同。TODO 的完成標準還欠兩樣：改前改後截圖、使用者確認。本 task 只補這兩樣，並把結果記進 TODO。

**Files:**
- Modify: `docs/90-agent/todo/station-65.md` — 內文加一段：CSS 已在 `58ad85d0` 落地、截圖路徑、等使用者確認
- Read: `assets/station/gate-frame.css` — 改後的規則（不改）
- Read: `assets/station/gate-frame.js` — `frame()` 產出 gate 頁的 HTML（不改）
- Read: `tests/station-module.js` — 測試用的 `page()`，在 node 裡載入 classic script（不改）
- Test: `tests/station-gate-pick-style.test.js` — 已存在，本 task 只跑不寫

**Interfaces:**
- Consumes: `page(files, station)`（`tests/station-module.js`）回傳 `{ M }`，`M['gate-frame.js'].frame({ session, gate, tasks, reportHtml, shellsHtml })` 回傳 HTML 字串
- Produces: `.fankeel/build/2026-10-30-station-65/before.png`、`after.png`，TODO 內文一段記錄

**Dispatch:** in-session — 要開瀏覽器截圖、看結果、再問使用者確認，這幾步在同一個 session 裡接續，派出去只會多一次讀檔。

- [ ] **Step 1: 確認 CSS 與測試已落地**

  ```sh
  git show 58ad85d0 --stat
  sed -n 55,57p assets/station/gate-frame.css
  node --test tests/station-gate-pick-style.test.js
  ```
  預期：commit 動了 `assets/station/gate-frame.css` 與 `tests/station-gate-pick-style.test.js`，兩個測試通過。若 CSS 不是上述內容，停下來回報，不要重寫。

- [ ] **Step 2: 產生改前與改後兩頁靜態 HTML**

  改前用 `58ad85d0^` 的 CSS，改後用現在的；兩頁都連 repo 內的 `station.css`，`<html data-style="keel">` 與 `lib/station.js:1141` 的 focus 頁一致。

  ```sh
  mkdir -p .fankeel/build/2026-10-30-station-65
  git show 58ad85d0^:assets/station/gate-frame.css > .fankeel/build/2026-10-30-station-65/gate-frame-before.css
  node - <<'JS'
  const fs = require('node:fs');
  const { page } = require('./tests/station-module.js');
  const S = { id: 'dddddddd-4444-4444-8444-444444444444', task: 'Gate frame', project: 'fankeel', pkey: 'F:\\ws/fankeel', state: 'live', stage: 'plan',
      route: ['survey', 'design', 'plan', 'build', 'land'], gateAt: Date.parse('2026-10-20T10:00:00.000Z') };
  const GATE = { stage: 'plan', gate: { next: 'build the twelve tasks', questions: [{ question: 'Go to build?', header: 'plan', options: [
      { label: 'build (Recommended)', description: 'Approve the plan and start build.' },
      { label: 'rewrite', description: 'Send the plan back.' },
      { label: 'pause', description: 'Stop here.' }] }] } };
  const html = page(['gate-frame.js'], { sessions: [S] }).M['gate-frame.js'].frame({ session: S, gate: GATE, tasks: [], reportHtml: '<section class="panel">report</section>', shellsHtml: '' });
  const dir = '.fankeel/build/2026-10-30-station-65/';
  const wrap = (css) => '<!doctype html><html lang="zh-Hant" data-style="keel"><head><meta charset="utf-8">'
      + '<link rel="stylesheet" href="../../../assets/station/station.css">'
      + '<link rel="stylesheet" href="' + css + '"></head><body class="focus"><div id="focus">' + html + '</div></body></html>';
  fs.writeFileSync(dir + 'before.html', wrap('gate-frame-before.css'));
  fs.writeFileSync(dir + 'after.html', wrap('../../../assets/station/gate-frame.css'));
  JS
  ```

- [ ] **Step 3: 截圖**

  ```sh
  node scripts/render.js .fankeel/build/2026-10-30-station-65/before.html --out .fankeel/build/2026-10-30-station-65/before --size 1200,800
  node scripts/render.js .fankeel/build/2026-10-30-station-65/after.html --out .fankeel/build/2026-10-30-station-65/after --size 1200,800
  ```
  `FANKEEL_BROWSER` 要先設成 Chrome 的完整路徑。用 Read 開兩張 `render.png`：改前的「選這個」按鈕 30px、無邊框；改後 32px、1px 邊框，推薦那顆有藍色陰影。若兩張長得一樣，代表 `station.css` 沒載到，回頭查 `href` 的相對路徑，不要拿來交差。

- [ ] **Step 4: 把結果寫進 TODO**

  在 `docs/90-agent/todo/station-65.md` 內文最後一段之後加一段：

  `docs/90-agent/todo/station-65.md`
  ```md
  進度：CSS 已在 58ad85d0 改成判官的做法（gate-frame.css:55-57、:71），tests/station-gate-pick-style.test.js 守住。改前改後截圖在 .fankeel/build/2026-10-30-station-65/before/render.png 與 after/render.png（git 不追蹤這個目錄）。還欠：使用者看過截圖，確認被說醜的是 gate 頁的按鈕；若是 Claude Desktop 自己的問答框，這條改成只調文字。
  ```

- [ ] **Step 5: 交給使用者確認**

  向使用者貼兩張截圖的路徑並問一句：被說醜的是這種按鈕嗎。使用者說「是，現在一致了」才用 `node scripts/todo.js done station-65 --sha 58ad85d0` 收；說不是，就把 TODO 改成文字調整並保持 `state: ready`。這一步不由 implementer 做。

- [ ] **Step 6: 提交**

  ```sh
  node scripts/todo-check.js
  git add docs/90-agent/todo/station-65.md
  git commit -m "docs: station-65 records the landed gate button CSS and its before-after shots"
  ```

## Task 15: mobileDeclared — 由 render.json 判斷專案有沒有宣告手機寬度

design-4 要「由專案宣告」，條目提議的來源是 `.fankeel/render.json`（它已經有 per-page 的 `viewport`，`lib/shots.js:57` 驗證，fankeel 自己列了 `412,900`，見 `.fankeel/render.json` 的 `weekly-412`、`m-home`）。為了讓 design 站不靠肉眼判斷，把「有沒有手機寬度」做成 `lib/shots.js` 的一個純函式，測試釘住門檻。

**Files:**
- Modify: `lib/shots.js:79-93` — 在 `cells` 之後、`pagesTouched` 之前加 `mobileDeclared`，匯出列（`lib/shots.js:212`）加上它
- Modify: `knip.json` — 只在 `npx knip` 報 `mobileDeclared` 未使用時，於 ignore 欄加上它
- Test: `tests/shots-mobile.test.js`

**Interfaces:**
- Consumes: `parseTargets(text)`（同檔，`lib/shots.js:37`）回傳 `{ pages, roles, src, look }`，`look` 是 `Map<name, { viewport, theme }>`，壞 JSON 會丟錯
- Produces: `mobileDeclared(text: string | undefined): boolean` — render.json 內容有任何 page 的 `viewport` 寬度 ≤ `PHONE_MAX`（480）就是 `true`；`undefined`、空字串、壞 JSON 或不合 schema 一律 `false`，不丟錯

**Dispatch:** implementer, sonnet — 函式與測試都在計畫裡，照抄加跑測試。

- [ ] **Step 1: 先寫失敗的測試**

  `tests/shots-mobile.test.js`
  ```js
  'use strict';
  const test = require('node:test');
  const assert = require('node:assert/strict');
  const { mobileDeclared } = require('../lib/shots.js');

  const conf = (pages) => JSON.stringify({ pages, roles: [{ name: 'guest' }] });
  const page = (name, extra) => Object.assign({ name, url: 'http://127.0.0.1:9/' + name }, extra);

  // design-4: the design stage draws a phone mockup only where the project
  // declared a phone width in .fankeel/render.json.
  test('a page whose viewport is 480 wide or less declares a phone', () => {
      assert.equal(mobileDeclared(conf([page('home'), page('home-412', { viewport: '412,900' })])), true);
      assert.equal(mobileDeclared(conf([page('edge', { viewport: '480,900' })])), true);
  });

  test('no viewport, or only wider ones, declares none', () => {
      assert.equal(mobileDeclared(conf([page('home')])), false);
      assert.equal(mobileDeclared(conf([page('narrow-desktop', { viewport: '481,900' }), page('wide', { viewport: '1600,1000' })])), false);
      assert.equal(mobileDeclared(conf([page('themed', { theme: 'light' })])), false);
  });

  test('a missing, empty or broken render.json declares none and does not throw', () => {
      for (const bad of [undefined, '', 'not json', '{}', conf([page('x', { viewport: 'wide' })])]) {
          assert.equal(mobileDeclared(bad), false, String(bad));
      }
  });
  ```

- [ ] **Step 2: 跑，看它失敗**

  ```sh
  node --test tests/shots-mobile.test.js
  ```
  預期：`mobileDeclared is not a function`。

- [ ] **Step 3: 實作**

  在 `lib/shots.js` 的 `cells()`（結束於第 93 行附近）之後、`function pagesTouched` 之前加：

  `lib/shots.js`
  ```js
  // design-4: whether the project declared a phone. The design stage draws a
  // phone mockup only when this is true; fankeel lists 412,900 for its own phone pages.
  const PHONE_MAX = 480;
  function mobileDeclared(text) {
      let targets;
      try {
          targets = parseTargets(text);
      } catch {
          return false;
      }
      for (const look of targets.look.values()) {
          const width = look.viewport === undefined ? NaN : Number(String(look.viewport).split(',')[0]);
          if (width <= PHONE_MAX) return true;
      }
      return false;
  }

  ```

  並把匯出列改成：

  `lib/shots.js`
  ```js
  module.exports = { parseTargets, cells, mobileDeclared, pagesTouched, loadTargets, renderFileRefusal, nearestTargets, pagesReached, renderScope, realPath, verdictRefusal, NAME };
  ```

  注意 `parseTargets(undefined)` 會在 `JSON.parse` 前就丟錯被 `catch` 接住，回 `false`，這就是 `undefined` 那一條測試要的行為。

- [ ] **Step 4: 跑，看它通過，再跑鄰近測試**

  ```sh
  node --test tests/shots-mobile.test.js tests/shots.test.js
  ```
  預期：全過。再跑 `npx knip`，若報 `mobileDeclared` 未使用，在 `knip.json` 對應的 ignore 欄加上它。

- [ ] **Step 5: 提交**

  ```sh
  git add lib/shots.js tests/shots-mobile.test.js knip.json
  git commit -m "feat: shots.mobileDeclared reads a phone width out of render.json"
  ```

## Task 16: design 站依專案宣告決定要不要畫手機版

先查的結果（條目要求「先查」）：
- `agents/fankeel-mockup.md` 全檔沒有 `mobile`、`手機`、寬度、斷點字樣（只有 `:75` 的 `viewport`，那是 tune 筆記的捲動位置，不是畫幾個寬度）；它叫代理只取 `catalog/include.json` 的 `palette`、`type`、`app`、`direction` 四種（`agents/fankeel-mockup.md:29-31`），`in-ui-grid`（`include.json:2508-2511`，種類 `ui`，「手機 4 欄、平板 8 欄、桌面 12 欄……每個斷點都要測」）與 `in-ix-nav-choice`（`:2343`，種類 `ix`）不在其中。
- `skills/fankeel-design/SKILL.md:81-129` 步驟 3 規定一頁、`data-block`、用專案自己的 CSS，全篇沒有寬度規定。
- `skills/fankeel-design/design-guide.md:72`、`:75`、`:78` 只約束 CSS（不橫向捲動、窄版後備、觸控目標）。
結論：沒有東西「強制」畫手機版，但也沒有任何一句告訴代理「沒宣告就不畫」，代理看到 `ui` 條目或自己的習慣就可能多畫。本 task 把規則寫成明文，並用 Task 15 的 `mobileDeclared` 作為唯一判準。

**Files:**
- Modify: `skills/fankeel-design/SKILL.md:125-129` — 在「Work that puts nothing on a screen draws nothing, whatever the value.」之後加 Widths 段
- Modify: `agents/fankeel-mockup.md:62-64` — 在 `## Check it served` 之前加 `## Widths`
- Test: `tests/design-widths.test.js`

**Interfaces:**
- Consumes: `mobileDeclared(text)`（Task 15，`lib/shots.js`）
- Produces: 無（只動文字與測試）；派工 prompt 的新規則：「desktop only」或「also a phone at W,H」

**Dispatch:** implementer, sonnet — 兩段文字與測試都在計畫裡，照抄加跑測試；依賴 Task 15，排在它之後。

- [ ] **Step 1: 先寫失敗的測試**

  `tests/design-widths.test.js`
  ```js
  'use strict';
  const test = require('node:test');
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');

  const ROOT = path.join(__dirname, '..');
  const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

  // design-4: not every project has a phone screen; the design stage draws one
  // only where .fankeel/render.json declares a phone width.
  test('the design skill decides the width per project from render.json', () => {
      const design = flat('skills/fankeel-design/SKILL.md');
      assert.match(design, /\*\*Widths follow the project\.\*\*/);
      assert.match(design, /\.fankeel\/render\.json/);
      assert.match(design, /mobileDeclared/);
      assert.match(design, /480/);
      assert.match(design, /desktop width alone/);
      assert.match(design, /writes the answer into the prompt/);
      assert.doesNotMatch(design, /方向/);
      assert.doesNotMatch(design, /逐塊/);
  });

  test('the mockup agent draws one width unless the prompt names a phone', () => {
      const agent = flat('agents/fankeel-mockup.md');
      assert.match(agent, /^---.*## Widths /);
      assert.match(agent, /one frame at the desktop width/);
      assert.match(agent, /`ui` and `ix`/);
      assert.match(agent, /narrow fallbacks and touch targets are CSS only/);
      assert.ok(agent.indexOf('## Widths') < agent.indexOf('## Check it served'), 'Widths comes before Check it served');
  });
  ```

- [ ] **Step 2: 跑，看它失敗**

  ```sh
  node --test tests/design-widths.test.js
  ```
  預期：兩個測試都因找不到 `Widths follow the project` 與 `## Widths` 失敗。

- [ ] **Step 3: 改 design 的 SKILL.md**

  在 `skills/fankeel-design/SKILL.md` 找到這兩行（第 128-129 行）：

  `skills/fankeel-design/SKILL.md`
  ```md
  `xdg-open` elsewhere). Work that puts nothing on a screen draws nothing,
  whatever the value.
  ```

  把它們換成（後面多出的整段是新增）：

  `skills/fankeel-design/SKILL.md`
  ```md
  `xdg-open` elsewhere). Work that puts nothing on a screen draws nothing,
  whatever the value.

  **Widths follow the project.** Not every project has a phone screen, so the
  mockup is drawn at the desktop width alone unless the project declared a
  phone: `.fankeel/render.json` holds a page whose `viewport` is 480 pixels
  wide or less (fankeel's own file lists `412,900`). The session dispatching
  the mockup asks once, before it writes the prompt:
  `node -e "const f='.fankeel/render.json',fs=require('fs');console.log(fs.existsSync(f)&&require('<plugin>/lib/shots.js').mobileDeclared(fs.readFileSync(f,'utf8')))"`
  and writes the answer into the prompt, because no profile value or file
  reaches a subagent: `true` becomes "also draw a phone frame at the declared
  viewport width", `false` becomes "desktop only; draw no phone frame". A
  project with no `render.json` answers `false`. A task that is itself about
  the phone screen is the exception only when the user says so at the gate;
  say which way you decided, as for `class`.
  ```

- [ ] **Step 4: 改 mockup 代理檔**

  在 `agents/fankeel-mockup.md` 找到 `## Check it served` 這一行（第 64 行附近），在它前面插入：

  `agents/fankeel-mockup.md`
  ```md
  ## Widths

  Draw one frame at the desktop width, and a second frame at a phone width only
  when the prompt says "also draw a phone frame" and gives the width. A prompt
  that says "desktop only", or says nothing about width, gets no phone frame:
  the catalogue's `ui` and `ix` entries that mention phones, columns or
  breakpoints (`in-ui-grid`, `in-ix-nav-choice`) are not a reason to draw one.
  The guide's rules on narrow fallbacks and touch targets are CSS only, written
  into the page's own `<style>` for the blocks it changes; they never add a
  second frame. A phone frame, when asked for, is the same `data-block` names
  inside a second wrapper, so the tune overlay and the render reviewer point at
  the same names.

  ```

- [ ] **Step 5: 跑，看它通過，再跑相鄰測試**

  ```sh
  node --test tests/design-widths.test.js tests/design-guide.test.js tests/design-skill.test.js tests/design-catalog.test.js tests/design-lint.test.js
  ```
  預期：全過。若 `design-guide.test.js` 因 SKILL.md 的空白換行變動失敗，回頭檢查是否動到 `` `design.mockup: auto` `` 或 `` `design.skill` is a list `` 那兩句。

- [ ] **Step 6: 提交**

  ```sh
  node scripts/suite.js --fast
  git add skills/fankeel-design/SKILL.md agents/fankeel-mockup.md tests/design-widths.test.js
  git commit -m "feat: design draws a phone mockup only where render.json declares a phone"
  ```
  收尾（todo 收掉、發版、plugin update）屬 land；`design-4` 的完成標準「有測試或一次真實 design 證明」由 `tests/design-widths.test.js` 與 `tests/shots-mobile.test.js` 滿足，land 時再用 `node scripts/todo.js done design-4 --sha <sha>`。

## Task 17: 在真 gate 上標記、送出、確認 hooks/gate.js 收到（entry-4 第二步）

**Files:**
- Modify: `docs/90-agent/todo/entry-4.md` — 驗完後在檔尾加一行驗證紀錄

**Interfaces:**
- Consumes: Task 11 已落地（focus 頁畫得出來）；一個停在 gate、報告含 mermaid 圖的真 session
- Produces: `.fankeel/build/render/entry-4/before.png`、`marked.png`；該 session 的 `<stage>-answer.md` 內有「標記：」行；entry-4.md 的一行紀錄

**Dispatch:** user — 這一步要在真瀏覽器按「送出答案」，再看 hooks/gate.js 寫下的答案檔；沒有子 agent 能代按。

- [ ] **Step 1: 找到 session 與網址**

要有一個正停在 gate、報告裡有 ```mermaid 圖的 session（沒有的話請那個 session 在報告貼一張 flowchart）。station 要在跑（預設埠 28888，`node scripts/station.js serve`）。在 repo 根目錄：

```bash
SID=$(ls -t .fankeel/sessions/*.json | head -1 | xargs basename -s .json)
echo "http://127.0.0.1:28888/f/$SID/gate"
```

最新的檔案不是那個 gate 的 session 時，自己把 `SID` 設成它的 id（頁首右邊顯示前 8 碼）。

- [ ] **Step 2: 用 render.js 點一個節點並拍照**

```bash
mkdir -p .fankeel/build/render/entry-4
echo '[{"wait":3000},{"shot":"before"},{"click":".gt-main [data-mermaid][data-drawn] .pele-node[data-id]"},{"wait":500},{"shot":"marked"}]' > .fankeel/build/render/entry-4/mark.json
FANKEEL_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe' node scripts/render.js "http://127.0.0.1:28888/f/$SID/gate" --act .fankeel/build/render/entry-4/mark.json --out .fankeel/build/render/entry-4
```

看 `marked.png`：右欄答案框應該多一行 `標記：<id>「<label>」`，被點的節點有外框與 id 標籤；`before.png` 應該畫出題目與圖（不是空白）。

- [ ] **Step 3: 在自己的瀏覽器標記並送出**

自己的瀏覽器開同一個網址，點圖上一個節點，確認答案框出現「標記：」行，再按「送出答案」。

- [ ] **Step 4: 確認 hooks/gate.js 收到**

```bash
grep -n "標記：" .fankeel/build/task-*/*-answer.md
```

應該印出剛才那一行，檔名是該 stage 的 `<stage>-answer.md`。

- [ ] **Step 5: 記進 entry-4**

Step 2 的截圖與 Step 4 的 grep 都對，才加這一行；有一項不對就不要加，把看到的情況回報：

```bash
printf '\n%s verify：真 gate 上點 node 後答案框出現「標記：」行，送出後 hooks/gate.js 寫下的 <stage>-answer.md 收到該行（.fankeel/build/render/entry-4/marked.png）；第二步完成。\n' "$(date +%F)" >> docs/90-agent/todo/entry-4.md
git add docs/90-agent/todo/entry-4.md
git commit -m "docs: entry-4 step 2 verified on a real gate (標記 line reaches hooks/gate.js)"
```

## Task 18: 真手機上看圖、點節點、確認答案框有「標記：」行（station-66 完成標準）

**Files:**
- Modify: `docs/90-agent/todo/station-66.md` — 驗完後在檔尾加一行驗證紀錄

**Interfaces:**
- Consumes: Task 12、13 已落地；手機已配對 `/m`（station.remote 開著）；一個停在 gate、報告含 mermaid 圖的真 session
- Produces: station-66.md 的一行紀錄

**Dispatch:** user — 觸控平移、雙指縮放與 `.cv` 捲動只有真手機才看得到。

- [ ] **Step 1: 開手機畫面**

手機開 `/m`，進那個 gate 的 session（#/s/<id>，對話）。gate 卡片上方應有「報告裡的流程圖」一塊，裡面是圖；沒有圖就停在這裡回報（先看 `/station/phone.json?id=<id>` 回應有沒有 `diagrams`）。

- [ ] **Step 2: 圖與標記**

單指拖圖能平移、雙指能縮放、頁面仍能捲到下面的選項；點一個節點，節點有外框與 id 標籤，答案欄「自己寫答案」出現 `標記：<id>「<label>」` 並被勾選；再點一次取消，那一行消失。

- [ ] **Step 3: 記進 station-66**

三項都對才加這一行；有一項不對就不要加，把看到的情況回報：

```bash
printf '\n%s verify：真手機上 gate 畫面畫出報告的 mermaid 圖，點節點後「自己寫答案」出現「標記：」行、再點取消；單指平移、雙指縮放正常。\n' "$(date +%F)" >> docs/90-agent/todo/station-66.md
git add docs/90-agent/todo/station-66.md
git commit -m "docs: station-66 verified on a real phone"
```

