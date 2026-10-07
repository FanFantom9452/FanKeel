---
label: title
title: 等回答時改 session title
description: spike mod 已落地（e1be543a）但未實測：gate 當下 /rename 能否執行、手機清單是否同步都未知；mod 每個 session 要手動 Enable，與裝好不改設定衝突
state: decision
link: hooks/await-title.ts
---

來源：2026-10-07 session bc09fc00 的 spike。使用者要求：等回答時，Desktop 與 Remote Control 清單上的 session title 前面加「等你回答」，因為手機推播有時收不到，要能一覽哪些 session 在等。已做：commit e1be543a 加了 hooks/await-title.ts，在 AskUserQuestion 的 tool.call 時背景試三次 $.command.run 跑 /rename，每次結果寫進 debug log；hooks/hooks.json 已宣告。沒驗過：/rename 在不在 $.command.run 可用清單、gate 當下會不會被拒（型別檔說 turn 在等的 hook 裡會被拒）、手機清單會不會即時同步。已知問題：API 讀不到原 title，mod 會把 title 整個換成「等你回答」，答完也不還原。衝突：docs/03-decisions/2026-10-03-mod-route.md 與 2026-10-05-inject-gate-mod.md 量過 hooks module 受 rollout 旗標控制、每個 session 要在 /plugin 按 Enable for this session 才載入，跟「預設開啟、裝好不改設定」衝突，這次 spike 的 survey 沒讀到這兩份。要做的：重啟後在 /plugin 對 fankeel 按 Enable for this session，觸發一次 AskUserQuestion，看 debug log 的 fankeel await-title 三行與手機清單。完成條件：成立就升級成 bounded，補上還原原 title，並決定載入條件怎麼處理；不成立就 revert e1be543a，改用 Remote Control 的 Push when actions required，並關閉本條。
