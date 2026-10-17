---
status: current
last_verified: 2026-10-18
---

# 文件與程式碼審查（10-18）

一句話：九處過期的句子與路徑改掉了，程式碼刪減經 adversary 篩過後開成一條 Ready，途中一個 fixer 把 lib/render.js 改到不能載入，整套紅了 209 條才被抓到。

## 做了什麼

五支掃描器都跑了。docs-check 全部解析；residue 列出 11 條用完的 agent 分支，已刪；docs-audit 列出兩頁落後程式、一份報告沒進索引、81 組描述同一段程式的頁面。memory-check 與 input-check 沒有要修的。knip 沒有輸出，deptry 沒裝。

讀的部分派了七個讀者：三個 reviewer 各看一種刪減，一個讀重疊最強的八組頁面，三個分批讀現行頁面、judgements 與 bench、agents 與 skills。最後一個 adversary 反駁全部發現。

改掉的句子：judge 的 brief 與 documents.md 把 `docs/judgements/` 說成固定路徑，其實那只是 docs.json 沒宣告時的預設；pipeline.md 說 PostToolUse 只接 AskUserQuestion；subagents.md 說三組量測沒有例外，漏了第四組，並寫著一個每次發佈都會過期的版本號；sources.md、collisions.md、lib/guard.js、lib/stages.js 各一處路徑或行號。

## 沒做什麼

程式碼刪減沒有在這次動手：路線上沒有 build 與 verify，所以開成 cuts-2，等下一個任務。adversary 駁回了兩個 median 合併（空陣列的回傳不同）和三處改用 readObject（要區分檔案不存在與讀不到），這些寫在條目裡，免得下次再提。

## 學到什麼

「擴大窗口」做不到想要的事。docs-audit 的 `--since` 是容忍期：頁面落後程式超過這麼多天才算落後，所以把窗口從 14 天拉到 45 天，落後的頁面從兩頁變成零頁。想多抓，要的是縮小它。

被告知「不用跑測試」的 fixer，在單引號字串裡寫了 `project's`，lib/render.js 因此無法載入，每個 hook 都會載入它。adversary 讀的是改之前的程式碼，所以抓不到。整套跑出 209 條失敗才發現，修好後重跑 4507 條全綠。改到 `.js` 字串的 fixer，回來後至少要 `node -e "require(...)"` 一次。
