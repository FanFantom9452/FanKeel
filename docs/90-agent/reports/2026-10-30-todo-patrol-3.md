---
status: decision
last_verified: 2026-10-30
---

# TODO 全表盤點第三輪（10-30）：做了什麼、沒做什麼

一句話：#/live 確認存活的列下又畫出 stage agent 與 subagent 列；nav.js 的十個舊 live 函式刪掉了；station.js 外殼鎖在 2000 行內；拆模組那條就此結案。

一份計畫：[2026-10-30-todo-patrol-3.md](../../99-archive/2026-10-30-todo-patrol-3.md)（7 個任務）。

## 盤點

開著的 TODO 逐條查過。這幾條要做：「station 留 vanilla、拆完模組」的最後一份計畫，以及併進去的「刪 nav.js 的舊 live 死碼」。另外有兩件要使用者在場：「knip unused exports 未開」用 6.44.0 重測，「station 圖需要真瀏覽器驗證」在真 gate 上標記。「手機 gate 通知標題放題目」照使用者的選擇結案：它要改的 lib/notify.js 已經刪了。結案時新增一條 watch：「通知做回來，不走第三方」。

刪死碼之前發現，#/live 改版時漏掉了 subagent 列。使用者選擇先在 live-page.js 做回來，再刪舊碼，所以計畫多了第 1 個任務。

## 做了什麼

- #/live 在確認存活的列下畫回現在在跑的 stage agent 和 subagent；窄螢幕也放得下：`d0102cbb`、`99e095b8`、`00ecdf81`。
- 刪了三個只測死碼的測試，刪了 nav.js 的十個舊 live 函式和 station.js 的轉發，清掉它們留下的字串和文件：`94b065df`、`ffc7b800`、`e4481270`、`54c73662`。
- station.js 外殼量得 1957 行，測試把上限鎖在 2000：`4de37a38`。
- 新增 watch「通知做回來，不走第三方」：`1503dcaf`。
- knip 6.44.0 重測，還是追不到 `clearBadge`，條目改記 6.44.0：`fdd3f684`。
- station.md 的行號引用照縮短後的檔案改對：`8ae05fd8`、`a9c31155`、`a070139e`。
- 承認的 profile 測試改成 `gate.away` off（使用者 8ec4d9f3 的選擇）：`9f50223b`。
- 新增 TODO「gate 頁空白無法標記」，交判官判斷：`825bb368`。
- 發版 0.137.0：`0a6e1567`。

## 驗過、沒驗過

- verify 跑了兩輪。第一輪退回 build：station.md 有三處行號錯了，build 改完又多查到一處，共四處。第二輪 adversary 逐條核對 station.md 的 44 條引用，沒有錯的。
- 快速套件 5929 過、1 敗。那 1 個是 profile 測試還要求 `gate.away` 為 ask；land 已經改成 off。
- 沒驗過：
  - 真 gate 標記。連續四個 gate 的答案檔都沒有「標記：」行。使用者在 Chrome 打開 gate 頁，頁上什麼都沒有。
  - 412 寬的 #/live 有橫向捲軸，沒量。

## 沒做什麼

- 「station 圖需要真瀏覽器驗證」維持開放：第二步沒驗到。
- 「gate 頁空白無法標記」是新開的：先請判官判斷，是修好空白頁再驗，還是換一種方式驗。committed profile 的 `gate.station` 是 off，hooks/gate.js 不會採用頁面送出的答案，這也要一起判斷。
- 「knip unused exports 未開」維持 blocked，等下一版 knip。
