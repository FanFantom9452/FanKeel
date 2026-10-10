---
label: build
title: lint 遇到目錄就崩潰
description: ledger.js lint 在 plan 的 Modify 寫了目錄時丟出 EISDIR 而不是回報一條 finding
state: done
link: lib/plantasks.js
done:
  at: 2026-10-10
  sha: 14ae58ab
  disposition: done
  session: 62ee78aa-a7b0-4fd7-96b0-5b6cf81837a9
---

來源：2026-10-10 任務「03-decisions 重新設計」的 plan 站。plan 的 Task 3 一開始寫了 `- Modify: `docs/03-decisions``（一個目錄），`node scripts/ledger.js --plan <f> lint` 直接以 Error: EISDIR 崩潰，堆疊停在 lib/plantasks.js 的 readSize（readFileSync 讀目錄），沒有任何 lint 行。要變成什麼：readSize 遇到目錄時不丟例外，lint 改回報一條 finding，說 Modify 要寫檔案，目錄請改列其中的檔案或用 path:a-b。完成的標準：tests 裡一個 Modify 指向目錄的 plan，lint 輸出那條 finding 並以非零結束，不再拋出 EISDIR。

## 完成紀錄

計畫的 Modify 寫了目錄時，lint 現在會回一條 finding，告訴你改列目錄裡的檔案或寫成帶行號範圍的檔案，並以非零結束，不再丟出 EISDIR。計行數的兩處都跳過目錄；直接呼叫 readSize 給目錄時仍然丟例外，原本那條測試保留。測試用一個 Modify 指向目錄的計畫釘住，拿掉回報那一行或把目錄交回去計行數，測試都會轉紅。

- commit 14ae58ab
