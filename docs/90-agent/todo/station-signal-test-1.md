---
label: station-signal-test
title: serve 訊號收尾沒測試
description: station 的 main() 的 serve 在 SIGINT/SIGTERM 呼叫 close() 撤銷 tailscale serve，但沒有測試覆蓋。
state: ready
---

來源：station-remote-1 的實作審查（任務 5）。scripts/station.js 的 main() 讓 serve 在 SIGINT 與 SIGTERM 時呼叫 close()，close() 會撤銷這個 station 開的 tailscale serve。close() 與閒置離開兩條路徑已有測試，訊號迴圈沒有：刪掉迴圈，測試仍全綠，Ctrl+C 會把 proxy 留著。要改成：spawn node scripts/station.js serve，PATH 放一個假 tailscale，送 SIGINT（Windows 沒有真的 SIGTERM，只測 SIGINT），確認假 tailscale 收到 serve --https=443 off。完成條件：該測試存在，且刪掉訊號迴圈會變紅。
