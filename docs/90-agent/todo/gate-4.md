---
label: gate
title: gate 少於三選項沒擋
description: 選項只檢查 2 到 4 個，規則下限是三；10-01 build、verify、land 三次只給兩個都放行
state: ready
link: lib/handoff.js
---

`gateProblem` 在 `lib/handoff.js` 第 270 行只要求選項有 2 到 4 個，但 `ALWAYS[0]` 與 fankeel skill 的 gate 規則寫的是至少三個，暫停那一項不能拿掉。

Session a6409b07-9136-41b8-ba6d-173a1a676500（TODO 全表盤點）中，stage agent 寫了三次只有兩個選項的 gate，`hooks/gate.js` 都放行了：`build-2.md`（verify／暫停）、`verify-2.md`（land／暫停），以及 land 第二版之後的那一題（收工／暫停）。另外第一次進 verify 時還有一題兩個選項的 gate，它的 option one 標的是 land，描述卻寫「回 build」，主控沒問就改走 build。

同一個 session 裡還有一題 land gate 寫錯了事實：說 await-1 仍開著，其實它已在 f7fdbb5c 標成 done。這種錯機械檢查抓不到，只記在這裡。
