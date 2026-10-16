---
status: decision
last_verified: 2026-10-16
---

# 一台機器一次一組 suite；build 與 verify 跑快組（10-16）

一句話：`scripts/suite.js` 先拿機器層級的鎖，另一組在跑就等並印出在等誰；名稱帶 `@slow` 的測試從 `npm run test:fast` 排除，build 與 verify 跑 `suite.js --fast`，land 照跑全部並拒收快組紀錄。

## 決定

- 鎖是 `os.tmpdir()/fankeel-suite.lock`（`FANKEEL_SUITE_LOCK` 可改），以 `wx` 建立，內容 `{ pid, at, session, tree, command }`，放在 `lib/suitelock.js`。
- 鎖過期的三種情況：pid 已不在；`at` 超過 60 分鐘；或內容讀不出、不是 JSON 物件超過 5 秒，此時看檔案 mtime。過期的鎖先改名移開再刪，移錯了就連結回去；移不開就印 stuck，請人手動刪。
- `suite.js` 給它跑的指令設 `FANKEEL_SUITE_HELD`，裡面再叫 `suite.js` 就不拿鎖，免得自己等自己。`npm test` 不拿鎖。
- 負載下跑 10 秒以上的 129 項測試，名稱加上 ` @slow`，由 `scripts/slow-tag.js` 從一次 TAP 輸出挑出。`test:fast` 是 `node --test --test-skip-pattern=@slow`。
- `suite.js --fast` 的紀錄帶 `fast: true`，`lib/suite.js` 的 blocker 不收，所以 `task.js land` 一定是全部跑過才放行。

## 為什麼

10-16 幾個 session 在同一台 Windows 機器同時跑整套測試，每次都有一小撮不同的測試失敗，單跑卻都是綠的。讓它們排隊，就不會再互相拖垮。

整套測試約 274 秒。build 與 verify 每一輪都要跑，先跑快的那組；land 是最後一道，照跑全部。

## 放棄了什麼

- 加 Windows Defender 排除項來加速：那是使用者自己的安全設定，不動。
- 期待快組省一半時間：實測只快五分之一（216 秒對 274 秒）。`node --test` 每個檔內的測試是一個接一個跑，`tests/commit.test.js` 與 `tests/sensitive.test.js` 這類多次呼叫 git 的檔決定了下限，門檻怎麼調都一樣。
- 用測試驅動「Windows 拒絕改名」這條路徑：node 沒有可攜的方法讓 Windows 拒絕改名，只靠程式碼審查。
