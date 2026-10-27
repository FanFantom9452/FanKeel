---
status: decision
last_verified: 2026-10-28
---

# TODO 全表盤點第五輪（10-28）：做了什麼、沒做什麼

一句話：tune 浮層的備註最多 4000 字，整份超過 256 KB 會在送出前說明；`/fankeel-ask` 的回覆附上判官自己寫的白話摘要，brief 寫 `html: yes` 時另產一頁可直接開的 HTML，圖用 Chartroom 畫。

一份計畫：[2026-10-28-todo-patrol-5.md](../../99-archive/2026-10-28-todo-patrol-5.md)（3 個任務）。

## 盤點

33 條開著的 TODO 逐條查過，能直接動手的是「overlay 備註無上限」和「ask 結果看不到也看不懂」。使用者決定兩條都做，ask 的摘要和 HTML 同一輪做；「station 留 vanilla、拆完模組」這輪不開計畫。

## 做了什麼

- tune 浮層的備註欄最多 4000 字，對齊伺服器；整份超過 256 KB 時不送出，佇列列說出這次多大、該刪幾則或縮短：`4c4078d7`。
- `judge.js record` 在歸檔後印出判官的 `## 白話` 段，最多 600 字；brief 寫 `html: yes` 時，在判決旁寫一頁自含 HTML，`judge.js html` 可以重畫：`2e8fbaa9`、`fa698849`。
- 判官 agent 檔要求寫 `## 白話`，ask skill 改成把這段原樣轉給使用者，subagents 參考頁跟著改：`f6103ed6`。
- fankeel-ask skill 的大小上限從 7800 提到 8800 bytes：`67939627`。
- 發版 0.128.0。

## 驗過、沒驗過

- 快速套件 5772 過 0 敗；verify 兩輪，第一輪因 station.md 有 9 個行號跑掉而回 build，那 9 個已由另一個 session 在 `e9d5a0b5` 修好。
- 改到的四個測試檔 80 個測試全過，包含 22 則 4000 字備註會被擋下、壞掉的 board 會顯示說明而不是讓頁面失敗。
- 沒驗過：HTML 頁沒在真瀏覽器打開看過樣子；判官還沒有真的照新格式答過一題。

## 沒做什麼

- 「station 圖需要真瀏覽器驗證」維持開放：要使用者在真 gate 上標記一次。
- 「未登記卡片與設定頁待真機驗」維持開放：第 5 項要在真機上再驗。
- 「station 留 vanilla、拆完模組」維持開放：使用者決定這輪不開拆分計畫。
- Blocked 條目的蓋章沒改：survey 查過九條都還沒到，但這一輪沒把日期蓋上去。
