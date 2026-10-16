---
status: decision
last_verified: 2026-10-17
---

# TODO 全表盤點（10-17）：Pane 收合與 TODO 跳轉

一句話：30 條逐條查過，能在 session 裡動手的兩條 Pane 功能做完並結案，另替一條要真機的條目備好探測檔；整套 4475 個測試通過，使用者在 Desktop 上點過。

計畫在 [2026-10-17-pane-fold-todo.md](../../../99-archive/2026-10-17-pane-fold-todo.md)，設計在 [2026-10-17-pane-fold-todo-design.md](../../../99-archive/2026-10-17-pane-fold-todo-design.md)。

## 做了什麼

- Pane 的 route、tasks 標題變成按鈕，按一下收成一列，再按展開（Pane 的 route、tasks 可收合，結案）。
- Pane 底部多一塊可收合的 TODO 區，列出標題，按一條就開 station 並捲到那一條；station 多認得 `#/p/<專案>/todo` 與 `#/p/<專案>/todo/<條目>`（Pane 底部的 TODO 跳轉按鈕，結案）。設計時使用者在 mockup 上把原本的單顆按鈕改成「展開再跳轉」。
- 子代理 brief 改走 spawn：探測檔備好在 `.fankeel/build/2026-10-17-spawn-probe/`（不進 git），條目寫明怎麼載入；實際跑仍要使用者在互動式 session 做，所以沒有結案。

## 沒做什麼

- 其餘五條 Ready 都要真機操作：Desktop 真機看壓縮視窗、面板真機沒看完的四件事、終端啟動讀遠端狀態、Pane 偵測網頁服務給開啟鈕、接縫「profile 中途翻轉」。使用者決定壓縮視窗那條自己重開 Desktop 後測，profile 翻轉那條排進下個任務。
- 十條 Blocked 的外部條件都還沒到，十二條 Watch 的事件都沒發生，維持原狀。

## 順手發現

- station.md 有三處引用在這次之前就指錯行，verify 抓到，已記成新條目「station.md 三處引用指錯行」。
- 對抗審查以為專案路徑最後一段叫 `todo` 會被誤判成跳轉；查過不會，因為網址裡的路徑一律編碼過。
