---
label: pane
title: Desktop 窄 band 裁掉 ⚑
description: 程式碼已修（d9a6351c），剩 Desktop 開著 Pane 撞檔時親眼看第二行有沒有 ⚑N — [hooks/pane-svg.ts](hooks/pane-svg.ts).
state: ready
link: hooks/pane-svg.ts
---

來源：2026-10-17 TODO 全表盤點實測「面板真機沒看完的四件事」。兩個 session 撞同一個檔時，Desktop 這邊的 band 兩行左邊都變成紅色色帶，表示 clashes 已經算出撞檔；但右側 Pane 開著、band 比較窄的那張截圖，第二行在 7d 的骷髏後面就結束了，沒有 ⚑1。Pane 收起、band 變寬後，同一個撞檔的 ⚑1 就出現在骷髏後面。終端的文字 band 沒有這個問題。推測是 bandRow2Svg 把 ⚑ 排在最後，而 Svg 的寬度固定是 cols 乘以 CELL_PX，窄的時候 ⚑ 畫到寬度外面被裁掉。要做成：窄寬度時 ⚑ 一定看得到，例如寬度不夠時先讓出 7d 的偏差或標記，或把 ⚑ 排到 ctx 前面；寫一個在窄 cols 下斷言 ⚑ 落在 Svg 寬度內的測試。完成條件：測試在現況是紅的、修完是綠的，Desktop 開著 Pane 撞檔時第二行看得到 ⚑。

## 進度（2026-10-17）

d9a6351c 改了 hooks/pane-svg.ts 的 bandRow2Svg：有撞檔、而且排到最後的 ⚑N 會超出 cols 乘以 CELL_PX 時，把 ⚑N 改排在色帶之後、ctx 之前；寬度夠時照舊排最後。tests/pane-svg.test.js 新測試用 cols 24、撞檔 2，斷言 ⚑2 落在 192 px 以內，改之前是紅的；寬版的「⚑N 排最後」測試照舊是綠的。還沒做的一件：0.111.19 裝好後，在 Desktop 開著 Pane、兩個 session 撞同一個檔，看第二行有沒有 ⚑。這件做完本條才關。
