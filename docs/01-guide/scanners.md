---
status: current
last_verified: 2026-10-21
source_of_truth: scripts/docs-check.js, scripts/docs-audit.js, scripts/residue.js, scripts/memory-check.js, scripts/input-check.js, skills/fankeel-audit/SKILL.md
---

# 五支掃描器

fankeel 帶五支掃描器，它們只回報，會改檔案的只有 `residue.js --sweep`（移除用完的 agent worktree 與分支）和 audit 對這次執行的紀錄（`.fankeel/audit.json`）。它們只回報機械上能判斷的事，不會判斷兩份文件互相矛盾——那要人讀。`/fankeel-audit` 一次跑完五支、讀它們的清單，最後才提議清理。

`<plugin>` 是插件安裝的目錄；在這個 repo 裡就是 `.`。

## docs-check：參照還解析得到嗎

```
node <plugin>/scripts/docs-check.js [--root <專案>]
```

一秒跑完：連結指向不存在的檔、`path:line` 超出檔尾、文件提到的符號沒人宣告。`verify` 與 `audit` 每次都跑它。哪些頁檢查什麼，看 `.fankeel/docs.json` 給它的 role：archive 提到已刪的程式是正常的，reference 這樣就是錯。

## docs-audit：哪些頁已經不是真的

```
node <plugin>/scripts/docs-audit.js [--root <專案>] [--since <天數>] [--quiet] [--batches] [--batch <n>] [--record]
```

`--record` 會把結果寫進 `.fankeel/audit.json`。

大約兩週一次。找出主題改了、文件卻沒跟著改的頁（drift），工作已落地的 plan，索引與實際檔案對不上的地方，以及 mermaid 圖列了一個目錄大半卻漏掉其餘檔案的圖——這四類會讓它失敗。描述同一個原始檔的兩頁、沒人連到的頁、沒歸到任何 bucket 的 markdown 只是線索，不算失敗。

## residue：沒人決定過的東西

```
node <plugin>/scripts/residue.js [--sweep]
```

列出沒追蹤也沒忽略的檔、分支已合併的 worktree、空目錄、被忽略的大東西。只列不刪；`--sweep` 才清掉用完的 agent worktree 與分支。

## memory-check：Claude Code 的記憶還對嗎

```
node <plugin>/scripts/memory-check.js
```

檢查這個專案的 memory 目錄：`MEMORY.md` 索引與檔案一致、引用的路徑還在、`path:line` 還在檔內。

## input-check：每輪讀進來多少

```
node <plugin>/scripts/input-check.js
```

列出每個 session 都會讀進的檔——全域與專案的 `CLAUDE.md`、各專案的 `MEMORY.md`——由大到小，附位元組與估計 token，再列可以修剪的地方。只列，不失敗，不改檔。

## 其他 `*-check`

`todo-check.js`、`skills-check.js`、`version.js`、`stage-registry.js` 是開發這個插件用的，說明在 [development.md](development.md)。
