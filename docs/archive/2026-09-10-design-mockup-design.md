---
status: current
last_verified: 2026-09-10
source_of_truth: lib/profile.js, lib/stages.js, lib/render.js, skills/fankeel-design/SKILL.md
---

# design 的 mockup 步驟 — 設計

前端任務的 design 產物今天是「一個 approach 加成功準則」，而使用者核准的是畫面不是段落。
這份設計在 design 加一步 mockup，並且用**一個** profile 鍵同時回答「這個專案要不要這一步」
與「這一步吃什麼模型」。

## survey 量到的底（前提，不是承諾）

- `holds()`（`lib/stages.js:137-142`）讀的是 `values[key]`，而 `rulesFor` 的 values
  預設是 `profile.read().values`（`:555`），`render.js:132` 傳進去的也只有
  `profile.values`。**`when` 的鍵只能是 profile 鍵。**
- `parseValue`（`lib/profile.js:56-63`）把 `'false'` 轉成布林 `false`，其餘值留成字串；
  `holds()` 把布林 `false` 與字串 `'false'` 都當關。**所以一個鍵可以同時是開關與值。**
- design 的注入今天是 **2164** 字元，上限 2400（`tests/render.test.js:543`）——七個 stage
  裡最寬的一個。audit 只剩 3。
- `template` 不經過 `when` 過濾。加在 template 的槽，沒有前端的專案也要付。
- `renderBrief({mine, agentType})`（`lib/render.js:359`）沒有 profile 參數，
  `hooks/brief.js:39` 也只傳這兩個。**沒有任何 profile 值到得了 subagent。**
- 沒有任何程式碼強制模型選擇：`dispatch.floor` 只有 skill 散文讀它
  （`TODO.md:65`、`docs/decisions/2026-09-09-profile-judge-reader.md:69`），
  `scripts/judge.js:79` 的模型來自 CLI 旗標不是 profile。這個新鍵繼承同一個缺口。
- `mockup` 全 repo 只命中 `docs/improvement-brief.md:588` 一行文件、零程式碼。
  `dispatch`、`sonnet` 在 `docs/plans/2026-09-09-design-class-prompt.md` 與
  `docs/reports/2026-09-09-design-axis-inventory.md` 裡零命中——模型這件事是新的。

## 1. `design.mockup` — 一個鍵，兩件事

per-project 的問題是「這個專案有前端嗎」，那正好是 profile 的形狀。per-task 的問題是
「這個**任務**是不是前端」，那留在規則的散文裡，跟 `class` 一樣是說出來讓人推翻的判斷。

- `lib/profile.js` 的 `KEYS` 加一列：
  `'design.mockup': { values: ['false', 'sonnet', 'opus', 'fable'], builtin: false }`
- `summary()`（`lib/profile.js:145`）硬寫的 `['guard', 'dispatch.floor', 'judge.model']`
  加上 `design.mockup`，否則它永遠不顯示為非內建值
- `parseValue` 與 `read()` 一行都不改——現有的轉換規則已經給出想要的語意
- 內建值是 `false`：沒人開就沒有專案付這段字元，fankeel 自己（無 UI）維持關閉

內建為什麼不是 `opus`：一個預設開啟的步驟會讓每個後端專案的 design 都多付一段字元，
而它們永遠不會用到。內建為什麼不是 `sonnet`：那是 `dispatch.floor` 的值，而這個鍵存在的
理由就是視覺設計不該吃那個 floor。開啟時建議 `opus`——
`docs/plans/2026-09-09-design-class-prompt.md:269` 把實作交給 Opus，而 mockup 是實作
產物；`fable` 是寫作與判斷層，那是 `judge.model` 內建 `fable` 的理由。

## 2. design 的 `when` 條目

- `lib/stages.js` 的 design 物件加 `when: [{ when: 'design.mockup', text: <下面那條> }]`
- 該 stage 的 `rules` 陣列與 `template` **一個字都不動**
- 規則文字要說四件事：什麼時候做、產物寫到哪、用 `design.mockup` 指名的模型派一個
  implementer、把那個路徑寫在 `spec:` 行上。草稿（188 字元，量過再定稿）：

  > Frontend work gets a mockup first: one page at the model `design.mockup`
  > names, saved under `.fankeel/build/`, its path on the `spec:` line — the
  > gate approves the page, not the paragraph.

- 產物路徑是 `.fankeel/build/<date>-<topic>/mockup.html`——design 跑在 plan 之前，
  所以那一刻還沒有 ledger 目錄（`lib/ledger.js:48-50` 從 plan 的 basename 推它），
  而 `bounded` 連 design 檔與 plan 檔都不會有；能知道的是那個 stem，有檔的時候
  design 檔、plan 檔與 ledger 目錄共用它，沒檔的時候從日期與題目直接取
- **字元預算**：開啟時 design 的注入必須 < 2400。今天 2164，餘 235。規則寫完先跑
  `node --test tests/render.test.js` 讀它印出來的診斷行；不夠就把一句理由挪進 skill，
  不是提高上限——`tests/render.test.js:506-527` 說明為什麼第四次提高不該發生
- 路徑寫在 `spec:` 行而不是新增一個 `mockup:` 槽，因為 template 不受 `when` 過濾

`land` 從此不再是唯一有 `when` 的 stage。這是這次改動裡唯一動到別處依賴的介面的地方，
也是這個任務被歸為 architectural 的理由。

## 3. `fankeel-design` 的新一步

- `skills/fankeel-design/SKILL.md` 在第 2 步「One approach」與第 3 步「The success
  criterion」之間插入新的一步，其餘步驟編號後推（原第 3 步起變第 4 步起）
- 新步驟要寫：判準（怎麼認定這個任務是前端工作）、產物長什麼樣（一頁 HTML，涵蓋
  approach 影響到的畫面）、可以抓哪些已安裝的設計 skill、dispatch 行怎麼寫、
  gate 的 option one 要指向那個檔案
- 「The gate never scales down」那節加一句：mockup 是核准的對象，不是附件
- 「Not a defect」表加一列：後端任務的 design 沒有 mockup 不是漏做
- **本檔的 survey 那節已經記下**：subagent 拿不到 `design.mockup` 的值，所以派它的 session
  必須把模型與路徑寫進 prompt。這一步的文字要明說這件事

## 4. 測試

- `tests/profile.test.js`：新鍵在 `KEYS`、四個值都被接受、`'off'` 之類被拒、
  內建是 `false`、出現在 `summary()` 的輸出裡
- `tests/stages.test.js`：`rulesFor('design', null, { 'design.mockup': 'opus' })`
  含 mockup 規則；`{ 'design.mockup': false }` 不含；design 的 `template` 未變長
- `tests/render.test.js`：`PROFILES` 的六鍵 fixture 改七鍵，開與關兩種都量，
  上限斷言本身不動

## 5. 文件

- `docs/pipeline.md`：design 那節描述新步驟；`when` 的說明從「只有 land」改成兩個使用者
- `TODO.md`：拿掉 `## Ready` 第一條（design 的 mockup 步驟）

## 成功準則

- **會失敗的測試**：`tests/stages.test.js` 的新測試——開啟時 design 的規則含 mockup
  規則、關閉時不含。今天兩邊都不含，所以現在是紅的。
- **artefact 那條**：`node --test tests/render.test.js` 的 design 診斷行，在第七個鍵
  設為 `opus` 時仍 < 2400。讀那支測試印出來的數字，不是引本檔的 235——本檔的數字量於
  2026-09-10，下一個 commit 就可能讓它過期。

## 不做的事

- 不讓 `when` 讀 task-level 的值。那是簡報 §2.2 的條件載入矩陣，今天卡在 `## Waiting`、
  等 registry.json 落地；在這裡動它會前攔一個已經排好的項目，也會動到 `land` 依賴的介面。
- 不做觸發軸（frontend / backend / docs 的第三個維度）。另開一個 cycle。
- 不實作 `docs/plans/2026-09-09-design-class-prompt.md` 的 design class。那份是
  design-intent，範圍比這裡大得多；這份設計不牴觸它，也不預先決定它。
- 不給模型選擇加程式碼強制。`dispatch.floor` 的同一個缺口在 `TODO.md` 底下
  `## Needs a decision`，那條落地時這個鍵一起受惠。

## 未驗證

派一個 implementer 產出「可看的」mockup HTML，這件事沒有實測過一次。`renderBrief` 不帶
profile，所以模型與路徑都得由派它的 session 寫進 prompt，而那條路徑是否足夠，只有跑過
一次前端任務才知道。build 的第一個真實案例就是這條的檢驗。
