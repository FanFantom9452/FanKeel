---
label: gate
title: gate 標題顯示專案與站別
description: AskUserQuestion 的 header 改成「現在站→建議站」，question 開頭帶專案與任務短名；格式使用者還要再調整
state: ready
link: lib/handoff.js
---

來源：2026-10-29 手機 /m 多台合併任務收工後的討論。判官紀錄 docs/90-agent/judgements/2026-10-29-gate-question-custom.md 說明：gate 文字由 stage agent 或 controller 自己寫，程式只擋 header 超過 12 欄（中文字算 2 欄，lib/handoff.js 的 MAX_HEADER_WIDTH）、第一個選項要含站名或收工、一定要有暫停。

現況：看過 973 個真實 gate，同一個時刻的標題就有「下一步」「驗證結果」「verify 結果」「build 完成」「進 verify」等七八種寫法，標題也可能和所在的站對不上，而且沒有一個寫出專案或任務。大多數 session 都在 fankeel 裡同時跑，所以任務名比專案名更能分辨。

草案（使用者說格式還要調整，動手前先和使用者確認）：
- header 寫「現在站→建議站」，用中文兩字站名：盤點、設計、計畫、建置、驗證、審查、收尾，例如「驗證→審查」，固定 9 欄。
- question 開頭寫「專案｜任務短名：」，任務短名 10 字以內，後面接一句結果和問句，例如「fankeel｜/m 多台合併：三項要補，退回 build？」。

做法有兩種：
- 只給模型指示：設 profile 的 prompt.all，不改程式，但模型照不照做沒有檢查。
- 要強制：改 lib/stages.js 的 ALWAYS 規則句，以及 skills/fankeel/SKILL.md 寫的「header 寫剛結束的那一站」，再在 lib/handoff.js 的 gateProblem 加檢查。

完成的標準：
- 格式和使用者定案。
- 接下來的 gate 都照新格式出現。
- 如果選了強制，有測試證明不合格的 header 會被擋。

進度（2026-10-29）：使用者看過範例後定案格式。header 填剛結束的那一站，英文大寫（SURVEY、BUILD、VERIFY、LAND），12 欄放得下 MAX_HEADER_WIDTH；question 開頭是 `<專案> | <現在站> → <下一站> | <任務短名>：`，後面接結果與問題。使用者認可的範例：`fankeel | SURVEY → PLAN | TODO 盤點：4 條可做，進 plan？`、`fankeel | BUILD → VERIFY | TODO 盤點：6 項都綠，進 verify？`、`fankeel | VERIFY → BUILD | /m 多台合併：兩項沒過，退回？`、`Waypoint | LAND → 收工 | 7d 色階：已合併，收工？`。「現在站→建議站」放不進 header（超過 12 欄），所以改放在 question 開頭。要不要強制檢查（lib/stages.js ALWAYS 加規則、lib/handoff.js gateProblem 加檢查）還沒決定，此條保持 Ready，這次沒改程式。
