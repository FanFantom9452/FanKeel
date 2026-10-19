---
label: gate
title: 答要離開時不要停手
description: gate.away 的離開題答「要離開」後 session 會停手等壓縮，使用者要的是自己做完
state: done
link: lib/context.js
done:
  at: 2026-10-20
  sha: 6e2d6ab1
  disposition: done
  session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
---

## 現況

profile 的 gate.away 設成 ask 時，context 超過 200k，gate 會多問一題「要離開超過 1 小時嗎？」（`lib/context.js` 的 `AWAY_QUESTION`）。答「要離開，先壓縮」後，hook 叫模型這一輪結束、不開新工作、去壓縮（`hooks/gate.js`、`hooks/resume.js`，registry 的 `awayAt`）。

## 問題

2026-10-19 使用者在六欄完成紀錄這個任務裡連答兩次「要離開，先壓縮」，結果工作停下來。使用者的原話：「我設計這個就是希望你可以自己處理完」「這個設計現在很奇怪」。答要離開的人，正是希望 AI 繼續做、不用盯著的人。現在的做法反而讓他回來時什麼都沒前進。

## 要改成

- 答「要離開」不停手：照常做到下一個真的要使用者決定的 gate。
- 在那個 gate 問出去之前（或問完之後這一輪結束時）自動壓縮，讓使用者回來時不用整段重寫。
- 題目和選項的文字跟著改，讓使用者看得懂「選了之後會發生什麼」。
- 先查 Claude Code 能不能從 hook 觸發壓縮；不能的話，要寫清楚誰在什麼時候壓縮。

## 完成紀錄

回答要離開後工作繼續，下一個問題先擱著，人回來再問。 詳見[任務紀錄](../records/2026-10.md#r-2026-10-19-45487ab9)

- commit 6e2d6ab1
- commit 6a6b09e3
- commit e08dd0f0
- commit 69a249c6
- commit f703d0ce
