---
label: test
title: 上限測試沒量到壓縮過的行
description: tests/render.test.js 的 3000 字上限測試想量壓縮過的 context 行，但 fixture 多跳脫一層，讀成沒壓縮過；最長的那一行從來沒被量到
state: ready
link: tests/render.test.js
---

來源：2026-10-12 compact 任務的 verify。tests/render.test.js 的測試 the whole injection stays a readable size with everything populated，註解說一個壓縮過的 session 的 context 行是區塊裡最長的一行、所以 fixture 帶一筆 compact_boundary。但 fixture 在 JS 原始碼裡寫了四個反斜線，落到檔案上是兩個，lib/context.js 的 DROPPED 樣式只容許引號前有零或一個反斜線，所以對不上：用同一個 fixture 呼叫 inspect 得到 dropped 0、used 652364，render 畫的是 nothing dropped yet 那一行，不是帶 tokens dropped、--session id 與 Start a fresh session 的那一行。現況是這條測試量到 2994 字上下（含 2026-10-12 新加的 No auto-compact window 那一句，離上限只剩幾個字），而真正最長的那一行沒有被量過。要做的：把 fixture 改成 tests/context.test.js 的 compaction() 那種一層跳脫，確認 inspect 讀到 dropped 1120198；量出壓縮過那一行的區塊大小；再加一格量忙、沒壓縮過、沒設視窗的那一行，兩格都要在上限內，超過就由使用者決定縮字或調上限。完成條件：兩種行各有一個會紅的測試，數字記在這裡。
