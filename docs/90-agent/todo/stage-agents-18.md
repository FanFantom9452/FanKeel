---
label: stage-agents
title: 受控站擋主控 shell 寫檔
description: `hooks/guard.js` 在受控站只擋 `WRITE_TOOLS`，主控用 `sed -i`、`node -e`、`git mv` 寫檔不會被擋
state: done
link: hooks/guard.js
done:
  at: 2026-10-10
  sha: 1f8059ba
  disposition: done
  session: ed211efa-746a-43d5-9cea-1a08a52f5b5e
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 10 筆。現況：hooks/guard.js:125-142 在受控站拒絕寫入時只看 WRITE_TOOLS；:77-101 的 shell 分支只檢查 read-only agent 與 commit。所以受控站的主控用 sed -i、node -e 或 git mv 寫檔不會被擋，claimWrites 隨後還把那個檔記成任務的 claim，主控不動手這個保證有洞。2026-09-10 的 shell-whitelist judgement 判的是子代理，stage-agents-3 是反方向，都不涵蓋。judge 提的修法：shell 分支加上 !payload.agent_id && controlled && writesFiles(command) 就回同一句 deny。要先決定的事：目前 profile 只有 survey 受控，發生頻率低，而判斷一條 shell 指令會不會寫檔容易誤擋；要現在補，還是等更多站受控再補。完成條件：決定做的話，受控站主控的 sed -i 被拒、唯讀指令照常通過，兩者都有測試；決定不做就把理由寫進本條。

## 完成紀錄

在受控的站，主控自己下的 shell 指令只要會寫檔就被擋下，訊息說這一站由站 agent 動手、主控該派工。唯讀指令、主控自己的腳本、不受控的站、子 agent 都不受影響；讀不到 profile 時放行。兩個已知的代價：受控站上主控直接下 git commit 會被擋，要走提交腳本；引號裡當一般字出現的 rm、mv、cp、tee 也會被當成寫檔。

- commit 1f8059ba
- commit c440b71c
- commit a9f83cce
