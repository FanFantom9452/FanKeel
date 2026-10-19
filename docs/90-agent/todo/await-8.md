---
label: await
title: 不問人與失敗交接
description: calibration 加「能跑出來觀察的事實不問人」並對齊 build 四種停；await.js 回 lost／timeout 時寫合成 handoff 註明模式與建議
state: done
link: scripts/await.js
done:
  at: 2026-10-19
  sha: 442e4e26
  disposition: done
  session: d3262697-a4ab-4038-a006-e5286871ceb9
---

來源：2026-10-19 判官比較 cursor/plugins 的 pstack 與 fankeel（docs/90-agent/judgements/2026-10-18-cursor-plugins-pstack.md，比較表 #2、#25，判官評為 B、前五名第五）。pstack poteto-mode SKILL.md:20 的 AskQuestion 分類器：能跑程式觀察到的事實不是人類的問題，走 prototype；只有實驗解決不了的產品或偏好判斷才問。orchestrate 在 worker 死掉時由腳本代寫 failure handoff，分類 cap-hit／oom／tool-error／network-drop／unknown，並給 planner 一張重試策略表（兩次後放棄）。fankeel 的 await.js 只回 lost 或 timeout，沒有分類也沒有下一步建議。

要變成：skills/fankeel/SKILL.md 的 calibration 加一句分類器並與 fankeel-build 的四種停對齊；scripts/await.js 在 lost／timeout 時寫一份合成 handoff，記錄模式、最後活動與建議下一步。

完成的樣子：await 測試加一個 lost 情境，斷言合成 handoff 檔存在且含模式欄位；skills-check 綠。工作量小，約 40 行。

## 完成紀錄

子代理遺失或逾時時，等待程式會寫一份失敗交接檔，記下狀況、最後活動與下一步，主控不必再猜。能自己跑出來的事實不再拿去問人。第二組的編號不再因為第一組結束而被重編成 1。

- commit d860a3d9
- commit 221241ec
- commit 442e4e26
