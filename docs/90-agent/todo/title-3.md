---
label: title
title: 等回答時改 session title
description: 實測不成立（2026-10-07）：mod 已載入，gate 等待中與閒下來後 title 都沒變成「等你回答」；要移除 await-title，改靠「Claude has a question」推播
state: done
link: hooks/await-title.ts
group: hooks.json 單一入口落地
timing: after: 「hooks.json modules 只收一個」那個 session 收工，放開 hooks/mod.ts
stamp: 2026-10-07
done:
  at: 2026-10-07
  sha: bfa9dfdf
  disposition: done
  session: a0732138-967e-42f6-ad08-30a88e61f327
---

來源：2026-10-07 session bc09fc00 的 spike。使用者要求：等回答時，Desktop 與 Remote Control 清單上的 session title 前面加「等你回答」，因為手機推播有時收不到，要能一覽哪些 session 在等。已做：commit e1be543a 加了 hooks/await-title.ts，在 AskUserQuestion 的 tool.call 時背景試三次 $.command.run 跑 /rename，每次結果寫進 debug log；hooks/hooks.json 已宣告。沒驗過：/rename 在不在 $.command.run 可用清單、gate 當下會不會被拒（型別檔說 turn 在等的 hook 裡會被拒）、手機清單會不會即時同步。已知問題：API 讀不到原 title，mod 會把 title 整個換成「等你回答」，答完也不還原。衝突：docs/03-decisions/2026-10-03-mod-route.md 與 2026-10-05-inject-gate-mod.md 量過 hooks module 受 rollout 旗標控制、每個 session 要在 /plugin 按 Enable for this session 才載入，跟「預設開啟、裝好不改設定」衝突，這次 spike 的 survey 沒讀到這兩份。要做的：重啟後在 /plugin 對 fankeel 按 Enable for this session，觸發一次 AskUserQuestion，看 debug log 的 fankeel await-title 三行與手機清單。完成條件：成立就升級成 bounded，補上還原原 title，並決定載入條件怎麼處理；不成立就 revert e1be543a，改用 Remote Control 的 Push when actions required，並關閉本條。

實測（2026-10-07 session 6042cf75，Remote Control 手機畫面）：`/plugin` 顯示「1 mod active · fankeel」，此時 hooks/mod.ts（9567c53f 起同時載入 compact 與 await-title）已在這個 session 載入；session 沒用 --debug 啟動，所以沒有 `fankeel await-title` log 行。12:29 觸發一次 AskUserQuestion，gate 等待中手機上的 title 是「Pyright plugin」，那是 Claude Code 依上一則 prompt 自動產生的；turn 結束、session 閒下來後再看，仍是「Pyright plugin」。所以 /rename 在 gate 當下沒生效，閒下來後也沒有排隊補跑；是 `rename` 不在 `$.command.list()` 清單還是被拒，沒 log 分不出，但不影響結論。手機清單會同步 title：12:24 的 `desktop-urb5ns2-imperative-sp…` 到 12:29 變成「Pyright plugin」都有跟上，且 12:24 gate 時手機收到「Claude has a question」推播。結論：不成立。要做的：e1be543a 之後 9567c53f 已把 await-title 併進 hooks/mod.ts，直接 revert 不會乾淨，改成刪 hooks/await-title.ts 與 tests/await-title.test.js、拿掉 hooks/mod.ts 的 import 與 `awaitTitle(on)`，並更新 tests/mod.test.js 與 tests/inventory.test.js 對 await-title 的預期。等「hooks.json modules 只收一個」那個 session 收工再動手，它還認領著 hooks/mod.ts。完成條件：五個檔改完、全套測試綠，然後關閉本條。

實測補充（2026-10-07 session 3e1acf49，用 FANKEEL_COMPACT_AT=1000 與 --debug 重啟並 Enable fankeel，log 為 ~/.claude/debug/3e1acf49-4dda-4fa0-8daa-54b66e2fe826.txt 第 679–688 行）：`fankeel await-title` 三行是 attempt 1、2、3 各被拒一次，時間 05:11:31.306、05:11:32.309、05:11:33.313，訊息都是 `HooksError: fankeel: command.run: called from a tool.call hook, it would wait on the turn this hook is holding; run it from a later event (turn.complete) (host check)`。所以上一段分不出的那一點現在清楚了：不是 rename 不在清單，是 host 拒絕從 tool.call 這個 hook 呼叫 command.run，因為它會等這個 hook 自己扣住的 turn。717 行的 `hooks module fankeel@fankeel tool.call settled in 3640.4ms (worker hop, next() included)` 含 next()，也就是含使用者回答的時間，不是 hook 本身的成本。host 建議改在 turn.complete 跑，但 gate 等待時 turn 還沒結束，turn.complete 要等使用者答完才來，達不到「等回答時改 title」的目的，所以結論不變：不成立。

## 完成紀錄

await-title 已移除：hooks/await-title.ts 與 tests/await-title.test.js 刪除，hooks/mod.ts 只註冊 compact；決策見 docs/03-decisions/2026-10-07-mod-reopen.md。

- commit bfa9dfdf
- commit 0c6a9df8
