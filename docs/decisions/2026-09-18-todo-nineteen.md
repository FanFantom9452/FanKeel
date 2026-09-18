---
status: decision
last_verified: 2026-09-18
---

# TODO Needs a decision 十九條 — 決策紀錄

使用者在 `/fankeel` 的選單上答「DO IT ALL」：`## Needs a decision` 的全部十九條。
class `architectural`，七站全走，分支 `todo-19`。設計一次定十九條，plan 拆成十九個
task，build 跑了九個 fix round，verify 打回三條，audit 再抓到一條。

## 一、十九條各自落在哪

| task | 定案 | 落在 |
|---|---|---|
| 1 | `judge.js` 的旗標表改成字面量 `OPTIONS`，五支 CLI 的 `acceptedFlags()` 都不可為空 | `scripts/judge.js`、`tests/skills.test.js` |
| 2 | `station.js` 改用 `node:util` 的 `parseArgs`，未知旗標的訊息與 exit 2 不變 | `scripts/station.js` |
| 3 | `lib/skill-overlap.js` 併進 `scripts/orient.js`，只匯出 `OVERLAPS` | `scripts/orient.js` |
| 4 | 三處重複的形狀收成具名 helper：`isRecord`／`isPair`、`entriesOf`、`new Set` | `lib/registry.js`、`lib/usage.js`、`lib/live.js` |
| 5 | 唯讀 subagent 的擋寫清單補上 `node -e` 與 `python -c` 的寫檔 | `lib/guard.js` |
| 6 | `ledger.js init --range` 寫一行 `Plan:`，`ranges` 先列 plan 自己的範圍 | `lib/ledger.js`、`scripts/ledger.js` |
| 7 | `hooks/size.js` 拿掉：上線後堆疊不降反升，照 09-11 的預定規則撤 | `.claude-plugin/plugin.json` |
| 8 | context 行在 `BUSY` 以上時，這一站的 gate 多一個「接手」選項；回答後的區塊也帶這行 | `lib/context.js`、`lib/render.js`、`hooks/resume.js` |
| 9 | `task.js start` 與 `adopt` 寫下外掛自己的版本 | `scripts/task.js` |
| 10 | `gates` 記下問題與每個選項的說明，各截 200 字 | `lib/gates.js` |
| 11 | 首頁的 profile 卡移到最前；`/fankeel` 的 station 行直接給 `serve --open` | `assets/station/station.js`、`lib/render.js` |
| 12 | 首頁多一張文件卡，照抄各專案 `.fankeel/map.md` 的數字 | `lib/station.js`、`assets/station/station.js` |
| 13 | session 頁的花費分頁每站多一列主迴圈 | `lib/detail.js`、`assets/station/station.js` |
| 14 | `docs-check` 驗 `#fragment`，slug 照 GitHub 的規則 | `scripts/docs-check.js` |
| 15 | 三段重述改成連回來源頁 | `docs/development.md`、`docs/pipeline.md`、`docs/station.md` |
| 16 | caveman 一樣都不吸收 | [caveman-absorb-none](2026-09-18-caveman-absorb-none.md) |
| 17 | `sources.md` 的 Cited by 補齊，並有雙向測試 | `docs/sources.md`、`tests/sources-doc.test.js` |
| 18 | 根目錄 `.ignore` 排除 `docs/archive/` | `.ignore`、`docs/documents.md` |
| 19 | 十九條從 `TODO.md` 關掉；caveman 解除安裝移到 `## Ready`，沒有執行 | `TODO.md` |

## 二、verify 與 audit 打回來的四條

三條由 verify 打回 build，一條由 audit 找到，每條都是自己的 commit、自己的 reviewer、
ledger 上自己的 `Fix:` 行。

- **Task 1 漏了一個引用。** `docs/subagents.md` 的 `indexRow` 還指向 `judge.js` 位移前
  的行號。修 Task 1 的 fix 改了同段另外兩個，第三個在 diff 的上下文之外。
- **`Glob` 不讀 `.ignore`。** 設計寫的是「`Grep`／`Glob` 都不搜 archive」。verify 實測：
  `Grep` 搜只在 archive 出現的片語回 No files found，`Glob` 照樣列出 archive 的檔。
  `docs/documents.md` 改成只有 `Grep`。設計和 plan 已經封存，那句錯話留在原處。
- **plan 說不能測的，其實能測。** Task 11 的 brief 說 `homePage()` 在 DOM 守衛之下，
  沒辦法從 `node --test` 驅動，就改成手動 grep。同一個測試檔早就用 `vm` 加假
  `document` 啟動整頁；現在首頁的卡片順序有了測試，卡片搬回最後時它會紅。
- **Task 5 加了擋寫的 pattern，沒改描述它的頁。** `docs/collisions.md` 的清單少了
  那兩類。audit 的 pair reader 判「一致」，是 adversary 翻出來的。

## 三、分支上紅了四個 commit

verify 在每個 task 的兩端各跑一次全套，才看到 Task 3 落地時全套是紅的：
`overlapsIn` 匯出了卻沒人 import，`tests/source.test.js` 的「每個匯出都有人 import」
不過。從 Task 3 到 Task 6 的四個 commit 都帶著這一條，直到修 Task 3 的 fix 才綠。
群組提交前跑的全套沒抓到。HEAD 一直是綠的；紅的是分支的歷史。

## 四、證據要貼執行結果，對照組要真的能失敗

19 個 verifier 寫了 157 列證據，148 列成立。adversary 打掉的證據列裡，有兩列貼的是
沒有真的跑出來的輸出。一列說某個 `git log` 回空，其實列出五個 commit；另一列說
某個 diff 的 hunk 都在第 290 行之前，其實大多在後面。兩列背後的主張重跑後都成立，
錯的是證據本身。

verify 與 audit 都用了埋錯的對照組：verify 埋四個錯，adversary 全抓到，還多抓到一個
連埋錯的人都沒發現的——對照檔的 `## Tests` 段隨手寫了 `ℹ pass 44`，實際是 21。
audit 埋一個 `PreToolUse`，pair reader 抓到。紅綠對照 20 條全紅，每條都還原。

## 五、audit

41 組描述同一段程式碼的頁面對全讀，除了上面那條都一致。三個 reviewer 各用一種角度
掃整棵樹，找到 9 處約 -48 行可刪，全部早於這一枝，記成三條 `〔cuts〕`，沒有動手。
原生記憶改了兩條，都加更正行：一條還引用已刪的 `hooks/size.js`，一條的 init 餘量
從 17 變成 89。

## 不做

- caveman 解除安裝：改的是使用者自己的 Claude Code 設定，不是這個 repo，留在 `## Ready`。
- 9 處可刪的程式碼：不屬於這十九條，在 `TODO.md`。
- 版號：這一枝不是發版，除非使用者說是。
- 推送：profile 是 `land merge, no push`。
