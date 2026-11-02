---
label: judge
title: 判官 reader 數讀 profile
description: 判官與 fankeel-ask 寫死一次 8 個 reader；改成讀 dispatch.inflight，由 agent 自己決定哪些組成 workflow、哪些分開成 group
state: ready
link: agents/fankeel-judge.md
---

2026-11-02 使用者問為什麼判官最多 8 個：station 的 slider 可以設到 20 或不設上限，agent 要自己判斷哪些合成 workflow、哪些單獨成 group。profile 的值不會傳進 subagent，所以 dispatch 的 prompt 要帶上 inflight 的值，或請 agent 自己跑 task.js profile show。dispatch.inflight 已在同一天設成 unlimited。
