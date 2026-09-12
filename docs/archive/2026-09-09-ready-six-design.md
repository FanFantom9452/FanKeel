---
status: current
---

# TODO.md `## Ready` 六條 — 設計

**Goal:** 清掉 `TODO.md` 的 `## Ready` 六條，外加盤點時發現的一個 `docs-check` 差一行。

**Architecture:** 六條彼此不相干，共用的只有「都是這個 repo 讀得到的既有流程」。做法是把每條縮到它最小的那個改動：一端缺的驗證補上、一個 flag 加上、一個空元素去掉、一句措辭補回並加測試守著、四份已落地的 plan 封存、兩頁補上 Scope、一組兩臂重跑。

**基準:** `b0e68a6`，`ℹ pass 1223 / fail 0`，記錄在 `.fankeel/build/ready-six/baseline-test.txt`。`node scripts/docs-check.js` 今天 exit 1，10 條 `past-end`。

## 1. `cleared` 兩端同一條規則

- `assets/station/index.html:30` 只把通過 `/^\d+$/` 的 `cleared` 串進 data script 的 `src`，其餘一律丟掉；今天它把整個 `location.search` 原樣接上去，構造過的查詢字串可以閉合 `src` 的引號並注入標記。
- 保留 `document.write`：動態插入的 script 預設 `async`，而 `station.js` 是 parser-inserted，換成 `createElement` 會失去「資料先於 `station.js`」這個順序保證。`TODO.md` 提的 `createElement` 加 `setAttribute` 因此不採用。
- serve 模式不受影響：`scripts/station.js:453` 轉址到 `/?cleared=N`，`:354` 仍讀得到 `?cleared=N`，`:355` 的 `/^\d+$/` 原本就在，這一條是把同一條規則補到客戶端。

## 2. `map.js` 的只印不寫

- `parseArgs` 多宣告一個 boolean flag `print`。
- `--print` 時 `main()` 直接回傳 `buildMap(root)`，不 `mkdirSync`、不 `ensureIgnored`、不 `writeFileSync`；`buildMap` 早就是純函式（`lib/map.js:277`），要分離的東西已經分離好了。
- 沒有 `--print` 時的行為一字不動，包含它印的那段摘要。

## 3. `lineCount` 的檔尾空元素

- `linesOf`（`scripts/docs-check.js:136`）在最後一個元素是空字串時去掉它；今天 `text.split('\n')` 讓以換行結尾的檔案多算一行。
- 這是訊息修正而不是新判定：以修好的複本掃過全庫，唯一差異是 `ends at 491` 變 `ends at 490`、`ends at 568` 變 `ends at 567`，沒有任何新的 `past-end` 冒出來。
- 因此新測必須用 fixture 造一個指向 N+1 行的引用，不能靠現有文件。

## 4. `pipeline.md` 的 `verify` 節點

- `docs/pipeline.md:570` 的 `D2` 補回 `lib/stages.js:301` 有而它沒有的措辭，其中最實質的是 `the chain is one workflow`。
- 新增一支測試守著七個 stage：從 `### <stage>` 取到下一個 `### `，斷言一句取自該 stage 規則的錨句出現在該段內。
- `audit` 是同一種缺陷的第二個實例，寫計畫時逐句比對才發現：它的圖把規則每一條都改寫過，沒有一句原文。`docs/pipeline.md:607` 的 `docs-check` 節點寫 `every reference still resolves`，掉的是規則 `dead references, never opinions` 的後半 — 而那半才是掃描器與人工判斷的分界。一併補上，所以那支測試今天有兩格紅而不是一格。

## 5. 四份已落地的 plan 封存

- `docs/plans/2026-09-07-ready-fourteen{,-design}.md` 與 `docs/plans/2026-09-08-station-shell{,-design}.md` 四份 `git mv` 進 `docs/archive/`。
- `docs/README.md` 的四列索引改指 `archive/`；索引是手動維護的，移檔不改索引就是製造死連結。
- `scripts/docs-check.js:196` 對 `archive` 直接 return，所以十個 `past-end` 一次全清，`node scripts/docs-check.js` 從 exit 1 變 exit 0。

## 6. 兩頁補上 Scope

- `docs/improvement-brief.md:171` 與 `docs/README.md:65` 各補一句，說明所引數字的目標檔案在提示裡是否已命名。
- 其餘八處經查已經寫了，不動：`docs/README.md:64`、`docs/subagents.md`、`skills/fankeel/SKILL.md`、`skills/fankeel-verify/SKILL.md`、`skills/fankeel-audit/rationale.md`、`TODO.md:69`、`docs/improvement-brief.md:297,520,824`。
- `docs/archive/`、`docs/plans/`、`docs/reports/` 與 `docs/sources.md` 都不動：前三者是有日期的紀錄，最後一個是帳本本身且已經正確。

## 7. `haiku` 兩臂

- 照 `docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab.sh` 的形狀跑一組新的兩臂，兩臂都用 `haiku`，同一個 HEAD、同一個 CLI 版本。
- 出 `docs/reports/2026-09-09-haiku-pair.md`，並在 `docs/sources.md` 的帳本加一列。報告要寫明這不是 pair 1 的嚴格重現：pair 1 釘的是 HEAD `86a104e` 與 `claude 2.1.259`，今天是別的；因此比的是同日兩臂之間的比值，不是跨日的絕對值。
- 不改任何規則。規則要不要改是另一條 TODO。

## What proves it done

| 主張 | 證據 |
|---|---|
| 構造過的查詢字串進不了 data script 的 `src` | `tests/station.test.js` 新測，今天紅 |
| `--print` 不寫檔 | `tests/map-cli.test.js` 新測，今天紅 |
| 指向 N+1 行的引用會被判 `past-end` | `tests/docs-check.test.js` 新測，今天紅 |
| 七個 stage 的圖都帶著自己規則的錨句 | `tests/pipeline-doc.test.js` 新測，今天 `verify` 與 `audit` 兩格紅 |
| 四份 plan 封存後檢查是乾淨的 | `node scripts/docs-check.js` 從 exit 1（10 條）變 exit 0 |
| 沒有弄壞既有的東西 | `npm test` 仍是 `ℹ fail 0`，且通過數不低於 1223 |
