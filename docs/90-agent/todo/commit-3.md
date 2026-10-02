---
label: commit
title: commit.js 漏掉 mode 變更
description: commit.js 用 git commit -o，core.fileMode=false 下只改檔案權限（+x）的變更會被丟掉、回 nothing to commit；10-02 station.sh 只能繞過它直接 commit — [scripts/commit.js](scripts/commit.js).
state: ready
link: scripts/commit.js
---

來源：2026-10-02 TODO folder-only 改版的 build 第二輪。stage agent 用 git update-index --chmod=+x 把 station.sh 設成 100755 並已暫存，commit.js 卻回「nothing to commit」。原因是 scripts/commit.js:101 與 :242 都跑 git commit -o，-o 會用 HEAD 加工作樹重組提交，而這台 Windows 的 core.fileMode=false 讀不到工作樹的執行位元，暫存區裡的 mode 變更就被丟掉。agent 誤判成「還沒暫存」要求重試，重試只會同樣失敗；最後由主 session 直接 git commit 暫存區落地（f3867143）。

要做成：commit.js 在 commit 前偵測區塊裡有只改 mode 的路徑（git diff --cached --summary 出現 mode change 而內容未變），改走不帶 -o 的提交，或在 -o 之後補上 git update-index --chmod 再 amend；並讓失敗訊息講清楚是 mode-only 的情況，不要只回 nothing to commit。

完成條件：新測試在 core.fileMode=false 的暫存 repo 裡對一個只改 +x 的檔案跑 commit.js，提交後 git ls-tree HEAD 顯示 100755；拿掉修正後該測試變紅。
