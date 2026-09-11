---
status: current
last_verified: 2026-09-11
source_of_truth: scripts/docs-audit.js, docs/documents.md, skills/fankeel/SKILL.md, skills/fankeel-audit/SKILL.md, tests/docs-audit.test.js, tests/docs.test.js
---

# TODO 三條一次清 — 決策

使用者的問題有五項，四項當時已經在了，剩下的三項是這個分支：`.fankeel/build/`
這塊暫存區要不要進 docs tree、`## Ready` 那兩條、以及 `source_of_truth` 要不要
被驗證。這份記的是三個答案各自為什麼是那個、同一個根因在九輪裡怎麼一再出現，
以及 verify 與 audit 各自撈回來什麼——包括撈到我自己身上的那幾條。

## 三個答案，其中一個是「不要宣告」

- **`.fankeel/build/` 不進 `docs.json`，改用散文加一個守衛測試。** 路徑再怎麼
  合法都不行：`lib/tracked.js:31` 的 `trackedFiles` 帶 `--exclude-standard`，而
  `.fankeel/.gitignore` 蓋掉整個 `build/`，所以宣告出來的 bucket 會永遠列出零
  個檔。一個永遠是空的 bucket 比沒有 bucket 更糟——它看起來像有人管過。
- **兩條 `## Ready` 照建。** 頁數那條的修法是讓某個東西去數它，不是把散文改
  對：`tests/contract.test.js` 現在數 `docs/` 深度一的檔案，所以下一次加頁的人
  會被測試擋下來，而不是被下一次稽核抓到。
- **`source_of_truth` 驗證的答案是「印出來，當 context，永遠不算缺陷」。**
  今天十筆條目分佈在五頁，每一筆都合法——「這頁就是索引」、「這就是 prompt，
  沒有上游」。這條線存在是為了第十一筆：一個打錯字的路徑，在兩者都沉默的時候
  跟合法句子長得一模一樣。把它算成缺陷會讓 `docs-audit` 天天 exit 1，而一個永
  遠非零的離開碼等於沒有離開碼。

## 一個根因走完九輪

**一份還是字面為真、但已經不完整的清單，讀起來像完整的。**

它在這個分支裡出現在：sweep 類別表少兩列、壽命表那格的列舉讀起來像窮舉、稽核
流程圖少一個節點又多一條指錯的邊、`unresolved` 那段標題把「十筆條目」寫成「十
頁文件」。每一處在寫下的當天都是真的。

**然後它出現在自己的修正裡。** 稽核抓到 `docs/documents.md:154` 宣稱
`lib/map.js:228` 是「唯一會讀 bucket 與 role 的呼叫端」——假的。第一輪改成「其
餘五個都經 `roleOf()`」，也假的，其中三個兩樣都不碰。第二輪改成 1+2+3 的分類，
還是假的，因為 `lib/map.js:263` 自己也叫 `roleOf()`。第三輪才停止描述六個檔
案，只留下「六個之中只有這個檔案直接讀 `.buckets`」——寫成 ledger 的一條
Ruling，代價講明白了：想知道另外五個的人得自己 grep。

描述一個集合的句子讀起來就是完整的。三種寫法之後活下來的，是描述單一檔案的
那一種。

## 兩個守衛，因為散文修正不會自己紅

adversary 打掉過「這兩條修正沒辦法寫測試」這個說法，它舉了
`tests/skills.test.js:708` 與 `tests/docs.test.js:515` 兩處早就存在的同形狀檢
查。於是：

- `tests/docs-audit.test.js` 從 `sweep()` 自己的 return literal 解出類別集合，
  `sweep()` 多一個 key 而沒人分類就紅。它自己也被 reviewer 打過一次——原本的
  正則沒綁在 `sweep()` 的大括號上，回傳重排成一行就會抓到別的函式——硬化成先
  取函式本體，加上非識別字 token 與 `drift` 哨兵，三個 arm 各自驗紅。
- `tests/docs.test.js` 釘住壽命表那格的「例如」出現在第一個「、」之前。

兩個守衛只釘住了一半：同一份 sweep 類別表在 `skills/fankeel-audit/SKILL.md`
也有一份，而測試只讀 `skills/fankeel/SKILL.md`。這件事自己成了一條 TODO。

## 撈回來的，與撈到我身上的

verify 走了五輪、audit 兩輪，每一輪的 adversary 都打掉東西，而且打掉的幾乎從來
不是宣稱本身，是**描述宣稱怎麼被檢查的那句話**：

- 一份突變紀錄跑在前一個 commit 的髒樹上，那一列卻寫得像跑在 tip。同一個目錄裡
  早就有標示這種情況的慣例，那一列沒用。
- 一列證據是轉述另一個 agent 的發現，整張表只有它沒有本 session 能打開的檔案。
- 「round 3 clean」把缺席當成判決——磁碟上沒有任何東西撐它。
- 「沒有測試讀這兩個檔」可查證為假；真正成立的是較窄的「沒有任何斷言綁在這兩句
  話上」。
- 一個頁數從 49 改成 44：我拿去數的輸出是 `grep -E` 過的，把 `... and 5 more`
  那行吃掉了。這條正是這個 repo 自己的筆記寫過的事。
- 我駁回一個 reader 的理由被打掉：我用「pair 只有在雙方都不 defer 時才算缺陷」
  回答它，但它問的是單一頁自己一不一致。重判之後兩邊都不對——
  `docs/documents.md:182` 說 code 條目是「這頁在講什麼」，不是所有權宣告，所以
  不該刪；缺的是**文件**條目。

## 這次沒做

- `/ponytail-audit` 有裝，程式碼那一半兩輪 audit 都沒跑。
- 43 組 pair 讀了 4 組——選的是共享檔案正好是改動主題的那四組。完整的兩週深掃
  還沒有人做過。
- 六條新發現進了 `TODO.md` 而不是就地修：兩份 sweep 表只釘一份、寫死的「十條
  五頁」、刪除型 plan 的 `landed` 永不觸發、`map.md` 只點名 166 份裡的 44 份、
  `skills/fankeel/SKILL.md` 的 defer 只寫在散文裡。
