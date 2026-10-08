---
label: station
title: station 讀不到 live subagent
description: station 讀不到 live session 的 subagent：只讀 leave.js 寫的 usage，不讀 subagents/*.meta.json 與 inflight 標記 — [lib/station.js](lib/station.js).
state: watch
link: lib/station.js
group: 即時 session 缺 subagent
timing: if: 有人需要在即時 session 上看到進行中的 subagent
stamp: 2026-09-26
---

來源：根目錄 TODO.md 第 211 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：station 讀不到 live session 的 subagent：只讀 leave.js 寫的 usage，不讀 subagents/*.meta.json 與 inflight 標記

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。
