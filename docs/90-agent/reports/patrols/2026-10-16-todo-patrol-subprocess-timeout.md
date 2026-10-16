---
status: decision
last_verified: 2026-10-16
---

# TODO 全表盤點（10-16，子行程逾時）：定了什麼、沒做什麼

一句話：這一輪只做了「測試呼叫子行程要有逾時」——一個預載模組讓測試裡每個沒設逾時的同步子行程自動帶 120 秒逾時，卡住的子行程變成一條紅燈，不再讓整套測試掛住；其餘八條 Ready 都要真機或使用者動手，留著。

計畫在 [2026-10-16-test-subprocess-timeout.md](../../../99-archive/2026-10-16-test-subprocess-timeout.md)，design 在 [2026-10-16-test-subprocess-timeout-design.md](../../../99-archive/2026-10-16-test-subprocess-timeout-design.md)。

## 做了什麼

- 盤點了全部 30 條：9 條 Ready、0 條待決定、10 條 Blocked、11 條 Watch，與 `todo.js list` 相符。Blocked 的條件都沒到，Watch 的日期都還新，沒有改動。
- 新增 `tests/subprocess-timeout.js`：測試檔載入前先包住 `execFileSync`、`spawnSync`、`execSync`，呼叫端沒給 `timeout` 時補 120000 毫秒（`FANKEEL_TEST_SUBPROCESS_TIMEOUT` 可調）。`npm test` 和 `npm run test:fast` 都用 `--require` 載入它。
- 四條新測試：子行程永遠不結束會以 `ETIMEDOUT` 變紅；呼叫端自己給的逾時不被蓋掉；省略參數的呼叫也拿到預設值；兩個 test script 都帶預載而且仍以 `node --test` 開頭。每條都用突變確認過只有它自己會變紅。
- `README.md` 的 Development 與 `docs/01-guide/development.md` 補上預載的說明。

## 沒做什麼

- 另外八條 Ready（子代理 brief 改走 spawn、Desktop 真機看壓縮視窗、面板真機沒看完的四件事、終端啟動讀遠端狀態、Pane 底部的 TODO 跳轉按鈕、Pane 的 route／tasks 可收合、Pane 偵測網頁服務給開啟鈕、接縫「profile 中途翻轉」）：使用者在 survey 的關卡選了只做這一條。其中兩條 Pane 的按鈕可以先寫程式，但要使用者在 Desktop 點過才算完成，收合那條還要先畫 mockup。
- 沒有加 `--test-timeout`：同步呼叫卡住時事件迴圈停著，它的計時器不會觸發；非同步子行程卡住的情形量測裡沒有出現。
- 直接用 `node --test tests/某檔` 單跑一個檔時不會載入預載；README 寫了怎麼手動加。

## 為什麼

- 選預載而不是逐處補 `timeout`：`tests/` 裡有 468 處同步子行程呼叫，逐處改是大量機械改寫，而且下一個新測試就會漏掉；預載一個地方管全部。TODO 原本「grep 找不到沒帶 timeout 的呼叫」這條完成條件因此改由測試證明，結案紀錄寫了這一點。
- `--require` 放在 `--test` 之後，因為 `lib/suite.js` 只認以 `node --test` 開頭的指令，放前面會讓 suite 紀錄的通過數變成空的。這是 plan 階段讀程式時發現的。
- verify 第一次退回 build：只跑 `--fast` 時沒看到 `tests/suite.test.js` 裡一條把兩個 test script 字串寫死的測試，整套測試才抓到；修好後整套 4461 過、0 失敗。
- 整套測試在這一輪有三次 `tests/serve.test.js` 單獨變紅、單跑都綠。那些測試沒有同步子行程，不是預載造成的，登記成 Watch 條目「serve 測試整套負載下偶發失敗」。
