---
status: decision
last_verified: 2026-10-17
---

# TODO 全表盤點（10-17 第二輪）：盤點不能再跳過 Blocked 和 Watch

一句話：這次盤點的 survey 只查了七條 Ready、其餘 22 條只看標題，使用者抓到後，盤點報告改由腳本檢查——每一條還開著的條目都要有自己一行和處置，少一條關卡就退回；另外修好 station.md 三處指錯行的引用，README 補上記憶體認可量耗盡的特徵。

計畫在 [2026-10-17-patrol-every-entry.md](../../../99-archive/2026-10-17-patrol-every-entry.md)，設計在 [2026-10-17-patrol-every-entry-design.md](../../../99-archive/2026-10-17-patrol-every-entry-design.md)。

## 做了什麼

- 盤點的 survey 報告現在由腳本檢查：每一條還開著的條目，都要有一行寫出它的編號或標題，旁邊寫 `do now`、`needs the user`、`waiting on` 或 `keep` 其中一個。少一條，階段代理寫檔時就會聽到缺哪幾條，控制端要問關卡時也會被擋下。拿這次一開始那份報告去試，它被擋下，並點出漏掉的 22 條。
- 檢查只在兩種情況下生效：TODO 是一條一個檔的形式，而且 survey 交給階段代理跑。手寫的 TODO.md 和在本 session 裡直接跑的盤點沒有檔案可讀，那時候只靠 skill 裡的規則；skill 已經寫明這個範圍。
- station.md 三處指錯行的引用改指到它們描述的程式，並補上引號，以後行號漂移 docs-check 抓得到（station.md 三處引用指錯行，結案）。
- README 講並行測試的那段，補一句：兩組完整測試同時跑、出現 VirtualAlloc failed 或 0xC000012D，是 Windows 認可量耗盡，不是測試的錯。「並行測試撞 Windows 認可上限」這條只做了這一半，重跑兩組還要等 WSL 釋放記憶體，所以仍是 Blocked。
- 「Pane 偵測網頁服務給開啟鈕」不做了：使用者說 Desktop 內建的 preview 已經能開網頁服務，測過沒問題。

## 沒做什麼

- 其餘五條 Ready 都要使用者在 Desktop 或終端親手操作：子代理 brief 改走 spawn、Desktop 真機看壓縮視窗、面板真機沒看完的四件事、終端啟動讀遠端狀態、接縫「profile 中途翻轉」。
- 十條 Blocked 逐條查過，只有「並行測試撞 Windows 認可上限」有一半能做；其餘九條的外部條件都還沒到，或要使用者操作。
- 十二條 Watch 逐條查過，十條的事件沒發生；「發版時做講解影片」和「brain 該用 opus 還是 sonnet」要使用者決定。幾條偶發失敗的測試單獨跑都是綠的，手上沒有失敗輸出可以修。

## 順手發現

- verify 的對抗審查指出，`hooks/gate.js` 原本只用讀原始碼的方式測，沒有真的跑這個 hook；退回 build 補了一個真的執行它的測試，拿掉那一行接線就轉紅。
- 工作區有四份 10-10 計畫的舊副本沒進 git，內容和歸檔版不同；profile.json 少了一行 implementer 用 haiku 的設定。兩件都沒動，留給使用者決定。
