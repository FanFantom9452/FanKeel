---
label: docs-check
title: TODO 假引用的靜態檢查
description: 10-02 討論：開放中的 todo 條目照 reference 跑 gone、symbol、quote，todo.js new 寫入即擋；零依賴。graph／SQLite 索引類暫不引入。
state: decision
link: scripts/docs-check.js
---

scripts/docs-check.js:389-395 對 role todo 跳過 gone 與 symbol，理由是已完成條目記的是當天的檔案；這只對 done 條目成立。

- 第一步：開放條目照 reference 檢查（gone、symbol、quote），`todo.js new` 寫入時即擋。
- 第二步：可重算的 `refs:`／`count:` 行，讓 todo-check 重新 grep 關係型宣告（「唯一呼叫者」「約 23 處」「無引用」）。
- 暫不做：graph（graphify、codegraph）、LSP（Serena）、`.fankeel/` 下的 SQLite，皆屬索引類，與 documents.md 的「重掃，不存」衝突，留給 Watch 條目「程式碼大到要查結構」。
- 驗收：重放現有條目，要能抓到過去真實出現的假引用。
