---
status: decision
last_verified: 2026-10-12
---

# fankeel 面板（10-12）：兩行常駐，細節放 Pane

一句話：任務的狀態分兩處顯示，輸入框上方兩行一直都在，細節與 gate 的完整說明放在側邊的 Pane；終端與 Claude Desktop 都畫得出來，Pane 在 session 有任務時自己打開。

design 在 [2026-10-11-fankeel-pane-design.md](../99-archive/2026-10-11-fankeel-pane-design.md)，現行的版本是它的第 6 節。
兩份計畫在 [2026-10-11-fankeel-pane.md](../99-archive/2026-10-11-fankeel-pane.md) 與 [2026-10-12-fankeel-pane-band.md](../99-archive/2026-10-12-fankeel-pane-band.md)。
沒看完的真機項目記在 [pane-1](../90-agent/todo/pane-1.md)。

## 決定

- 輸入框上方畫兩行。第一行是現在的階段、整條路線的圓點、guard、這一站用了多久、任務標題。第二行是下一步；有 gate 在等時改成黃底的提醒。
- 兩個 session 碰過同一個檔時，第一行多一個紅色的 `⚑` 和撞檔的數目。
- 側邊的 Pane 用 `/fankeel-panel` 開關。它顯示 context 用量與自動 compact 的門檻、plan 做到第幾個 task、任務的 notes、其他 session、這個任務碰過的檔。
- gate 在等時，Pane 最上面畫出題目，每個選項底下是它的完整說明，可以直接在 Pane 上按選項作答。
- session 一有任務，Pane 自己打開，任務結束時自己關。使用者用指令關掉之後，同一個任務不再自己跳出來，只有新的 gate 會再打開它。
- 顏色沿用 TokenBar 的 lead 配色，七個階段各一個顏色。
- 終端與 Claude Desktop 都畫這兩處。Remote Control 與手機 app 畫不出 mod，那裡什麼都不顯示。
- mod 沒載入時一切照舊：狀態列、gate 的問答、監控站都不依賴它。

## 為什麼

- 使用者要在 Claude Desktop 也看得到任務狀態，而原本只有終端的狀態列。
- 實測推翻了「Desktop 畫不出 mod」的假設。Desktop 沒顯示，是因為它讀的是安裝時的快照，不是工作目錄；把新版放進快照後，兩行與 Pane 都畫得出來。
- 兩行夠放「現在在哪、下一步是什麼」，一直看得到。其餘的資訊多又長，放在可以關掉的 Pane。
- gate 的選項說明寫的是每條路會發生什麼。使用者看過原型後要求完整呈現，不能只有標題。
- Pane 自己打開，是使用者在 Desktop 上看過之後要求的。
- 先用真機原型代替 HTML mockup，是因為終端的版面用 HTML 畫不準，直接在畫面上看比較快。

## 放棄了什麼

- 10-07 那頁說 mod 不在 session 開始時自己開 Pane，這次改掉了。
- 多題或多選的 gate 不能在 Pane 上作答，Pane 只顯示一行，請使用者到終端或監控站回答。
- 指令原本叫 `/fankeel-pane`，10-12 改名，舊名沒有留別名。
- 真機只在 Claude Desktop 用一筆假的任務看過兩行與 Pane。撞檔的 `⚑`、在 Pane 上答一次真的 gate、終端上的樣子、Pane 自己打開，這四件事留到下一個真的任務。
- 重新載入 mod 之後，舊的那份打開的 Pane 不會在任務結束時自動關。
- Claude Desktop 要先執行 `claude plugin update fankeel@fankeel` 才會讀到新版；這一步沒有自動化。
