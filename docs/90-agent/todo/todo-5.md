---
label: todo
title: 要求記 TODO 時當場寫入
description: 受控階段 guard 擋 controller 寫檔，TODO 只能先記 note 等 down；改成當場派 brain 查重複與既有功能、再派 agent 寫入並 commit
state: ready
link: hooks/guard.js
---

來源：2026-10-07 TODO 全表盤點 session，使用者在 plan、build、verify 三個受控階段各提了要記下的事（session title 提示、用量比對腳本、本條）。現況：受控階段 hooks/guard.js:136 擋 controller 的 Edit/Write，連 repo 外的記憶檔也擋（verify 階段實測：verify is a controlled stage — its stage agent does the writing here）；10-05 的裁定是先記 task.js note、down 後再寫，所以 TODO 要等整個任務結束才落檔，這期間 note 每個 prompt 都重新注入。使用者要的：一說要記 TODO，當場派一個 brain 查 TODO 有沒有相同條目、專案裡是不是已經有這個功能，再派一個 agent 用 todo.js new 寫入並 commit，不等 down、不經 note，避免上下文稀釋，也省掉 note 的重複注入。界線：TODO 類一律當場寫入；note 只記任務內的死路與決定（撐過 compact、跟著 adopt 走、land 時搬去該去的地方）。注意：曾有 subagent 跑 todo.js done 被 classifier 拒，要先確認 agent 寫入與 commit 不會被擋；commit 不能掃到 stage agent 正在用的暫存區。完成條件：受控階段中提出的 TODO 在同一輪內落成 commit，todo-check 綠，land 不再看到「down 後寫 TODO」的 note。
