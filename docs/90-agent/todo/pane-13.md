---
label: pane
title: Desktop 窄 band 裁掉 ⚑
description: Claude Desktop 的 Svg band 第二行在 Pane 開著、band 變窄時看不到 ⚑N，色帶已經變紅 — [hooks/pane-svg.ts](hooks/pane-svg.ts).
state: ready
link: hooks/pane-svg.ts
---

來源：2026-10-17 TODO 全表盤點實測「面板真機沒看完的四件事」。兩個 session 撞同一個檔時，Desktop 這邊的 band 兩行左邊都變成紅色色帶，表示 clashes 已經算出撞檔；但右側 Pane 開著、band 比較窄的那張截圖，第二行在 7d 的骷髏後面就結束了，沒有 ⚑1。Pane 收起、band 變寬後，同一個撞檔的 ⚑1 就出現在骷髏後面。終端的文字 band 沒有這個問題。推測是 bandRow2Svg 把 ⚑ 排在最後，而 Svg 的寬度固定是 cols 乘以 CELL_PX，窄的時候 ⚑ 畫到寬度外面被裁掉。要做成：窄寬度時 ⚑ 一定看得到，例如寬度不夠時先讓出 7d 的偏差或標記，或把 ⚑ 排到 ctx 前面；寫一個在窄 cols 下斷言 ⚑ 落在 Svg 寬度內的測試。完成條件：測試在現況是紅的、修完是綠的，Desktop 開著 Pane 撞檔時第二行看得到 ⚑。
