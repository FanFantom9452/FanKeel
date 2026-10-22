---
label: station
title: 手機頁 /m 加訂閱通知按鈕
description: 在手機頁 /m 加一顆訂閱通知按鈕，用 ntfy:// 連結帶正確 topic 打開 ntfy app
state: ready
group: station 遠端
---

來源：2026-10-22 S24 實機測試（任務「station 遠端的手機實測」）。station 已用 priority 4 把兩則 gate 通知發到 ntfy.sh（輪詢 topic 確認過），但手機完全沒響，因為使用者得從桌面卡片（assets/station/remote-card.js 的「訂閱」那行）手動抄 topic；而手機頁 /m（assets/station/mobile.js）沒有任何通知或訂閱的控制項。應變成：/m 上有一顆「訂閱通知」按鈕，用機器 profile 的 notify.server 與 notify.topic 組出 ntfy://<server host>/<topic>（ntfy Android app 的訂閱連結）並打開；只在 trigger 開啟且 topic 存在時顯示，打不開時退回 https 的 topic 頁。完成標準：已配對的手機在 /m 看得到按鈕；在 Android 點下去會開 ntfy app 的訂閱對話框且 topic 已預填正確；有測試涵蓋按鈕所渲染的連結。注意：條目中不可寫入實際 topic 值。
