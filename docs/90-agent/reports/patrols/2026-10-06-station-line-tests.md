---
status: decision
last_verified: 2026-10-06
---

# 站線補測試（10-06）：決策紀錄

一句話：`hooks/inject.js` 的 station 寫入錯誤 65 字元截斷與 `lib/render.js` 的 `stationLine` 五處分支都補上會紅的測試，inject-6 與 render-1 關閉；inject-3 的過長句子沒做。

計畫見 [../99-archive/2026-10-05-station-line-tests.md](../../../99-archive/2026-10-05-station-line-tests.md)。

## 為什麼

- `hooks/inject.js` 把 station 頁面寫入錯誤切在 65 字元，原本沒有測試。7a7bbf80 在 `tests/inject.test.js` 讓 `station.write` 丟出超過 65 字元的錯誤，斷言 station 行括號裡剛好 65 字元，並以「65 改成 6500」的變異證明會紅。
- `lib/render.js` 的 `stationLine` 原本只有 regex 斷言。c2317bb6 對其五處逐一變異，每一處都使 `tests/render.test.js` 變紅，並新增「帶 url 的 starting 不算仍在顯示」的斷言，註解同步說明只有 running 與 started 算在服務。
- 關閉的條目 inject-6 與 render-1 在 e35cb003 完成；fe5b2f78 修了其 description 的路徑反引號，因為 `tests/source.test.js:177` 曾因此紅。
- 完整套件 3561 項、3560 通過、1 略過；略過的是哪一項沒有查。

## 沒做什麼

- docs-check 指出的 `inject-3.md:20` 過長句子早於本次改動，沒有動，留待另開條目。
- compact-2 與 station-13 不在這次範圍。
