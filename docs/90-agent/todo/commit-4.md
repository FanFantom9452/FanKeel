---
label: commit
title: commit.js 提交不了搬過家的檔
description: commit 檔的區塊裡列了改名前的舊路徑時，commit.js 的 git add 找不到它就整塊失敗，搬家只能改用 git 直接提交
state: done
link: scripts/commit.js
done:
  at: 2026-10-13
  sha: 4006bd6b
  disposition: done
  session: 7e78f7c7-2068-495b-ae3d-6c99c61049fe
---

來源：2026-10-13 TODO 全表盤點的 land 站。scripts/archive.js 用 git mv 把計畫從 docs/90-agent/plans/ 搬到 docs/99-archive/，接著用 scripts/commit.js 提交一個列了四個路徑的區塊：報告、搬家前的舊路徑、搬家後的新路徑、docs/README.md。commit.js 印出「block 2: git add failed: fatal: pathspec 'docs/90-agent/plans/2026-10-13-todo-patrol-five.md' did not match any files」，那一塊沒有提交。當時的指令把輸出接到 tail，所以腳本自己的 exit code 沒有看到，區塊失敗時它回什麼還不知道。當時改用 git commit 直接提交已暫存的三個變更（commit e695c0e7）。要變成：區塊裡列到一個工作目錄已經沒有、但 index 記著被刪除或被改名的路徑時，commit.js 照樣能提交；不列舊路徑只列新路徑時行為是什麼也要確定，因為 commit -o 只帶新路徑會把搬家提交成只有新增。區塊失敗時的 exit code 也要查：是 0 的話要改成非 0。完成條件：tests 裡有一個測試，在暫存目錄的 repo 裡 git mv 一個檔後用 commit.js 提交，提交出來的是一筆改名；區塊失敗時的 exit code 查過，是 0 的話再補一個斷言它非 0 的測試。改名那個測試在修之前是紅的。

## 完成紀錄

commit 檔的區塊同時列搬家前後兩個路徑時，commit.js 現在提交出一筆改名；只列一個用 git rm 刪掉的路徑時提交出一筆刪除。做法是已經消失的舊路徑不再交給 git add，但仍留在提交的清單裡。中文檔名與 worktree 區塊也走同一套。只列新路徑的情形原本就會把舊路徑一起帶上，已有測試。區塊失敗時的 exit code 查過：本來就是 1，已有測試斷言，沒有另補。補測試時另外抓到並修掉一個原本就在的缺陷：改名和權限變更在同一個區塊時權限會掉。改名那個測試在修之前是紅的。沒做的：改名一個本來就可執行的檔沒有測試，只在暫存 repo 實跑過一次。

- commit 4006bd6b
- commit 611d7226
- commit 1b082d3d
- commit 2c59ed3d
- commit 5a2d9be5
- commit e43b3ff5
- commit 876351c0
