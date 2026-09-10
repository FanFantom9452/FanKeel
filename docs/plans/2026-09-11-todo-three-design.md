---
status: design-intent
last_verified: 2026-09-11
source_of_truth: this file is the design; docs/documents.md, docs/subagents.md, skills/fankeel/SKILL.md, scripts/docs-audit.js and the two test files are what ships
---

# 暫存區、三對重述、source_of_truth — 設計

三件事，一個共同的形狀：**這個 repo 有三處靠記憶維持的正確性，各給它一個會紅的檢查
或一個指標**。`lib/registry.js:31` 已經把這句話寫在程式碼裡了——「a cap that depends
on being remembered is not a cap」。

## 0. survey 查到的，這份設計據以成立

- `lib/tracked.js:30` — `git ls-files -z --cached --others --exclude-standard`。
  `scripts/docs-check.js:329`、`scripts/docs-audit.js:332`、`scripts/layout.js`
  三支全部走它。
- `.fankeel/.gitignore:3` — `build/`。所以 `.fankeel/build/`（7.8M、43 個項目）
  對上面三支都不存在。
- `lib/docs.js:186` — `if (!p.startsWith(b.path + '/')) continue;`，bucket 是純字串
  前綴比對，`docs/` 以外可以宣告（`skills`、`evals`、`agents`、`.claude/agents` 為證）。
- `lib/registry.js:45` — `const MAX_CLAIMS = 60;`，`:640` `claims.slice(-MAX_CLAIMS)`。
- `scripts/docs-audit.js:776-785` — 明文把 pairs、orphans、uncovered、undeclared
  排除在 exit code 之外：「Pairs, orphans, uncovered directories and the undeclared
  count are context」。
- `docs/documents.md:161` — 「Two pages describing one file is only a defect when
  neither defers.」

> **補記（同日，gate 之後）**：本檔 `unverified` 那一行說 `residue.js` 的 ignored
> 清單「依大小門檻」列出，這是錯的。`scripts/residue.js:271-286` 的 `weight`
> 對 `git ls-files --others --ignored --exclude-standard --directory` 回的每一個
> 頂層路徑都給一列，唯一的過濾是丟掉被 ignore 父目錄含住的子項，沒有任何門檻。
> 這對第 1 節的測試是好消息——它看得見每一個新增的被 ignore 頂層路徑。原句留著，
> 因為那是 gate 當下的認知。

**由上面第一、二、三條共同推出的結論**：把 `.fankeel/build` 加進 `.fankeel/docs.json`
的 buckets 是死路。路徑合法，但那個 bucket 永遠列出零個檔，因為列檔的那一層根本
拿不到 gitignore 的路徑。所以宣告只能是散文加一條測試，不能是 bucket。

## 1. 暫存區那張表補上它缺的三樣

> **更正（同日，gate 之後，寫 plan 時發現）**：本節原本寫的是「`docs/documents.md`
> 新增一節『The half that is not committed』」，那是錯的。`docs/documents.md:121`
> 的 `## `.fankeel/` 各區的壽命` 早就在了——七列表格，`build/`、`sessions/`、
> `map.md`、`index.html`、`station/` 全部有列，`5ffd045` 加的。survey 的三個
> reader 沒有一個點名它，我也沒在下筆前讀那一節。範圍因此從「新增一節」縮成
> 「補三樣」，下面是修正後的承諾。原文不留在正文裡，因為它會被 plan 的
> coverage 表照抄成待辦。

- `docs/documents.md:121` 那一節補一段話，說明為什麼這幾區不能是
  `.fankeel/docs.json` 的 bucket：`lib/tracked.js:30` 的
  `git ls-files --exclude-standard`，而 `scripts/docs-check.js:329`、
  `scripts/docs-audit.js:332`、`scripts/layout.js` 三支都走它。沒有這段，
  下一個人會再試一次那條死路——這次就是。
- `build/<plan>/`、`build/ask/` 那一列的說明補上 `mockup.html`。該列現在寫
  「ledger、brief、judge brief」，`mockup.html` 是 2026-09-10 才加的第四種，
  那一列寫成的時候還不存在。
- 那一節指向 `node scripts/residue.js` 作為活的清單，並說明分工：表格給角色，
  `residue.js` 給當下有哪些與多大。
- 不新開頁面、不改 `README.md`：`docs/documents.md:213-217` 自己寫著「A new
  document is the last resort: use an existing page」；而 `624bdbb` 五個 commit
  前才把 README 收成前頁。`scripts/layout.js` 那張 13 列骨架仍未填，
  **本計畫不填**——它是另一件事，範圍是整棵樹不是暫存區。

## 2. 三對重述各補一個指標，不刪句子

- `skills/fankeel/SKILL.md:98` 的 60 上限那段末尾補一句指向
  `docs/registry.md`，形式照這份 SKILL 已經用了六次的「this section is the short
  form, not the only copy」。擁有者是 `docs/registry.md`，因為 `lib/registry.js`
  在它的 `source_of_truth` 裡而不在 SKILL 的。
- `docs/subagents.md:287` 的自派工盲點補一句指向 `docs/collisions.md`。擁有者是
  `docs/collisions.md`：`lib/guard.js` 在它的 `source_of_truth:4` 裡。
  `docs/collisions.md:169` 已有的那條連結指的是 mitigation，不是這個事實，
  所以那條不動，這是另一條。
- `docs/subagents.md:67` 的 `judge.js record` 那段補一句指向
  `skills/fankeel-ask/SKILL.md`。`:60-62` 已有的「the skill carries the whole
  procedure from there」在重述**之前**，攔不住後面那段——新指標放在重述之後。
- 三處都是加句子。`scripts/docs-check.js` 在改動後仍需綠燈，因為每個新指標都是
  一條會被解析的連結。

## 3. `docs/README.md` 的頁數有東西在數

- `tests/contract.test.js` 新增一條 test，形狀抄 `:301`「the pages that count the
  hooks count as many as are registered」：從活來源導出數字、轉成英文字、
  `assert.match` 散文。
- 活來源是 `docs/` 深度一的 `.md` 減掉 `README.md` 自己。今天是 12
  （13 減 1），與 `docs/README.md:9` 的「Twelve pages」相符。
- 數的是檔案不是表格列：那張索引表從第 13 行起是一整塊連續 row，而且索引到
  `archive/`、`plans/` 等子目錄的頁，列數遠多於 12。這一句寫進 test 的註解，
  因為下一個人第一個念頭會是數 row。
- 這條 test 要先看它紅：把「Twelve」改成「Eleven」跑一次，確認它抓得到，再改回來。

## 4. `source_of_truth`：不設單一擁有者，只把解析不掉的印出來

- **不設單一擁有者。** `lib/stages.js` 被 12 個 reference 頁宣告，
  `lib/render.js` 被 7 個——那是這條 pipeline 的核心檔，多頁描述它是設計本身
  不是缺陷。`docs/documents.md:161` 已經把判準寫對了：兩頁描述同一個檔，
  只有在兩邊都不讓路時才是缺陷。所以要修的是那三對（第 2 節），不是 26 這個數字。
- **`scripts/docs-audit.js` 的 `declaredPaths()` 現在把解析不掉的條目靜靜丟掉**
  （`:290-299`）。改成收集起來，在 context 區印一行——不進 exit code，
  與 pairs、orphans、uncovered 同一類，`:776-785` 那段註解一併加上這一項。
- 理由是這個：現在一個打錯字的路徑跟一句合法的散文長得一模一樣，兩者都是零聲音。
  印出來之後，「這頁的 source_of_truth 指向一個不存在的檔」變成看得見的。
- reference 角色內的散文恰好 5 筆，全部合法（`docs/README.md:4`、
  `docs/sources.md:4`、三個 `output-styles/*.md:7`）。所以這一行的預期輸出
  **不是零**，這寫進 test，否則下一個人會把 5 當成待修的 5 筆。
- `docs/documents.md` 的 `source_of_truth` 那一段記下「不設單一擁有者」與理由，
  一句，因為這是一個被問過並回答過的決定。

## 5. 三條 TODO 條目關掉

- `## Ready` 兩條（collisions 三處、README 頁數）在各自的工作落地的同一個
  change 裡移除。
- `## Needs a decision` 一條（`source_of_truth`）在第 4 節落地時移除。
- `node scripts/todo-check.js` 綠燈。

## Summary

三處靠記憶維持的正確性各得到一個檢查或一個指標：既有的壽命表補上「為什麼不能是
bucket」與一條會紅的測試，三對互相轉述的段落各有了一個方向明確的指標，頁數有了
一個會紅的 test，而 `source_of_truth` 不新增擁有權規則、只讓靜靜丟掉的條目出聲。

兩條新測試今天都是綠的——「Twelve」現在正確，壽命表現在也齊。它們是防漂移的守衛，
所以**紅要用突變證明**，不是用今天的紅證明。`## Verification` 寫了各自的突變。

## Verification

- `node --test tests/` 全綠。
- 第 3 節與第 1 節的兩條新 test 各自看過一次紅：第 3 節把「Twelve」改成
  「Eleven」，第 1 節把 `docs/documents.md` 新表裡的 `.fankeel/build/` 那列刪掉。
- `node scripts/docs-check.js`、`node scripts/docs-audit.js`、
  `node scripts/todo-check.js` 三支綠燈。
- `docs-audit.js` 的新 context 行印出 5，且與 `declaredPaths()` 實際丟掉的
  條目數相符——兩個數字來自同一個來源，要對得上。
