---
label: ponytail
title: Ponytail 5.3.2 比較與借鏡
description: 四個候選暫無對應問題；比較表留此備查，有問題對上再收
state: watch
link: agents/fankeel-reviewer.md
group: 下一個 Ponytail 借鏡出現
timing: if: reviewer 回報難以逐條指認，或解除安裝後有殘留事故
stamp: 2026-10-23
---

來源：2026-10-23 使用者看完 Ponytail 4.9.0 到 5.3.2 的比較表後說留著記在 todo。完整比較表在 docs/90-agent/judgements/2026-10-22-ponytail-5-diff.md:125-139。依 docs/03-decisions/2026-09-24-optimise-own-first.md:15，四個候選目前都對不到 TODO 或事故，先記在這裡。

可參考的四項（成本）：一、fankeel-reviewer 的 findings 跨組編號，讓人能說修 2 和 5，改 agents/fankeel-reviewer.md:89（S）。二、uninstall 腳本加一支測試，清 station index.html 與機器 profile.json 殘留，README.md:30 補一行（S/M）。三、SessionStart 符號地圖，併入 survey-4 的討論（M，條件式）。四、有／無規則的配對基準設計，只參考不搬碼（L）。

其餘列（模式、注入時機、子代理、audit、債務標記、梯子、band、歷史）FanKeel 已有等價或更細的做法，不借。

完成條件：使用者挑出要收的項目後各自拆成 Ready 條目；沒挑的留在此條，不刪。

2026-10-25 盤點：候選 1（跨群組編號）已於 5728c7a6 落地；候選 2（解除安裝腳本）這輪做成 scripts/uninstall.js（bf34b68d）；候選 3（符號地圖）評估後留在 Watch：過去 6 次重寫既有 helper 的事故，名稱都對不上，1543 個名稱塞進 2000 字預算只涵蓋約 9%，survey.js 已能依名稱比對宣告；候選 4（成對 benchmark）未決。
