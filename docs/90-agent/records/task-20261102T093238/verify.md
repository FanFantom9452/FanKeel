結論：shelf 的已完成部分（任務 1、2、3、5、6、7）驗證成立；任務 4 依你的決定維持 partial。對抗審查找到兩處問題，其中一處是文件說了程式沒做的事，我已在 Verify 內修掉；另一處是測試強度不足，建議之後補強但不阻擋。

```
$ node scripts/suite.js --session 30421c7e-7fcf-4361-be33-90b25dd1ebbb --fast
suite: 6136 pass, 6 fail @ b5c1947a
```

```
$ node --test tests/shelf*.test.js tests/weekly-shelf.test.js tests/registry-shelf.test.js
ℹ tests 23 / ℹ pass 22 / ℹ fail 0 / ℹ todo 1
```

suite 的 6 項失敗，我逐一對過 suite.tap：station 的 tour 檔案與測試各一項、loc 鍵一項、導覽列一項、sources.md 的 Cited by 一項、TODO.md index 一項，全是鄰居 session「移除 station tour」的殘留或既有問題，與 shelf 無關；另有 spend 那項 `todo`（`spend counts shelved entries`）故意紅著。我沒有動這些。

- shelf 的 run、find、restore、讀取端與週報 — held（shelf 相關 23 項測試 22 過 0 敗 1 todo；對抗審查也自行重跑得相同數字）
- registry.md 的 shelf 一節與 scripts/shelf.js、lib/shelf.js 一致 — held（訊息、結束碼、複製後比對再移除的順序都核對過）
- 安全面（restore 的路徑穿越、覆寫）— held（id 以 regex 限制、目的地已存在即拒絕、SQL 參數化）
- 任務 4：lib/spend.js:120 — did not hold，依決定保留為 partial，仍是 `registry.readAll(root)`
- docs: docs/90-agent/reference/registry.md:641 原本把 `spend` 列為會讀架子的讀者，與 lib/spend.js:120 不符
- fixed here: registry.md:641 已移除 `spend`，並註明待 spend.js 補上 `{ shelf: true }` 後才會；docs-check 對該行無任何回報（registry.md 其餘三條是既有的 carries-no-quote 提示）
- adversary: tests/shelf-readers-src.test.js:8-12 只用 regex 比對 station、profile、settingsuggest 的原始碼，不呼叫它們，讀取端若忽略該選項也會通過 → 屬測試強度問題，建議補一個行為測試，可與補 spend 那一行一起做

沒能檢查的：鄰居 session 落地後 spend 測試是否轉綠；weekly-shelf、registry-shelf、shelf-docs、shelf-cli 四個測試只確認通過，未逐項審其斷言；`lenses.js` 未跑。

reads:
- docs/90-agent/reference/registry.md — 第 641 行是這次修正處，確認措辭
- lib/spend.js — 第 120 行補 `{ shelf: true }` 並拿掉 spend 測試的 `todo`
- tests/shelf-readers-src.test.js — 只比對原始碼，可換成行為測試

```json gate
{"questions":[{"header":"Verify→Audit","question":"Verify -> Audit | fankeel : session 與 build 集中歸檔","options":[{"label":"Go to Audit (Recommended)","description":"shelf 已完成的六項任務驗證成立；registry.md:641 已在這裡修正。suite 的 6 項失敗皆屬鄰居 session 的 tour 移除與既有問題，spend 的一行依你的決定留待之後補。"},{"label":"Back to Build","description":"回 Build：補強 tests/shelf-readers-src.test.js 為行為測試，並等鄰居落地後補 lib/spend.js:120 的 `{ shelf: true }`。"},{"label":"暫停","description":"先停在這裡，之後再繼續。"}]}],"next":"進 Audit；registry.md:641 已修，spend.js 一行與讀取端行為測試留待之後"}
```
