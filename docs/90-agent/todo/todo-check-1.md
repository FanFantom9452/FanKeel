---
label: todo-check
title: todo-check 吞錯與四條小缺口
description: 10-03 verify 的 adversary 找出四條不阻擋 land 的缺口：todo-check 讀不到檔或 git 列不出檔案時，零主張被誤判為真；前綴比對沒補斜線；commit.js 兩個子句沒有測試；docs-check 一條註解過時
state: done
link: scripts/todo-check.js
done:
  at: 2026-10-03
  sha: 00b811af
  disposition: done
  session: 180f8da4-5021-4358-8e91-ca7d3e3b3331
---

來源：2026-10-03 TODO 全表盤點九條的 verify 報告（adversary，確認 reviewer 判為成立）。四條：1. scripts/todo-check.js:247 把 trackedFiles 的 null 換成 []、:213 讓 readText 讀不到就回空字串，於是 refs: 0 x 與 count: 0 x 在 git 列不出檔案時會誤判為通過；要改成讀不到就回報錯。2. scripts/todo-check.js:220 的 startsWith(prefix) 沒補斜線，路徑寫成 in lib（沒有結尾 /）時會把 libx/ 底下的檔也算進去。3. scripts/commit.js:86（失敗的 git diff --cached --summary 會被回報）與 :104（core.quotePath=false 處理非 ASCII 路徑）兩個子句，tests/commit.test.js 沒有任何測試在移除它們時變紅。4. scripts/docs-check.js:410 的註解仍寫 Reference only，但 :409 現在也對開放中的 todo 條目跑這支分支。

完成條件：每一條各有一個拿掉修正就會紅的測試（第 4 條改註解即可）；node --test 全綠、docs-check 無失敗。
