---
label: station
title: 快速設定重新設計
description: 使用者要 station 和 profile 的快速設定全部重新設計，並和 fankeel-init 的上手流程相關；形狀還沒定，需先裁定
state: done
done:
  at: 2026-10-15
  sha: 9b699cd4
  disposition: done
  session: c238c175-99dd-466d-b0d8-200c3b1b2c44
---

來源：2026-10-15 TODO 全表盤點時，使用者親口要求「STATION 和 PROFILE 快速設定也要全部重新設計，和 INIT 相關」。要變成什麼：station 頁的快速設定與 profile 的快速設定不是小修，而是整組重新設計，並與 fankeel-init 的 onboarding 一起考慮，讓新專案一次走完初始化、profile 選擇與 station 設定，而不是三處各說各話。尚未決定：重新設計的範圍（只改介面，還是連設定項目與預設值都重排）、init 與快速設定誰是入口、舊的快速設定是否保留相容。下一步：先由使用者裁定上述三點，再寫 design，核准後才開實作 task。完成條件：有一份核准的 design 寫明範圍與入口，並拆出實作 task；本條在 design 核准後關閉。

2026-10-15：land 時使用者確認本條改放 Ready——重新設計的範圍與入口由接手的 design 站和使用者一起定，不再先單獨裁定。

## 完成紀錄

init 現在先在聊天裡問開發習慣，可以一鍵套用建議值，也可以一題一題設定；接著問一次要不要整理 docs，說好才整理。新增 profile preset 指令一次寫完一組習慣，監控站的「省 context」也改成和建議預設一致。

- commit 975bc60d
- commit c61abc9f
- commit 9b699cd4
