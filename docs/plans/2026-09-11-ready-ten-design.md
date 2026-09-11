---
status: design-intent
---

# TODO.md `## Ready` 十條 — 設計

**Goal:** 清掉 `TODO.md` 的 `## Ready` 十條。十行條目在最後一個 task 一起刪：每個 task 都改 `TODO.md` 的話，它們就共用這個檔，整份 plan 只能一條一條跑。

**Architecture:** 十條收成八個改動單元：#2 與 #3 是同一張圖，#7 與 #8 是同一個函式，其餘各自獨立。每條都縮到它最小的那個改動；唯一新增的資料是 registry 的 `moves` 欄位，它也是這個任務升到 architectural 的原因——`adopt`、`task` 改名、`hooks/leave.js` 與 station 都讀同一份紀錄。

**基準:** `35ccf54`，porcelain 空，數字記在 `.fankeel/build/2026-09-11-ready-ten/baseline.txt`：`docs-check` 對 #1 的四條印 `carries no quote`；`sweep()` 的 `overlaps` 45 組，`skills/fankeel/SKILL.md` 佔 8 組；`landed` 0；`pagesByStatus` 為 current 121、intent 5、retired 35、undeclared 8。`npm test` 的基準在 plan 階段量。

## 1. 四條引文補在同一行（#1）

- `docs/collisions.md:140`、`:143`、`:157` 與 `docs/documents.md:326` 各在 citation **之後**、同一行內補一個反引號引文，內容取自被引那一行的原文。`quoteBeside`（`scripts/docs-check.js:182`）只從 citation 結尾往行尾找，所以 `:143` 那種寫在 citation 前面的 `isLive` 不算數。
- 引文與 citation 不得被硬換行拆開；補完後段落要重排時，換行點落在它們之外。
- `TODO.md` 裡另有 5 條同類。4 條就在本任務的 Ready 條目裡，隨條目刪除消失；第 5 條在 `## Waiting`，不動。

## 2. 稽核那張圖（#2、#3）

- `docs/pipeline.md:695` 的 `E2 --> F` 改成 `E2 --> F2`。F 是「打開兩份、找各自的主張」，只對 E1 的 pairs 成立；E2 是單份文件的缺席，和 E3、E4 一樣交給 F2。
- E2 的標籤（`:674`）補上 uncovered directories：`unfiled · undeclared ·<br/>linked from nowhere ·<br/>directories no page names`。`skills/fankeel/SKILL.md` 的表也把 orphans 與 uncovered 合成一列，理由相同：兩者都是「沒有東西指著它」。
- class 那張圖（`:394`、`:418`）不動。

## 3. sweep 類別表的守衛讀兩頁（#4）

- `tests/docs-audit.test.js:532` 那支測試對兩頁各跑一次同一組斷言：`skills/fankeel/SKILL.md` 與 `skills/fankeel-audit/SKILL.md`。共用的是 `keys` 與 `BOOKKEEPING`。
- 每頁一張自己的 `ROW` 對照與自己的錨點，因為兩頁措辭不同。前者錨在 `| | |` 到 `Only the first four fail the run.`；後者錨在 `| Section | Defect | What it means |` 到 `## The part only reading finds`，列名是 `**fallen behind the code they describe**`、`**plans look landed**`、`**index**`、`**diagrams behind their directory**`、`**pairs describing the same code**`、`**linked from nowhere**`、`**directories with no reference document**`、`**unfiled**`、`**undeclared**`、`**unresolved source_of_truth**`。
- 兩張表今天都列全了十個類別，不改表。新測今天就綠，它證明的是守衛的範圍：刪掉第二頁任一列會變紅，今天同樣的刪除仍然綠。

## 4. SKILL.md 宣告它延後給的四頁（#5）

- `skills/fankeel/SKILL.md:7` 的 `source_of_truth` 加上 `docs/collisions.md, docs/registry.md, docs/station.md, docs/statusline.md`。SKILL.md 在 `:97`、`:103`、`:135`、`:586`、`:642`、`:434` 以散文把細節交給這四頁。
- `docs/documents.md` 不加：它自己的 `source_of_truth`（`docs/documents.md:4`）已經宣告 SKILL.md，`defers()` 兩個方向都認（`scripts/docs-audit.js:448`）。
- `.md` 條目不會變成 drift 的主題（`scripts/docs-audit.js:271-274`），所以這個改動不會多出 drift。
- 另外四組（`docs/improvement-brief.md`、`docs/pipeline.md`、`skills/fankeel-survey/SKILL.md`、`docs/subagents.md`）不是延後關係，不宣告，照舊留在 pairs。

## 5. 刪掉的檔不算未建（#6）

- `sweep()` 在跑 landed 之前，用與 `dateSource`（`scripts/docs-audit.js:113`）同一種呼叫方式取一次 git 的刪檔紀錄（`git log --diff-filter=D --name-only --format= --no-renames`），路徑相對於 root，得到一個 Set。
- landed 的判斷（`scripts/docs-audit.js:524`）改成：`unbuilt` 扣掉這個 Set 之後仍非空才跳過。`pointsAt()` 不動，`unbuilt` 仍然是「現在不在」，改的只是 landed 怎麼讀它。
- 不在 git 裡的專案、或 git 呼叫失敗，一律得到空 Set，行為與今天相同。
- 取捨：一個被刪掉、之後又被新 plan 計畫重建的檔，會被當成已刪而不是未建，那份 plan 可能提早被提議歸檔。歸檔要在 `land` 經過詢問，所以判錯的代價是一個多餘的提議。

## 6. archive 桶一律 retired，retired 按桶列（#7、#8）

- `pagesByStatus()`（`lib/map.js:233`）在讀 frontmatter 之前，把 role 為 `archive` 的頁直接放進 `retired`，寫法比照 `:263` 的 fixture 分支。今天 archive 桶的 59 頁裡，20 頁 current、4 頁 design-intent 都沒進 retired。
- `buildMap()` 的 retired 段改成：每個 archive 桶印一行（`docs/archive — 59, the whole archive bucket`），只有不在 archive 桶裡的 retired 頁才逐頁列出（今天 0 頁）。retired 從此不再被 `MAX_PAGES` 截斷。
- `documents:` 那一行補上每個狀態的計數，加總等於總數。只有在沒有任何清單被截斷時，它才多印一句「a page named nowhere below is current」；有清單被截斷時這句不成立，所以不印。
- 文件跟著改：`skills/fankeel-survey/SKILL.md:95-104`（map 持有什麼、retired 段）、`docs/pipeline.md:798-802`（map 範例）、`docs/documents.md` 講 `pagesByStatus` 的那段。

## 7. 階段移動的紀錄 `moves`（#9）

- `touch()`（`lib/registry.js:430`）在寫 `clock` 的同一處，當 `moves` 最後一筆的 stage 不等於 `data.stage` 時，追加 `[data.stage, at]`。只記轉換，不是每次 touch 都記；因此每個 stage 第一次出現的那筆時間等於 `clock[stage][0]`。
- 上限 `MAX_MOVES = 60`，超過時丟最舊的，寫法與 `MAX_CLAIMS`（`lib/registry.js:640`）相同。
- `task.js task`（改名）把 `moves` 加進刪除清單（`scripts/task.js:655-668`），理由同 `clock`：stage 名稱會再出現。
- `task.js adopt` 把每一筆時間平移 `at − Date.parse(source.updated)`，保留順序與間隔，去掉來源閒置的那一段，理由同 `clock` 的「距離，新原點」（`scripts/task.js:867-871`）。
- 既有欄位一個都不動，station 也不讀 `moves`；怎麼畫是 `## Needs a decision` 那條〔station〕的事。
- 文件跟著改：`docs/registry.md` 的 What a stage cost 加一段 `moves`；`skills/fankeel/SKILL.md:111` 的 `Ten more` 改 `Eleven more`、「the six below」改 seven，`:138` 的 `An eleventh` 改 `A twelfth`。

## 8. `judge.js record` 拒收空答案（#10）

- `record()`（`scripts/judge.js:68`）讀完答案後，`answer.trim()` 為空就 `fail(...)` 並 exit 1，而且在 `mkdirSync` 之前發生：不建目錄、不寫檔、不動索引。
- 錯誤訊息指出答案該去哪裡找：背景 judge 的答案在 `<session>/subagents/agent-<id>.jsonl` 的最後一則 assistant 訊息；`tasks/<id>.output` 是 0 bytes（`docs/decisions/2026-09-11-todo-split.md:37-43`）。
- `skills/fankeel-ask/SKILL.md` 第 3 步加上同一句。

## What proves it done

| 主張 | 證據 |
|---|---|
| 四條引文有人檢查 | `node scripts/docs-check.js` 對 `docs/collisions.md`、`docs/documents.md` 的 `carries no quote` 從 4 行變 0 行 |
| 稽核圖的 E2 走 F2，且有 uncovered | 在 `docs/pipeline.md` 的 audit 區塊 grep `E2 --> F2` 與 `directories no page names`，今天 0 筆 |
| 第二頁的表也被守著 | 刪掉 `skills/fankeel-audit/SKILL.md` 表的一列，新測變紅；今天做同樣的刪除仍然綠 |
| SKILL.md 不再和延後的四頁成對 | 對本庫 live 跑 `sweep()`：SKILL.md 的 pairs 從 8 組變 4 組，`overlaps` 從 45 變 41 |
| 刪掉的檔不擋 landed | `tests/docs-audit.test.js` 新測（tmp 目錄 `git init`、提交、刪檔、再提交）今天紅 |
| archive 頁不進 planned | `tests/map.test.js` 新測今天紅；live map 的 `planned, not built — 1` |
| map 的每一頁都有狀態 | 產出物自查：`documents:` 行各狀態的計數加總等於總數，retired 段那一行的 59 等於 archive 桶的 markdown 檔數 |
| `moves` 記下轉換 | `tests/registry.test.js`、`tests/task.test.js` 的新測（touch 跨 stage、改名清掉、adopt 平移）今天紅；產出物自查：每個 stage 在 `moves` 第一次出現的時間等於 `clock[stage][0]` |
| 空答案被拒 | `tests/judge.test.js` 新測（空字串、只有空白與換行，兩者都 exit 1、`docs/judgements/` 下沒有新檔）今天紅 |
| 沒弄壞既有的東西 | `npm test` 仍是 `ℹ fail 0`，通過數不低於 plan 階段量到的基準 |
