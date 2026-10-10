---
status: design-intent
---

# TODO 全表盤點（10-10 第二輪）：lint 目錄、suite 指定樹、站頁對話全文 — Design

這次盤點做三條 Ready，「子代理 brief 改走 spawn」（brief-3）使用者在 survey 的關卡選了這次不做，條目保持 ready。

- 「lint 遇到目錄就崩潰」（build-10）：`lib/plantasks.js` 的 `readSize` 只吞 ENOENT，`Modify:` 寫目錄時 `ledger.js lint` 以 EISDIR 崩潰。
- 「suite.js 不認手動 worktree」（land-1）：`scripts/suite.js` 只在登記檔的 worktree 或專案根跑，`lib/suite.js` 的 `blocker` 也只對那棵樹比 HEAD。
- 「站頁看得到對話全文」（station-24）：`lib/conversation.js` 的 `turnsOf` 只接了命令列，站頁沒有接。

class 為 bounded：三條都改既有流程。路線沒有 design 站也沒有 mockup，站頁那一段沿用過程還原既有的 `.rp` 樣式，不加 CSS。

## 1. lint 遇到目錄

- `lint` 對每個 task 的 `Modify:`，在有 `root` 時 stat 每個不帶行號範圍的路徑，是目錄就回報一條 finding：``Task N: `Modify:` names a directory, `<path>` — list the files in it, or a file as `path:a-b` ``。
- 是目錄的那一筆不交給 `readSize` 計行數，所以 READ_CAP 與 haiku 兩處檢查都不再丟 EISDIR。
- `readSize` 本身不改：直接呼叫它而給目錄時仍然丟例外，`tests/plantasks-readsize.test.js` 那條測試原樣保留。

## 2. suite.js 指定樹

- `scripts/suite.js` 多一個 `--tree <dir>`：有給就在那個目錄跑 suite、取那裡的 HEAD，不看登記檔的 worktree 欄位；目錄不存在就以 `suite: --tree <dir> does not exist` 結束，exit 1，不寫紀錄。
- 有給 `--tree` 時，`suite.json` 多一個 `tree` 欄位，值是該目錄的絕對路徑；沒給時紀錄的形狀不變。
- `blocker` 讀到的紀錄帶 `tree` 且該目錄還在時，用那棵樹取 HEAD、做 diff；`tree` 指的目錄不在了，就退回原本的 `treeFor`。
- `skills/fankeel-land/SKILL.md` 的 suite 指令下方加一句：build 在手動開的 git worktree 裡做時加 `--tree <那棵樹>`。

## 3. 站頁的對話全文

- `lib/conversation.js` 新增 `countsOf(turns)`，回 `{ compact, user, claude }`，`markdownOf` 的檔頭改用它，所以站頁與命令列的計數出自同一個函式。
- `lib/conversation.js` 新增 `pageOf(read, from, size)`，回 `{ total, from, counts, skipped, turns }`，`turns` 是 `read.turns.slice(from, from + size)`；另匯出 `PAGE`，值 100。
- serve 新增 `GET /station/conversation/<id>.json?from=N`：用該 session 自己記的 config dir 找 transcript，沒有就 404；`skipped` 補上 `unparsed`，和 `scripts/conversation.js` 一樣。
- 這條路徑不進 detail 的磁碟快取：serve 在記憶體留最近讀的一個 session，用 `lib/detail.js` 的 `keyOf` 判斷 transcript 有沒有動過，沒動就不重讀。
- 站頁 detail 的區段多一個「對話全文」，排在過程還原之後，預設收合；裡面一顆按鈕，按了才抓第一頁，之後每按一次再抓 100 則，直到抓完。
- 每一則的文字完整顯示、不截斷，經 `esc` 後放進 `white-space:pre-wrap` 的區塊；壓縮點標出第幾次、時間、trigger 與壓縮前 token，摘要放在可展開的 `<details>` 裡。
- `#/s/<id>` 那一頁的「事件」分頁，在過程還原下面放同一個區段。
- 標籤欄用行內樣式放寬到 84px，`assets/station/station.css` 不動。
- 區段頂端一行顯示壓縮次數、使用者則數、Claude 則數，下一行是 `left out:` 的各項計數。
- `docs/01-guide/station.md` 在 session 頁那一句後面補一句對話全文在哪裡、怎麼載入。

Struck: 一鍵下載 md——條目自己標「可選」，`scripts/conversation.js --out` 已經能做，這次不做。

## What proves it done

| test | how |
|---|---|
| Modify 指向目錄時 lint 回一條 finding | `tests/plantasks-lint-cap.test.js` 建一個 `lib` 目錄和 `- Modify: \`lib\`` 的 plan，跑 `ledger.js lint`：exit 1、輸出含 `names a directory`、不含 `EISDIR`。現在是紅的。 |
| 手動 worktree 的綠燈紀錄被 land 接受 | `tests/suite.test.js` 用 `git worktree add` 開一棵登記檔不知道的樹，`main(['--session', id, '--root', dir, '--tree', wt])` 後 `readRecord` 的 `sha` 是那棵樹的 HEAD、`tree` 是它的路徑，`blocker` 回 null。 |
| 站頁的計數與命令列檔頭一致 | `tests/station-conversation.test.js` 對同一份帶 `compact_boundary` 的 transcript，serve 回的 `counts`、`skipped` 與 `markdownOf` 檔頭那兩行逐字相符。 |
| Claude 的回覆不被截斷 | 同一個測試檔：一則 5000 字的回覆，serve 回的 `text` 長度是 5000；`tests/station-talk.test.js` 的 `talkHtml` 輸出含整段文字。 |
| 分頁接得起來 | `?from=2` 回的 `turns[0]` 等於整份的第 3 則，`total` 不變。 |

## Files

| file | change |
|---|---|
| `lib/plantasks.js` | `lint` 多一條目錄 finding，計行數時跳過目錄 |
| `tests/plantasks-lint-cap.test.js` | 目錄那條測試 |
| `scripts/suite.js` | `--tree` |
| `lib/suite.js` | `blocker` 認紀錄裡的 `tree` |
| `tests/suite.test.js` | 手動 worktree 那條測試 |
| `skills/fankeel-land/SKILL.md` | `--tree` 的一句 |
| `lib/conversation.js` | `countsOf`、`pageOf`、`PAGE` |
| `scripts/station.js` | `/station/conversation/<id>.json` |
| `tests/station-conversation.test.js` | 路徑、計數、分頁、全文 |
| `docs/01-guide/station.md` | 對話全文那一句 |
| `assets/station/station.js` | `talkHtml`、`needTalk`、區段 |
| `assets/station/i18n.js` | 新 key 的英文 |
| `tests/station-talk.test.js` | `talkHtml` |

## Unverified

- 沒有在 91cb51ef 那個 20 MB 的 session 上實測；條目的完成標準點名它，verify 站要用 serve 實際開一次，對 `scripts/conversation.js` 的檔頭。
- `.fankeel/render.json` 不存在，所以 build 的 rendering review 沒有東西可拍；站頁那一段只有 `talkHtml` 的字串測試。
- 站頁重畫時 `<details>` 的開合狀態會不會被重設，沒有讀到；既有六個區段走同一條路，新的區段跟著它們。
