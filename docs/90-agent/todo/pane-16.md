---
label: pane
title: band 與 pane 的兩處小整理
description: 5h 與 7d 各寫一次的刻度迴圈抽成一個函式；沒有計畫時 tasks 區塊提早回傳
state: done
done:
  at: 2026-10-19
  sha: 7436bd88
  disposition: done
  session: d3262697-a4ab-4038-a006-e5286871ceb9
---

來源：2026-10-19 終端 band 加 7d 刻度與模型 effort 那次的 verify 報告，兩項都標成不影響正確性的整理。一、hooks/pane-band.ts 的 markedBar 迴圈（填滿 → inked、刻度 → WHERE、其餘 → DIM）在 5h 與 7d 各寫了一次，應抽成一個 helper。二、hooks/pane-status.ts 的 tasksBlock 在沒有計畫時回 []，但回傳前仍先算 mark、out、late，應把 return 移到最前面。完成標準：兩處改完，band 與 pane 的既有測試輸出不變並全過。

## 完成紀錄

狀態列標記的迴圈併成一個共用小函式，任務區塊在沒有計畫時直接提早結束。

- commit 7436bd88
