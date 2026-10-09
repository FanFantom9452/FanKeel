---
label: title
title: 覆寫檔要新行程才派得出
description: profile set 產生的 agents 覆寫檔要新行程才讀得到，title hook 卻先把名字改成 bare，同一行程裡派工會失敗
state: decision
---

來源：2026-10-08 session d3ff9844-a061-4d09-9bbb-e959aa6148dd，Haiku 5.5 角色測試任務的 land 階段。使用者照裁定跑完四條 `profile set agent.fankeel-<role>.model haiku`，產生了 `.claude/agents/` 底下四個覆寫檔；之後 land 的 stage agent 派 `fankeel-reader` 與 `fankeel-mover` 都派不出去，只好改派 general-purpose。

現況：`hooks/title.js` 看到有產生出來的同名覆寫檔，就把 `fankeel:fankeel-reader` 改寫成不帶前綴的 `fankeel-reader`。但 Claude Code 只在行程啟動時讀一次 project 的 agent 清單，行程啟動之後才產生的覆寫檔不在清單裡，改寫後的名字就派不出去。hook 改寫前沒有確認這個名字派得出去。另外，本機安裝的外掛（`installed_plugins.json` 記的 gitCommitSha f3c23bac）落後 repo，沒有 1fcb5ab8 與 cb7c1506 的模型蓋寫修正。

要變成什麼：待決定。可能的做法：覆寫檔晚於行程啟動時，hook 不改寫名字並在 brief 提示要開新終端機；或 `profile set` 印出「開新終端機才生效」；或兩者都做。

完成的標準：在同一個行程裡跑完 `profile set` 之後派工不會失敗（照原名派，或明確告知要重開）；有測試釘住；`docs/90-agent/reference/subagents.md` 寫明覆寫檔何時生效。
