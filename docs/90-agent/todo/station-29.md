---
label: station
title: 花費成分說明
description: station 花費表每個成分旁加說明，花費頁放一張成分說明表，單價讀 `lib/prices.js`
state: ready
link: assets/station/station.js
---

來源：2026-10-19 使用者要求監控站顯示花費成分，本週判斷書（連結）。
要做什麼：assets/station/station.js 的 costHtml 顯示的每個成分（cache read、cache write 1h、cache write 5m、output、uncached input）旁加說明（tooltip 或可展開區），花費頁另放一張「成分說明」表。說明內容原樣如下：
- cache read：每回合從頭重讀到目前為止的整段對話（系統提示、工具定義、CLAUDE.md／MEMORY.md、hook 每回合注入的規則、所有之前的訊息、工具結果、agent 回報）。已在快取，單價最低（Opus $0.2/M），但等於 context 大小 × 回合數，所以常是最大項。subagent 自己的每回合也一樣。
- cache write 1h：主對話每回合新增的那段寫進 1 小時快取（Opus $8/M，cache read 的 40 倍）：你的訊息、上一回合輸出與思考、工具結果、agent 回報、跨 session 轉送、hook 注入。整段重寫的情況：離開超過 1 小時快取過期、壓縮後新前綴、前段內容變動。
- cache write 5m：subagent 用 5 分鐘快取（Opus $5/M、Sonnet $2.5/M）；每個 agent 從零開始，系統提示、工具定義、技能、brief 要整段寫一次，之後每回合寫新增部分。派越多 agent 越高。
- output：模型產出——回覆文字、思考、工具呼叫參數（Write／Edit 的整段檔案內容也算）。單價最高（Opus $20/M）但量少。
- uncached input：最後一小段沒落在快取的輸入，通常接近 0。
價目以 lib/prices.js 為準，說明裡的單價要從那裡讀，不寫死。
完成條件：每個顯示成分的地方都有說明可看，價格跟 lib/prices.js 一致。
