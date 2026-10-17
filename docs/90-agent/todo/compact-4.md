---
label: compact
title: Desktop 真機看壓縮視窗
description: CLAUDE_CODE_AUTO_COMPACT_WINDOW 只在 headless 量過；在 Claude Desktop 把它寫進 settings 的 env，看主機會不會自己壓、context 行那一句會不會消失
state: done
link: lib/context.js
done:
  at: 2026-10-17
  sha: 5c9d46d6
  disposition: done
  session: 398cc390-8239-42f0-8311-1f7f73c7bb88
---

來源：2026-10-12 的任務（docs/99-archive/2026-10-12-compact-window.md）。SBIR 工作區的 Desktop session 9916350f 從 450k 長到 629k，16 次 turn 結束都沒壓縮。量測（docs/90-agent/reports/2026-10-12-compact-window-probe.md）是 headless、haiku、用 shell 的環境變數：視窗 100000 時在 71k 到 75k 壓，200000 時在 165k 到 170k 壓，都在 turn 進行中。沒量的有三件。第一，變數寫在 ~/.claude/settings.json 的 env 時，Claude Desktop 啟動的 session 吃不吃得到，主機會不會在 420k 上下自己壓（transcript 出現 trigger 為 auto 的 compact_boundary）。第二，command hook 的行程看不看得到那個變數：有設而且過 400k 時，注入塊的 context 行不該有 No auto-compact window is set 那一句。第三，1M 視窗的模型在 450000 的實際觸發點。要做的：使用者在 settings 加上那個 env、重開 Desktop，開一個 fankeel 任務跑到過 400k，記下壓縮發生在多少、context 行有沒有那一句。完成條件：三件都看過並記在這裡；主機沒有壓，或那一句誤報，就改回 ready 並寫下差在哪。

## 完成紀錄（2026-10-17）

不必另跑一次：~/.claude/settings.json 的 env 已經有 CLAUDE_CODE_AUTO_COMPACT_WINDOW 450000，10-16 起有三個 Claude Desktop 啟動的 fankeel session 跑過 400k，從它們的 transcript 讀出兩件；第二件沒有看到，本條維持 ready，只剩那一件。

- settings env 是否吃得到：吃得到。本盤點的 Desktop session 398cc390-8239-42f0-8311-1f7f73c7bb88 的 shell 讀到 450000；session 5e181f59-060e-43af-b6b4-d2ba247c315a、9e59e535-7d50-4ff5-a017-bb2638612fb8、9cf97941-93c8-4fcb-9cf2-8ef92f52eff5 共有 5 個 trigger 為 auto 的 compact_boundary。三個 session 的 profile 都有 compact.at 450000，但 hooks/compact.ts 要到 tokens 不少於 450000 才壓，這 5 次都在那之前，所以是主機依這個視窗自己壓的。
- hook 看不看得到：沒看到。lib/context.js 的 contextLine 只在變數讀不到、而且 compact.at 不是 350000、450000、600000、1000000 其中一階時才加上 No auto-compact window is set；這三個 session 的 compact.at 都是 450000，那一句本來就不會出現，三個 transcript 裡 0 次證明不了什麼。要看這一件，得在 compact.at 設成 off 的 Desktop session 跑過 400k，再看 context 行有沒有那一句。
- 1M 視窗在 450000 的觸發點：5 次壓縮前分別是 418056、419608、418571、426881、416911 token，落在 417k 到 427k；同期終端啟動的 SBIR session（4b72ae2c-64c0-4420-b433-6b705e0855d8、244f7c6b-80e8-4270-92f6-6fcd0d36ab65、e3f3fd12-8233-4979-b794-ef8e22fc7c56、e6a02ad2-b675-4021-a65e-c1ce1ec1b8ac、22d6980f-e79c-4891-8bee-f05f8437a8af、25ce35c0-1e88-46e9-8a9b-0bbbacea9fe0）也在 417k 到 425k 壓。比視窗少 25k 到 35k，與 10-12 headless 量到的 200000 視窗在 165k 到 170k 壓同一個規律。

## 補上第二件（2026-10-17）

- hook 看不看得到：看得到。在專案的 .claude/settings.local.json 臨時加一支 UserPromptSubmit command hook，只把 process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW 附加到一個 log；log 在 14:12:02 與 14:12:13（UTC）各寫一行 450000。~/.claude/projects 下時間戳記落在 14:11:00 到 14:12:59（UTC）的 transcript 只有 Desktop 啟動的 session 398cc390-8239-42f0-8311-1f7f73c7bb88（entrypoint claude-desktop），這是查 transcript 的時間戳記得到的；log 本身不帶 session id，所以「觸發的是這個 Desktop session 的 command hook」是由此排除法推定，不是 log 證明的；同時也推定 Claude Code 執行中重讀了 settings.local.json 的 hooks。測完已把那支 hook 與探針腳本 env-probe.js 拿掉，log 留著當證據。三件都看過，本條關閉。
