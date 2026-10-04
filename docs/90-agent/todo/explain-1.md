---
label: explain
title: 任務做完看得懂它做了什麼
description: Karpathy 四層做法（受控語言、圖、HTML、影片）只套在主 session、提問與 docs 三處
state: decision
link: skills/fankeel-explain/SKILL.md
---

來源：2026-10-05 使用者在 TODO 全表盤點的 plan 階段中提出（session 8c77b36e），貼了 Karpathy 的一段話：模型越強，人越要花時間看懂它的輸出。文中由淺到深列了四層做法：一是用受控語言寫（ASD-STE100，航空維修文件用的，句子短、用字受限）；二是能畫圖就不寫；三是直接交 HTML 網頁，可以互動、有動畫；四是為題目做講解影片（3Blue1Brown 風格，旁白用本機的免費 TTS）。使用者要的是：每個任務完成後，看得懂它做了什麼。只套在三處：主 session 對使用者說的話、Claude 的提問（AskUserQuestion）、docs 文件，其他邏輯維持原樣。要先討論再定：四層各用在三處的哪裡；哪些已經有了（fankeel-explain、fankeel-writer、station 頁、render 腳本）；受控語言要寫成規則，還是交給 checker 檢查。完成條件：使用者選定做法，拆成 Ready 條目或一份 design，然後關閉本條。
