---
label: judge
title: 受控站實跑一次 /fankeel-ask
description: guard 已讓主控在受控站寫問題簡報資料夾，但只有 hook 層的測試，還沒在真實 session 跑過一次完整的詢問與歸檔
state: done
link: hooks/guard.js
group: 下次在受控站問判官
timing: if: 下次在 survey、build 或 verify 這類受控站用 /fankeel-ask
stamp: 2026-10-19
done:
  at: 2026-10-25
  sha: c4df9b4b
  disposition: done
  session: a2f7a8a8-8f0b-4f0e-ad4e-9e5104598011
---

來源：2026-10-19 TODO 全表盤點（第二輪）的「受控站擋 ask 寫檔」。hooks/guard.js 的 asksBrief 只放行 .fankeel/build/ask/，tests/guard.test.js 有測試，變異後 4 個測試會變紅。兩輪 verify 都寫明「沒有在真實 session 跑 /fankeel-ask」。

要觀察的是：下次在受控站用 /fankeel-ask 時，主控能不能寫出簡報、判官答完後 judge.js record 能不能把答案歸檔，中間有沒有被 guard 擋下。

完成的樣子：跑過一次且沒被擋就以 done 關閉；被擋就把擋下的那一行與指令記進來，改成 ready。

## 完成紀錄

使用者在 10-25 盤點決定結案：guard 放行問題簡報資料夾已有測試涵蓋，不再等一次真實的受控站詢問。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-24-a2f7a8a8)

- commit c4df9b4b
