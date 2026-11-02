---
label: registry
title: session 與 build 集中歸檔
description: 已結束的 session 與已 land 的 build 過程檔搬到機器層級的集中歸檔，加 node:sqlite 索引，永不刪 — [registry.md](docs/90-agent/reference/registry.md).
state: ready
link: docs/90-agent/reference/registry.md
---

來源：2026-11-01 教授談話（語音 261101_151532.txt L1431–L1472）教授問背後是否用 Postgres，使用者承認檔案一直累積會是問題；2026-11-02 使用者在 design 關卡說不要清除 session，要的是集中管理。判官 docs/90-agent/judgements/2026-11-01-shared-session-state.md 選 A：進行中狀態留本機，不推共用層。量測：fankeel repo 有 483 筆 session（6.3MB）、777 個 build 項目、47 個 tmp 檔。要做成三層：進行中留在各 repo 的 .fankeel（hook 不變）；歸檔放 config 目錄下 fankeel/archive/<project>/<task>/，壓縮、永不刪，搬入條件是 active:false 且已 ended，或 build 對應的任務已有 record；索引用 Node 24 內建 node:sqlite，記專案、任務、stage、花費、檔案位置，檔案本身仍是檔案。先 survey station、fankeel-weekly、task.js adopt 怎麼讀 sessions 與 build，讓它們也讀歸檔。完成條件：跑一次歸檔後 repo 的 .fankeel/sessions 只剩 live 與近期條目、檔案數不減少只搬移；station 歷史頁與週報仍列得出被搬走的 session；adopt 能從歸檔撈回 handed-off 條目。

2026-11-02 使用者在 plan 關卡補充（排在最後、較難）：長期方向是像 Anthropic 那樣，所有 session 跑在同一台機器上，由 agent 呼叫雲端 server 的 API 回傳檔案狀態；先做本機集中歸檔與索引，這一步放最後。

2026-11-02 盤點 plan：讀過之後這是新子系統，不是 bounded 修改——session 條目沒有 task id（只能由 `started` 推出 build 目錄，lib/handoff.js:44-48）、record 是按月的 `records/YYYY-MM.md`、`readAll` 之外 lib/weekly-collect.js:117-124 自己讀 sessions 目錄，另有 station、spend、profile、settingsuggest 共六處讀者，adopt 只認 `.fankeel/sessions/`。要另開 architectural 任務、先做 design；`engines` 的 `>=22.5` 下 `node:sqlite` 需要旗標，也要在 design 裡決定。
