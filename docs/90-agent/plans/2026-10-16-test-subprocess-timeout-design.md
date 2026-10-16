---
status: design-intent
---

# TODO 全表盤點（10-16）：測試的子行程要有逾時 — Design

這次盤點只做一條 Ready：「測試呼叫子行程要有逾時」（test-9）。使用者在 survey 的關卡選了只做這條；其餘八條 Ready 都要真機或使用者動手，保持 ready。

來源是 [2026-10-16-inflight-4-6-8.md](../reports/2026-10-16-inflight-4-6-8.md) §3：8 份 suite 同時跑時，11 個 node 子行程啟動就停住，測試用的 `execFileSync` 沒設 timeout（例如 `tests/orient.test.js:30`），8 份裡 7 份永遠等下去。

class 為 bounded：只動 `tests/` 與 `package.json`，不碰 `lib/`、`scripts/`、`hooks/`。

## 1. 預載模組給同步子行程預設逾時

- 新檔 `tests/subprocess-timeout.js`：載入時把 `node:child_process` 的 `execFileSync`、`spawnSync`、`execSync` 換成同名包裝，呼叫端的 options 沒有 `timeout` 時補上預設值，有的話原樣不動。
- 預設值讀環境變數 `FANKEEL_TEST_SUBPROCESS_TIMEOUT`（毫秒），沒設時是 120000。
- 包裝在測試檔 `require('node:child_process')` 之前裝好，所以解構出來的 `execFileSync` 也是包裝過的；`tests/` 的 285 個測試檔都是 CommonJS，沒有 ESM。
- 逾時時 `execFileSync`／`execSync` 丟出 `ETIMEDOUT`，`spawnSync` 回傳的 `error.code` 是 `ETIMEDOUT`：那條測試變紅，其他測試照跑，suite 結束。
- 為什麼不逐處補 timeout：`tests/` 裡有 341 處 `execFileSync(`、125 處 `spawnSync(`、2 處 `execSync(`，其中只有 21 個檔提到 timeout；逐處改是 468 個呼叫的機械改寫，而且下一個新寫的測試就會漏掉。預載是一個地方管全部。
- TODO 原本的做完條件是「grep `tests/` 找不到沒帶 timeout 的呼叫」；換成預載後這條 grep 不再適用，改由下面的兩條測試證明，條目關閉時在 body 記一句。

## 2. `package.json` 的兩個 test script 帶上預載

- `test` 從 `node --test` 改成 `node --test --require ./tests/subprocess-timeout.js`；`test:fast` 同樣在 `--test` 之後加 `--require ./tests/subprocess-timeout.js`。
- `--require` 必須放在 `--test` 之後：`lib/suite.js:18` 的 `NODE_TEST` 是 `/\bnode\s+--test\b/`，放前面就認不出是 node --test，`runSuite` 不加 tap reporter、紀錄的 pass／fail 變成 null。
- `node --test` 會把 `--require` 傳給每個測試檔的子行程（Node v24.21.0 實測 `node --test --test-reporter=tap --require ./pre.js a.test.js`：preload 設的旗標在測試檔裡讀得到，`# pass 1`）。`scripts/suite.js` 讀的就是這兩個 script，所以 `suite.js` 與 `suite.js --fast` 也帶上。
- 不加 `--test-timeout`：同步呼叫卡住時事件迴圈停著，`--test-timeout` 的計時器根本不會觸發；非同步子行程卡住的情形量測裡沒有出現。struck，理由如上。
- README 的 `## Development` 在 git timeout 那段之後加一句，說預載的存在、預設 120000 毫秒和那個環境變數。

## What proves it done

| test | how |
|---|---|
| 子行程睡過逾時會紅而不是掛住 | `tests/subprocess-timeout.test.js` 開一個 `node --require tests/subprocess-timeout.js -e <script>`，script 裡 `execFileSync` 一個永遠不結束的 node，`FANKEEL_TEST_SUBPROCESS_TIMEOUT=500`；外層呼叫自己帶 30000 的 timeout。外層 exit 非 0、stderr 含 `ETIMEDOUT`，花不到 30 秒。現在是紅的（檔案不存在）。 |
| 呼叫端自己給的 timeout 不被蓋掉 | 同一個測試檔：裝好預載後 `spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, 5000)'], { timeout: 300 })` 的 `error.code` 是 `ETIMEDOUT`，花不到 5 秒；預設值設成 60000 也一樣。 |
| 兩個 test script 都帶預載，suite 仍認得 | 同一個測試檔讀 `package.json`：`scripts.test` 與 `scripts['test:fast']` 都含 `--require ./tests/subprocess-timeout.js`，而且都符合 `/\bnode\s+--test\b/`。 |

## Files

| file | change |
|---|---|
| `tests/subprocess-timeout.js` | 新檔，預載包裝 |
| `tests/subprocess-timeout.test.js` | 三條測試 |
| `package.json` | 兩個 script 加 `--require` |
| `README.md` | `## Development` 一句 |

## Unverified

- Windows 上逾時用 SIGTERM 殺的是直接子行程；那個子行程自己再開的孫行程不一定一起結束。量測裡卡住的是直接子行程，所以不影響這條的目的。
