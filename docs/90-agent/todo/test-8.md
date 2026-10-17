---
label: test
title: 並行測試撞 Windows 認可上限
description: 兩組完整測試同時跑會撞 Windows 認可上限，特徵已寫進 README.md；剩 3 項沒有 stderr 的失敗未證實 — [README.md](README.md).
state: watch
link: README.md
group: 認可量耗盡再發生
timing: if: 整套測試再出現 VirtualAlloc failed、0xC0000409 或 0xC000012D
stamp: 2026-10-18
---

來源：2026-10-16 同時啟動兩組 `node --test` 完整測試（FANKEEL_BROWSER 設為 Chrome 完整路徑），分別失敗 17 與 13 項；同一個 commit b4281f84 單跑 `scripts/suite.js` 為 4397 通過、0 失敗。紀錄：C:\Users\user\AppData\Roaming\Claude\side-session-notes\local_b1fea4fc-ed8a-4178-900b-a3fe8095588a\runA.txt 與 runB.txt。

30 項失敗的分類：24 項是記憶體不足崩潰（19 項 `VirtualAlloc failed` / exit 0xC0000409，1 項 0xC000012D STATUS_COMMITMENT_LIMIT，3 項 git/sh `Out of memory` 或 cygheap 複製失敗，1 項 spawnSync UNKNOWN）；3 項沒有 stderr（tests/docs-audit.test.js:123 的 git exit 128、tests/render-cli.test.js:151 的 Chrome exit 1、tests/tracked.test.js:63『fanout is the same answer whatever the width』的 git fallback），多半也是記憶體，但未證實；1 項是 station 首次掃描預算（tests/station-cli.test.js:248），README.md:260 已列。兩次執行之間沒有找到共用狀態。

原因：機器認可上限 222 GB，vmmemWSL 占約 158 GB，閒置時只剩 0.7 GB。不是 fankeel 程式的錯。

2026-10-18：vmmemWSL 已從約 158 GB 降到 70.7 GB，可用虛擬記憶體約 85 GB；README.md 的 `## Development` 已寫明 VirtualAlloc failed、0xC0000409、0xC000012D 是 Windows 認可量耗盡，不是測試的錯，所以不再重跑兩組並行測試。

未證實的三項（沒有 stderr，多半也是記憶體）：tests/docs-audit.test.js:123 的 git exit 128、tests/render-cli.test.js:151 的 Chrome exit 1、tests/tracked.test.js:63『fanout is the same answer whatever the width』的 git fallback。

要做成：這三項在整套測試單跑時再失敗，就各自查原因；特徵本身 README 已點名。

完成條件：三項各自查出原因並在 README.md 點名，或確認不再出現後關掉此條。
