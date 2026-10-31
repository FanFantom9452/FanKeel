---
label: gate header
title: gate header 順序測試太弱
description: tests/gate-header-move.test.js 第 4 個測試換成 header 檢查順序有差時會變紅的案例
state: ready
---

來源：2026-10-31 TODO 全表盤點的 verify（.fankeel/build/task-20261031T112437/verify.md），使用者在 verify gate 選擇進 land、把這個缺口記成 TODO。tests/gate-header-move.test.js 第 4 個測試用 'SURVEY -> PLAN' 加合法 header，只在問題句正則不再拒絕全大寫站名時才會變紅，formatProblem 改成先檢查 header 也不會讓它失敗，所以它沒有守住檢查順序。要變成：補一個 header 與問題句都不合法、且兩種檢查順序會回報不同欄位的案例，斷言回報的是 questions[0].question。完成標準：把 formatProblem 暫時改成先比對 header 時，這個測試變紅；改回來後全綠。
