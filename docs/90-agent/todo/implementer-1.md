---
label: implementer
title: implementer 寫 repo 根暫存
description: build 第 8 組留下過 .tmp-append.txt 在 repo 根，被記成 touched
state: ready
---

來源：2026-10-02 session 15377bbe 的「設計寫文件的 agent」task，build 與 plan 階段實際遇到。 現象：build group 8（Task 13）期間 repo 根出現 .tmp-append.txt，hooks 把它記進這個 task 的 touched/claims；主 session 檢查時檔已消失、git status 乾淨，commit 沒有夾帶。但 implementer 不該往 repo 根寫暫存檔：它會進 claims，可能擋到其他 session，也可能在刪除前被 git add 掃進去。要做的：在 agents/fankeel-implementer.md（和其 high/xhigh 版本，用 scripts/variants.js 重生）寫明暫存檔放 .fankeel/build/<task>/ 或系統暫存目錄；可考慮 guard 拒絕寫入 repo 根的 .tmp-* 檔。完成條件：implementer 的規則有這一條，且有測試或 guard 擋住 repo 根的暫存檔。
