---
label: test
title: 並行測試撞 Windows 認可上限
description: 兩組完整測試同時跑時因 Windows 認可上限耗盡而失敗：WSL 釋放認可量後重跑兩組，並在 README.md:260 補一句辨識特徵 — [README.md](README.md).
state: blocked
link: README.md
group: WSL 認可量釋放後重跑
timing: after: WSL commit is freed or the machine is idle
stamp: 2026-10-16
---

來源：2026-10-16 同時啟動兩組 `node --test` 完整測試（FANKEEL_BROWSER 設為 Chrome 完整路徑），分別失敗 17 與 13 項；同一個 commit b4281f84 單跑 `scripts/suite.js` 為 4397 通過、0 失敗。紀錄：C:\Users\user\AppData\Roaming\Claude\side-session-notes\local_b1fea4fc-ed8a-4178-900b-a3fe8095588a\runA.txt 與 runB.txt。

30 項失敗的分類：24 項是記憶體不足崩潰（19 項 `VirtualAlloc failed` / exit 0xC0000409，1 項 0xC000012D STATUS_COMMITMENT_LIMIT，3 項 git/sh `Out of memory` 或 cygheap 複製失敗，1 項 spawnSync UNKNOWN）；3 項沒有 stderr（tests/docs-audit.test.js:123 的 git exit 128、tests/render-cli.test.js:151 的 Chrome exit 1、tests/tracked.test.js:63『fanout is the same answer whatever the width』的 git fallback），多半也是記憶體，但未證實；1 項是 station 首次掃描預算（tests/station-cli.test.js:248），README.md:260 已列。兩次執行之間沒有找到共用狀態。

原因：機器認可上限 222 GB，vmmemWSL 占約 158 GB，閒置時只剩 0.7 GB。不是 fankeel 程式的錯。

要做成：WSL 釋放認可量後（`wsl --shutdown` 已被婉拒，因為其他 session 在用 WSL/Docker）重跑兩組同時的完整測試，確認那 3 項未證實的；並在 README.md:260 加一句，把 VirtualAlloc failed / 0xC0000409 / 0xC000012D 這組特徵說明為認可量耗盡，不是測試的錯。

完成條件：認可量有餘裕時兩組同時跑都通過，或剩下的每項失敗都在 README.md:260 點名。
