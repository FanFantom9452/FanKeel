---
status: decision
last_verified: 2026-11-03
---

# 已收工的任務也能匯出 ZIP（11-03）

一句話：`record.js session --closed` 讓已收工的任務事後補打對話包，`record.js export` 在只有一個包時不用 `--cross`；land 的關卡選項不動。

依據判決 [closed-task-zip](../90-agent/judgements/2026-11-02-closed-task-zip.md)（選 A 加 B 的後半）。

## 決定

- `session --closed` 接受 `active:false` 的 entry，走同一條 `bundle.pack` 與 `sensitive.redact`，遮蔽與收工前打包一樣。
- `export` 的 `--cross` 改成可選：不給且只有一個 `--bundles` 時，`report.md` 只放該包的 `## retro <id8>`；不給卻有多個包仍拒絕。
- `report.md` 也過一次 `sensitive.redact`，與包和 manifest 一致。
- 不自動在收工時打包，land 的選項不變。

## 為什麼

收工只把 `active` 翻成 false，record、configDir、sessions 都留著；擋住事後打包的只有 `activeEntry` 那一個檢查。單一包沒有「跨」可言，`import` 也不驗 `report.md`，所以不需要錨點。手動壓 ZIP 會漏掉遮蔽。

## 放棄了什麼

- 收工時自動打包：違反「使用者答應才匯出」，且吃磁碟。
- 另開不經登錄的指令：多一條要維護的路，遮蔽要重接。
