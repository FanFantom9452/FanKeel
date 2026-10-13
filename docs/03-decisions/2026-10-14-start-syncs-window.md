---
status: decision
last_verified: 2026-10-14
---

# 開任務時同步壓縮視窗（10-14）：`task.js start` 把主機視窗寫成 `compact.at`

一句話：每次用 `/fankeel` 開任務，`task.js start` 會把使用者 `settings.json` 裡的 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 對齊 profile 的 `compact.at`，值有變動時請使用者重新啟動 Claude Desktop。

這取代 [10-12 的決定](2026-10-12-compact-at.md)裡「不再寫使用者的設定檔」那一部分；那份決定的其餘部分照舊。它也推翻 [10-03](2026-10-03-mod-route.md) 記下的「裝好後大部分不需要修改 Claude 設定」在這一個鍵上的適用。

## 決定

- 開任務時，`start` 讀專案與機器合併後的 `compact.at`；兩邊都沒設就用內建的 450000。
- 它只拿這個數字和 `settings.json` 裡的值比。一樣就什麼都不做；不一樣才寫，並印一行請使用者重開 Claude Desktop，因為已經開著的 session 仍是舊值。
- 視窗寫成和 `compact.at` 同一個數字。主機會比這個數字早大約 3 萬 token 壓縮，所以實際上是主機先壓，fankeel 自己的 mod 變成備援。
- `compact.at` 是 `off` 時不碰視窗。機器上有早先的 init 留下的 `compact-window.declined` 標記時也不碰。
- 寫不進去（檔案解析不了、唯讀、被鎖住）時印出原因，任務照常開始。
- 使用者自己手動寫在 `settings.json` 的數字會被 `compact.at` 取代。

## 為什麼

- 2026-10-13，SBIR 工作區一個 Claude Desktop 的 session 有 fankeel 任務、context 到 530k、turn 結束過 20 次，一次都沒有壓縮。
- 它跑的版本已經有 fankeel 的壓縮 mod。問題不在版本：mod 要每個 session 到 `/plugin` 按一次 Enable 才會載入，沒按就完全不動作，而且沒有任何訊號。
- 主機自己的視窗不需要按任何東西，turn 進行中也會壓。但它要有人去設，而 init 只在專案第一次導入時問一次。
- 使用者要的是入口就處理，並且跟著 profile 變：改了 `compact.at`，視窗下次開任務就跟上。

## 放棄了什麼

- 放棄「視窗＝`compact.at` 加 3 萬」。那樣主機會大約在 `compact.at` 的位置壓，語意比較貼近 profile；但 3 萬是從 100000 和 200000 兩個量測點外推的，450000 沒有量過。
- 放棄 `off` 時把視窗的鍵刪掉。那需要新的移除動作，還要分辨哪個值是使用者手寫的。
- 放棄讓每個專案有自己的視窗。視窗全機只有一個值；兩個專案的 `compact.at` 不同時，後開任務的那個贏。
- 放棄保留最初的原檔備份。每次改寫只留改寫前那一份 `.fankeel-bak`，更早的會被蓋掉。

## 還沒確認的

- 寫在 `settings.json` 的視窗在 Claude Desktop 上會不會讓主機自己壓，還沒有實測；待辦「Desktop 真機看壓縮視窗」在等這件事。
- 安裝版的 mod 能不能在啟動時就載入、不必每個 session 按 Enable，另開了待辦「實測安裝版 mod 啟動就載入」。
