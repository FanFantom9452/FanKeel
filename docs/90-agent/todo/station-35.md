---
label: station
title: station 遠端的手機實測
description: station 遠端功能落地後，在使用者的 Galaxy S24 經 Tailscale 實測掃 QR、回 gate、收三則 ntfy、裝 PWA 看離線畫面，並寫實測報告。
state: decision
group: station 遠端
stamp: 2026-10-22
---

來源：docs/90-agent/plans/2026-10-21-station-remote.md 的 Task 15，2026-10-21 build 時使用者決定跳過手機實測，說「這次 build 先不做手機實機檢查，之後再做」。要做成：station 遠端功能落地後，在使用者自己的 Galaxy S24、經他的 Tailscale，掃 station 的配對 QR、從手機回答一個被擱置的 gate、收到三則 ntfy 通知（gate 等待中、stage 完成、task 結束）、安裝 PWA 並看到離線畫面，然後寫 docs/90-agent/reports/2026-10-21-station-remote-live.md，並在 docs/README.md 補上索引行。完成條件：該報告存在，上述每一項檢查都標明 pass 或 fail。卡住的原因是功能本身尚未落地，且實測需要使用者本人的手機。

2026-10-22 盤點：條件「station 遠端 land」已滿足（cae65a63，0.111.55），解封移到 Needs a decision，剩下要使用者用自己的手機實測。同一次實測順便確認：關遠端後 `tailscale serve status` 只少了 fankeel 那一條 `/` 對應，其餘 serve 設定還在 —— 這輪把 disable 改成 `tailscale serve --https=443 --set-path=/ off`（62b091a1），官方文件沒寫裸 `--https=443 off` 的範圍，所以只在測試裡驗過假造的 run。
