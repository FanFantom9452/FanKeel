---
label: gate
title: brain 交出不合格的 gate
description: stage brain 寫的 gate 三次被 gate hook 擋下（兩次只有兩選項、一次選項一沒寫站名或收工），每次多一輪 SendMessage 重寫 — [fankeel-brain](agents/fankeel-brain.md).
state: ready
link: agents/fankeel-brain.md
---

來源：2026-10-02/03 session 5cd1d1c5 的「設計寫文件的 agent」task。build-3、audit 兩份 gate 各只寫兩個選項（核准與暫停，缺「未決事項或沒有」），land 的選項一寫「結束任務」而不是 收工/down 或路線上的站名；三次都在主控呼叫 AskUserQuestion 時才被 hooks/gate.js 的 gateProblem 擋下，主控只能 SendMessage 請 brain 重寫，多花一輪 agent 喚醒與等待。gate-4 已讓 hook 擋住少於三選項，這條是把檢查往前移到寫 gate 的人。要做成：brain 交出 handoff 前自己跑同一個檢查（例如一支 scripts/ 指令讀 handoff 檔最後的 json gate 區塊並呼叫 lib/handoff.js 的 gateProblem），不合格就自己改完再回傳路徑；agents/fankeel-brain.md 的回傳規則寫進這一步。完成條件：一個測試餵兩選項與選項一沒站名的 gate，檢查指令以非零結束並印出 gateProblem 的訊息；brain 的 agent 檔提到這個指令，拿掉該句即紅。
