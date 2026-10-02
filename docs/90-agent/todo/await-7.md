---
label: await
title: 晚醒的 agent 搶走 inflight
description: build-2 的 brain 在背景工作未完時先送出完成通知，約 32 分鐘後醒來，registry 的 inflight 被改成指向它，下一站 audit 的控制規則叫主控把使用者答案轉給這個 build agent — [hooks/brief.js](hooks/brief.js).
state: ready
link: hooks/brief.js
---

來源：2026-10-02/03 session 5cd1d1c5 的「設計寫文件的 agent」task。build-2 的 stage brain 回報 build-2.md 後 task-notification 標註「stopped with background work of its own still running」，主控照流程往下走到 audit；約 1934 秒後同一個 build agent 再次完成，之後注入的 audit 控制規則寫著「A audit stage agent is already running for group 1 (build 那個 agent id)」，下一輪更出現 group 1、group 2 兩個 audit agent。照規則轉答案會送給一個 build 站的 agent。主控改以實際在跑 audit 的 agent 為準，git 證實晚醒的 agent 沒有改檔。要做成：inflight 記錄 agent 所屬的 stage，標記或清除時比對目前 stage；一個已交出 handoff 的舊站 agent 再次啟動或結束，不得把自己寫成新站的 inflight，也不得佔用 group 編號。完成條件：node --test 重現——stage 從 build 換到 audit 後，舊 build agent 的 SubagentStart/Stop 事件不改變 audit 的 inflight，控制規則只列 audit 自己派的 agent。
