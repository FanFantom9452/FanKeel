---
label: dispatch
title: 派工超過 4 個先過 gate
description: 大任務想一次派超過 4 個背景 agent，但超過時要先經使用者同意並看到估價；4 的限制目前只在規則文字，沒有 hook 強制。
state: done
done:
  at: 2026-10-09
  sha: 73762db3
  disposition: done
  session: 5045b7f4-e18a-4b77-8157-532128f425a9
---

來源：2026-10-08 session d3ff9844，使用者問背景 agent 的上限是多少，接著提議：大任務可以一次派超過 4 個，但超過 4 個時要多一個 gate 提醒「這很耗 token」，同意後才派。

現況：「一次最多 4 個」只寫在規則文字裡，沒有任何 hook 在數 Agent 呼叫。出處有 skills/fankeel/SKILL.md:1116、skills/fankeel-build/SKILL.md:291、lib/render.js:570、lib/stages.js:713。lib/registry.js:920 的 MAX_DISPATCHES 只是記帳佇列的長度，不是派工上限。Workflow 那條路已有 host 對話框列出 agent 數，Agent 工具這條路沒有。

待決定：(1) gate 放規則層（brain 用 AskUserQuestion 先問）還是 hook 層（PreToolUse 在第 5 個 Agent 回 ask；目前 inflight 只記一個，要加計數）。(2) 估價怎麼給：用 Haiku bench 按角色花費（mutator 用 sonnet 約 $0.024、用 haiku 約 $0.002），或用 registry 的 spend。(3) 同意只管這一次派工，還是整個 stage。(4) 超過 4 個到底省多少 wall-clock 沒量過；只有一組參考：4 個平行 121 秒，對依序 352 秒。

完成標準：超過 4 個的派工一定先經過同意，且同意畫面看得到估價；4 個以內的行為完全不變；規則文字從「4 是上限」改成「4 是預設」；並有測試覆蓋超過 4 個與 4 個以內兩種情況。

## 完成紀錄

新的 PreToolUse hook 在同一則回覆的第五個 Agent 或 Task 派工時回 ask，附上 registry 已記的花費，沒有就用 Haiku bench 的角色單價估價；四個以內不變。規則文字把四改成預設而不是上限。決定：hook 層加 gate，估價用 bench 角色價。

- commit 73762db3
- commit b7ca1aae
- commit a13e107a
- commit 3d3e7883
