---
label: station
title: 手機頁自己寫答案欄加麥克風鈕
description: 在 /m 的「自己寫答案」欄旁加語音輸入鈕（Web Speech API，zh-TW）
state: ready
group: station 遠端
---

來源：2026-10-22 用 S24 實測 station 遠端，以及判斷文件 docs/90-agent/judgements/2026-10-22-phone-voice-input.md。使用者的話：「手機頁自己寫答案欄加麥克風鈕（Web Speech API，zh-TW，註明語音會送 Google 辨識）」。要變成：在 /m 每題「自己寫答案」欄旁（assets/station/mobile.js:219-220）加一個麥克風鈕，只在 window.SpeechRecognition || window.webkitSpeechRecognition 存在時才畫出來（偵測寫法比照 mobile.js:346 的相機檢查）；lang = 'zh-TW'，interimResults = true，邊講邊填進 .own 欄，最終結果定稿，並沿用既有的打字即勾選 __other 邏輯（mobile.js:483-491）。按鈕有三種狀態（閒置、聆聽中、錯誤），not-allowed、no-speech、network 各給一句提示。必須明講：Chromium 系 Android 瀏覽器會把語音送到 Google 伺服器辨識，所以需要網路，而且聲音會離開 tailnet；若使用者不接受，替代方案是 MediaRecorder 上傳後在桌機用本機 Whisper。Samsung Internet 依 caniuse 是前綴或部分支援，zh-TW 辨識品質未知。完成標準：測試涵蓋「沒有 API 就沒有按鈕」與「結果進來後欄位值正確且 __other 被勾選」，並在 S24 的 Samsung Internet 上，講一句繁體中文能進到欄位並作為 gate 答案送出。
