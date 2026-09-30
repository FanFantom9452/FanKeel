---
label: title
title: 派工那一行看不到模型名
description: `hooks/title.js` 用 updatedInput 加的前綴只出現在完成通知，畫面上的 Agent(<description>) 照原輸入畫、沒有模型名；要不要讓主控在 description 自己寫別名、hook 再覆寫成完整前綴 — [lib/title.js](lib/title.js).
state: done
link: lib/title.js
done:
  at: 2026-09-30
  sha: 8806240dfeeb702eaf7092b099e5152afe1ceaff
  disposition: measured-no-change
  session: 9098b1f4-d4ef-4079-a5cc-567cb935663a
---

## 決定 2026-09-29

hook 維持現狀：模型只寫標題，版本一律來自真實的 `message.model`。前綴出現在 meta 和完成通知（docs/90-agent/reports/2026-09-29-title-probe.md）。畫面上的 `Agent(<description>)` 那一行從未在互動模式量測過。land 以 disposition measured-no-change 關閉。
