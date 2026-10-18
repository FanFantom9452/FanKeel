---
label: judge
title: 判官大量閱讀改派讀者
description: 判官（fankeel-judge）讀大量資料時自己付 fable xhigh 的價，要能把閱讀派給 sonnet/opus 讀者
state: done
done:
  at: 2026-10-19
  sha: 11a98619
  disposition: done
  session: 65a1bc64-af34-4bee-a429-ad2577882dcc
---

來源：2026-10-18 /fankeel-ask 分析 10/16–10/18 session 花費時，使用者問判官讀資料是自己讀還是派子 agent。查 agents/fankeel-judge.md：tools: [Read, Grep, Glob, Bash]，沒有 Agent，model: fable、effort: xhigh——判官每個讀進來的 token 都付 fable xhigh 的價。要變成什麼：判官能把大量閱讀派出去——一般整理派 fankeel-reader（sonnet），檔案很大且總結品質要求高時派 opus；判官只對總結做判斷。要決定的：給判官 Agent 工具並在 agent 檔寫派遣規則，或改由 /fankeel-ask 的主控在 brief 前先派 reader 整理成數字表交給判官；還有總結失真（reader 的整理方式決定判官看到什麼）怎麼防，例如判官可抽查原始檔。完成條件：判官（或 fankeel-ask 流程）在 brief 指向大檔時會派 sonnet/opus 讀者，判官本身讀入的 token 明顯下降；以一次 ask 的前後花費量測（同題、同資料）證明，記錄在 docs/90-agent/reports/。

## 完成紀錄

判官現在先把要查的地方列成清單，再一次派出最多四位讀者去讀，讀完寫一段長的總結，目標三輪內收尾。原本超過 300 行才派讀者的做法量過後不划算，已經被取代。

- commit 11a98619
- commit 0227df57
- commit 0fbb6d5c
- commit 10ab13b9
