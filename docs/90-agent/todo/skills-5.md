---
label: skills
title: stage skill 瘦身到上限以下
description: fankeel 與 build 兩份 SKILL.md 依 input-check --skills 的量測瘦身，並把上限一起調低
state: done
link: scripts/input-check.js
done:
  at: 2026-10-19
  sha: 8647edd8
  disposition: done
  session: 94618e2b-bdfb-4d9d-ab4d-a18b8697a719
---

來源：2026-10-19 TODO 全表盤點的 skills-4 決定「先量測再設上限」。tests/skill-size.test.js 已把每份 SKILL.md 的位元組上限釘在 2026-10-19 量到的大小之上，只防變大、不逼變小。要變成：用 node scripts/input-check.js --skills 找出最大的 fankeel（約 77k bytes）與 fankeel-build（約 47k bytes），把只有理由沒有規則的段落移到 rationale 或 docs/90-agent/reference，規則本身不刪。完成的樣子：兩份檔各少至少 15%，tests/skill-size.test.js 的 CAPS 同一個 commit 調低到新大小之上，skills-check 與整套測試綠。

## 完成紀錄

主技能和 build 技能裡只講理由的文字搬到參考頁，兩份技能都回到大小上限以下。

- commit ab70f562
- commit aee7296f
- commit 8647edd8
