---
status: current
---

# TODO 全表盤點（10-10 第二輪）：lint 目錄、suite 指定樹 — Design

這次盤點做兩條 Ready。「子代理 brief 改走 spawn」（brief-3）使用者在 survey 的關卡選了這次不做；「站頁看得到對話全文」（station-24）使用者在 plan 的關卡拆了出去，要先畫 mockup，另開一個帶 design 站的任務。兩條都保持 ready。

- 「lint 遇到目錄就崩潰」（build-10）：`lib/plantasks.js` 的 `readSize` 只吞 ENOENT，`Modify:` 寫目錄時 `ledger.js lint` 以 EISDIR 崩潰。
- 「suite.js 不認手動 worktree」（land-1）：`scripts/suite.js` 只在登記檔的 worktree 或專案根跑，`lib/suite.js` 的 `blocker` 也只對那棵樹比 HEAD。

class 為 bounded：兩條都改既有流程，沒有前端。

## 1. lint 遇到目錄

- `lint` 對每個 task 的 `Modify:`，在有 `root` 時 stat 每個不帶行號範圍的路徑，是目錄就回報一條 finding：``Task N: `Modify:` names a directory, `<path>` — list the files in it, or a file as `path:a-b` ``。
- 是目錄的那一筆不交給 `readSize` 計行數，所以 READ_CAP 與 haiku 兩處檢查都不再丟 EISDIR。
- `readSize` 本身不改：直接呼叫它而給目錄時仍然丟例外，`tests/plantasks-readsize.test.js` 那條測試原樣保留。

## 2. suite.js 指定樹

- `scripts/suite.js` 多一個 `--tree <dir>`：有給就在那個目錄跑 suite、取那裡的 HEAD；條目自己有登記 worktree、目錄不是本專案的 checkout、或沒帶值時拒絕，目錄不存在就以 `suite: --tree <dir> does not exist` 結束，都是 exit 1、不寫紀錄。
- 有給 `--tree` 時，`suite.json` 多一個 `tree` 欄位，值是該目錄的絕對路徑；沒給時紀錄的形狀不變。
- `blocker` 讀到的紀錄帶 `tree`、該目錄還在、是本專案的 checkout、且條目沒有自己的 worktree 時，用那棵樹取 HEAD、做 diff；否則退回原本的 `treeFor`。
- `skills/fankeel-land/SKILL.md` 的 suite 指令下方加一句：build 在手動開的 git worktree 裡做時加 `--tree <那棵樹>`。

## What proves it done

| test | how |
|---|---|
| Modify 指向目錄時 lint 回一條 finding | `tests/plantasks-lint-cap.test.js` 建一個 `lib` 目錄和 `- Modify: \`lib\`` 的 plan，跑 `ledger.js lint`：exit 1、輸出含 `names a directory`、不含 `EISDIR`。現在是紅的。 |
| 手動 worktree 的綠燈紀錄被 land 接受 | `tests/suite.test.js` 用 `git worktree add` 開一棵登記檔不知道的樹，`main(['--session', id, '--root', dir, '--tree', wt])` 後 `readRecord` 的 `sha` 是那棵樹的 HEAD、`tree` 是它的路徑，`blocker` 回 null。 |

## Files

| file | change |
|---|---|
| `lib/plantasks.js` | `lint` 多一條目錄 finding，計行數時跳過目錄 |
| `tests/plantasks-lint-cap.test.js` | 目錄那條測試 |
| `scripts/suite.js` | `--tree` |
| `lib/suite.js` | `blocker` 認紀錄裡的 `tree` |
| `tests/suite.test.js` | 手動 worktree 那條測試 |
| `skills/fankeel-land/SKILL.md` | `--tree` 的一句 |

## Unverified

- `sameRepo` 用 `git rev-parse --path-format=absolute`，要 git 2.31 以上；更舊的 git 上 `--tree` 一律被拒絕，沒有寫退路。
