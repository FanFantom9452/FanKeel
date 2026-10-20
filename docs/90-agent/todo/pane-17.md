---
label: pane
title: Pane 列出背景 shell
description: Pane 在 agents 下加「背景 shell」一區，每 tick 從 tasks/<id>.output 尾標記判斷在跑或結束
state: done
link: hooks/pane.ts
done:
  at: 2026-10-21
  sha: 524245f4
  disposition: done
  session: 9f451488-d5a6-4838-8cfc-9a451fd4f0e1
---

來源：2026-10-21 TODO 全表盤點 land 站，使用者問「background task 有辦法顯示嗎？為甚麼官方可以？我們 Pane 能顯示嗎？」，/fankeel-ask 判官（fable）答 B 修改版，見 [判決](../judgements/2026-10-20-pane-bg-list.md)。使用者決定記成 TODO，之後和其他任務融合一起做。

官方 UI 是 harness 本體，直接持有 task 管理器；mod 引擎到 2.1.302 只在 classic.Stop／classic.SubagentStop 給 background_tasks 快照，沒有每 tick 可問的清單。背景 shell 是唯一有可靠磁碟來源的：%TEMP%/claude/<slug>/<session>/tasks/b*.output 結束必有 [exited with code N]，沒有就是在跑；命令字樣要靠 on('tool.call', { tool: 'Bash' }) 包 next(e) 取 backgroundTaskId。

要做成：先做約 10 分鐘的拋棄式 mod 探針，證實 tool.call 結果在執行期真的帶 backgroundTaskId、e 帶 command（不帶就改成不做）；再在 hooks/pane.ts 加包裝與每 tick 讀尾 64 bytes，hooks/pane-status.ts 加 shells 區（在跑的在前、結束的留最後 2 個、最多 3 行、沒有就不畫），純函式放新的 hooks/pane-shell.ts 並附 tests/pane-shell.test.js。

完成條件：探針結果寫進本條；Pane 在背景 shell 跑時列出它、結束後顯示結束碼；.output 中途消失視為已結束；測試涵蓋尾標記解析與裁切。

探針結果（2026-10-21，Claude Code 2.1.305）：hooks module 的 `tool.call` 包裝 `next(e)` 結果帶 `backgroundTaskId`。Pane 的 shells 區塊在背景 shell 跑時列出 ○，結束後換成 ● 與紅色的 exit 3（使用者在實機上看到兩張圖都出現，結束約在 90 秒後）。

## 結案說明

這件事已在 524245f4 完成（hooks/pane-shell.ts、tests/pane-shell.test.js，以及 hooks/pane.ts 與 hooks/pane-status.ts 的 shells 區），本條已結案。

## 完成紀錄

Pane 現在會在 agents 下方列出背景 shell：在跑的顯示空心圓，結束後換成實心圓並標出結束碼。純函式放在 hooks/pane-shell.ts，hooks/pane.ts 包住 Bash 的 tool.call 取得背景任務編號並每個 tick 讀輸出檔尾端，hooks/pane-status.ts 畫出 shells 區塊；tests/pane-shell.test.js 涵蓋尾標記解析與裁切。探針結果已記在本條上方。

- commit 524245f4
