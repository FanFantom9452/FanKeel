---
label: judge
title: 讀者回報送錯對象
description: 判官派出的 fankeel-reader 的 SubagentHandback 送到主對話而非判官，判官收不到只能空轉，須主控轉存檔案再轉交
state: done
link: agents/fankeel-judge.md
done:
  at: 2026-10-19
  sha: 91b4dbf4
  disposition: done
  session: 94618e2b-bdfb-4d9d-ab4d-a18b8697a719
---

來源：2026-10-19 session ba5a894e 執行 /fankeel-ask 分析 cursor/plugins 時發生。判官（fable）在背景派出 8 個 fankeel-reader，讀者完成後的 SubagentHandback 全部以 agent-message 送到主對話，判官端只看到讀者仍在跑、輸出檔 0 位元組，兩次結束時都沒交出答案（自述「讀者尚未回報」）。最後由主控從 subagents/agent-<id>.jsonl 取出每份 handback 存到 .fankeel/build/ask/1-cursor-plugins-readers/，再 SendMessage 把路徑交給判官才完成。

要變成：判官的讀者回報要能回到判官本身——可能是讀者以前景（run_in_background false）派出、或 agents/fankeel-judge.md 指示等待方式、或由 judge.js 提供一個收集讀者 handback 的腳本；需先查清 harness 對巢狀背景子代理 handback 的路由規則。

完成的樣子：再跑一次 /fankeel-ask，判官在不需主控介入下拿到全部讀者回報並一次交出答案；agents/fankeel-judge.md 寫明派法並有測試或 eval 案例釘住。

## 完成紀錄

judge 和 stage agent 派讀者時改在前景等它回報，回報不會再送到主對話去。

- commit 91b4dbf4
