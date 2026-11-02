---
label: await
title: 逾時轉背景的 lost 判斷
description: CC 2.1.311 前景命令逾時改為顯示目前輸出並轉背景繼續跑，await 的 lost 判斷要認這個新結果文字。
state: ready
link: docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md
---

來源：judgement docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md。2.1.311 changelog :239、:282 與 2.1.300 :772：背景 agent 等自己的 shell 不再每次喚醒開新主回合、Claude 不再輪詢背景輸出、前景命令逾時改為轉背景。影響 scripts/await.js、subagents.md:628-654（背景 Bash 結束是否喚醒 controller 未觀察）、:927（前景 Bash 可能跑很久沒寫入即判 lost）。要做成：重新觀察 :654 的喚醒行為，並讓 :927 的 lost 判斷認得逾時轉背景的結果文字，不再誤判。完成條件：觀察結果寫回 subagents.md，await 對轉背景結果有測試。
