---
label: station
title: chat.jsonl 同時寫入掉行
description: chat.jsonl 超過 200 行後 append 會重寫整檔，兩個工具同時結束可能掉一行 tool-end
state: ready
link: lib/phone.js
---

來源：2026-10-22 手機頁接上 session 任務的 build 收尾審查（.fankeel/build/task-20261022T065333/build.md），列為取捨未修。lib/phone.js 的 append 在超過 200 行時讀整檔、截尾、整檔重寫；兩個 PostToolUse 幾乎同時跑時，後寫的會蓋掉先寫的那一行，手機上那一步會一直顯示成失敗。應改成：重寫時用暫存檔加 rename，或改成只在超過一個較大的門檻時才截尾、平常純 append。完成的標準：一個測試同時跑兩個 append 到已滿 200 行的檔案，兩行都留下。
