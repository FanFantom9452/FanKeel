---
label: await
title: await 印出去掉 CRLF 的 gate
description: 主控每次都自己寫 awk 解析交接檔的 json gate 區塊，CRLF 讓它解析失敗
state: decision
link: scripts/await.js
---

來源：2026-10-21 TODO 全表盤點 land 的 retro（session 9f451488）。使用者裁定全部先記成 TODO，之後交給判官判斷要不要做。 主控手寫 awk 解析交接檔最後的 json gate 區塊共 19 次，Windows 的 CRLF 讓它回傳空白，加上 tr -d 才正常。要做成：scripts/await.js 交接時直接印出最後一個 json gate 區塊，已去掉 CRLF。完成條件：判官裁定；做的話，有測試用 CRLF 交接檔驗證印出的區塊可直接解析。
