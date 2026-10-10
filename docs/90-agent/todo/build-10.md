---
label: build
title: lint 遇到目錄就崩潰
description: ledger.js lint 在 plan 的 Modify 寫了目錄時丟出 EISDIR 而不是回報一條 finding
state: ready
link: lib/plantasks.js
---

來源：2026-10-10 任務「03-decisions 重新設計」的 plan 站。plan 的 Task 3 一開始寫了 `- Modify: `docs/03-decisions``（一個目錄），`node scripts/ledger.js --plan <f> lint` 直接以 Error: EISDIR 崩潰，堆疊停在 lib/plantasks.js 的 readSize（readFileSync 讀目錄），沒有任何 lint 行。要變成什麼：readSize 遇到目錄時不丟例外，lint 改回報一條 finding，說 Modify 要寫檔案，目錄請改列其中的檔案或用 path:a-b。完成的標準：tests 裡一個 Modify 指向目錄的 plan，lint 輸出那條 finding 並以非零結束，不再拋出 EISDIR。
