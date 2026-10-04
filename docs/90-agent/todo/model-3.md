---
label: model
title: brain 該用 opus 還是 sonnet
description: fankeel-brain 釘 sonnet，只有 design、plan 改送 opus；同一題 opus brain 對 sonnet brain 的來回次數、花費與缺陷數從沒對照過
state: ready
link: lib/stages.js
---

來源：2026-10-04 使用者在 TODO 全表盤點的 build 中提出（session 106c6f2b），問 brain 用 sonnet 是否真的好，opus 當 brain 會不會比較不用跑那麼多次。現況：`agents/fankeel-brain.md` 釘 `model: sonnet`、`effort: medium`，只有 design 與 plan 的主控規則改送 `model: opus`（`lib/stages.js:680`）；2026-09-20 的 survey-brain-ab 量的是大腦新舊模式，當時大腦是 opus，不是同題 opus 對 sonnet。本 session 已見三件事，但 stage 不同、各只一次，不能拿來比：plan brain（opus）的 commit 請求把計畫標題寫在路徑位置，commit.js 失敗一次；survey brain（sonnet）沒派 reader 全部自己讀；build 第 2 組（sonnet）被 reviewer 抓到一行註解，多一次 fixer 與 commit。要做：同一份計畫的同一組 task、同一個 base sha，兩臂只差 brain 的 model（Agent 呼叫帶 `model` 蓋掉檔案的釘），每臂至少三次、兩臂交替跑。量：主控來回次數（commit 請求、SendMessage、relay、gate.js 退回的關卡、交接檔格式錯誤）、brain 連子 agent 的 token 與 `modelUsage` 換成的錢、wall-clock、reviewer 找到的缺陷與 fixer 次數、verify 退回 build 的列。完成條件：一份報告進 `docs/90-agent/reports/`，附原始輸出與 HEAD，並據此在 `docs/90-agent/reference/model-choice.md` 寫下 brain 維持 sonnet、改 opus 或按 stage 分。
