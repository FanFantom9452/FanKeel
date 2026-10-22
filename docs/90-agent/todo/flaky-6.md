---
label: flaky
title: station 加入測試偶發失敗
description: joining serve() 的 roots.json 測試在 10-22 整套跑紅一次，單檔連跑 8 次都綠，原因未明
state: watch
link: tests/station-serve.test.js
group: 整套再紅一次
timing: if: 整套測試再出現一次重跑不見的失敗
stamp: 2026-10-22
---

來源：2026-10-22 第一輪 TODO 全表盤點的 verify（.fankeel/build/task-20261022T000239/verify.md）整套測試唯一一敗是 tests/station-serve.test.js 的 a joining serve() writes its own leads into roots.json，單檔重跑三次都綠；第二輪盤點又單檔連跑五次，全綠。讀碼的兩個推測：整套負載下 scripts/station.js 第 323 行 500ms 的 health 探測拿到非逾時的錯誤，lib/serve.js 把它判成 dead，於是第二個 serve 自己綁埠，joined 為 false；或 rememberLeads 在第 315 行的 catch 吞掉了寫 roots.json 的錯。第二輪已把兩個斷言訊息改成會印出 joined、url 與 roots.json 的內容。要變成：下次整套再紅時讀斷言訊息分辨是哪一種，修掉那一種。怎樣算完成：失敗訊息指出原因並修好，或整套連跑數次都不再出現。
