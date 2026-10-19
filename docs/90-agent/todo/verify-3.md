---
label: verify
title: 每功能驗證地圖
description: verify 沒有跨次持久的功能地圖；照 pstack create/maintain-verification-skill 加每功能一檔的驅動說明並在 audit 週期對帳
state: done
link: skills/fankeel-verify/SKILL.md
done:
  at: 2026-10-19
  sha: 1793502e
  disposition: done
  session: 94618e2b-bdfb-4d9d-ab4d-a18b8697a719
---

來源：2026-10-19 判官比較 cursor/plugins 的 pstack 與 fankeel（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md，比較表 #10，判官評為 A 採納、前五名第一）。pstack 的 create-verification-skill 產出專案本地的驗證技能：Launch／Doctor／Drive／Evidence／Cleanup，外加每功能一檔的 feature map（Sub-features、怎麼到達、怎麼驅動、Gotchas），而且必須自己跑過一次才算交付；maintain-verification-skill 定期用原始碼讀者加一次實機 live pass 對帳，結果是 clean／changed／blocked。

要變成：fankeel verify 的 verifier 依地圖驅動真實介面（含 Doctor 檢查與「cleanup 不吃證據」規則），audit 的 14 天週期加一次地圖對帳。地圖放 .fankeel/verify/ 或擴充 render.json，由設計階段決定。

完成的樣子：一個有前端的專案跑 verify 時，verifier 引用地圖中的功能檔驅動並留證據；地圖過期時 audit 回報 changed，並有測試釘住地圖格式 lint。工作量估計大，2–3 個 build 任務。

## 完成紀錄

每個功能可以有一份驗證地圖，寫明怎麼親手確認它還正常；第一份是監控站。verify 會依改動範圍挑出要重驗的功能，audit 也會讀它。地圖格式有檢查工具，寫錯會提出警告。

- commit dc8902ec
- commit 1ea76c6a
- commit 97d8fb36
- commit 1793502e
- commit f696c96e
- commit b9197810
- commit b16dcad6
- commit d3539992
