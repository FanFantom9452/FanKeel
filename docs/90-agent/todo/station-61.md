---
label: station
title: gate 板子編輯改 icon、互動順
description: gate 頁板子編輯工具列用 icon 取代文字按鈕，並讓拖曳、平移、縮放順手
state: ready
link: assets/station/board-edit.js
stamp: 2026-10-27
---

使用者 2026-10-27 在真瀏覽器裡試 gate 頁板子編輯：功能都正常（移動 api、collab 共 6 次都寫進板子檔），但操作不流暢，也不夠視覺化。

要求：工具列用 icon 取代文字按鈕。現在 assets/station/board-edit.js 第 47-55 行的 TOOLS（select/add-node/add-edge/mark/delete/undo）是用 toolName() + loc() 的中文字標示，沒有 icon。

拖曳只在 tool==='select' 時才動（pointerdown 約第 346 行，3px 門檻，用 transform 移 node group），要整體檢視拖曳、平移、縮放的手感。

參考：使用者說之前 Chartroom 的設計互動很好。docs/90-agent/judgements/2026-10-19-chartroom-mermaid-station.md 第 126、180、227 行記載原本的互動在 Chartroom 的 React Board.jsx + interact.js（pan/zoom/select/drag/Enter-drill/breadcrumb），本來要改寫成 vanilla assets/station/board.js，但那檔不存在；lib/chartroom/README.md 說只 vendor 了 core+geometry、沒有互動碼；原設計文件在 docs/99-archive/2026-10-20-chartroom-board-design.md。這台機器上 F:/ymlab/_ext/chartroom/src 不存在。

完成條件：工具列每個工具是 icon（有 title/aria-label 提示文字），拖曳/平移/縮放在真瀏覽器裡使用者說順；走 design 先出 mockup。

併入：2026-10-27 起，「gate 板子面板缺真截圖」(build-15) 的驗收一併在這裡做。那條在 10-27 拍過 412 與 1440，但截圖在 SVG 載入前就拍了，412 寬還會溢出，所以本條完成時要再加兩件事：截圖等板子 SVG 載入後才拍（render.js 的 `--act` 先 `wait`），以及 412 寬不溢出。
