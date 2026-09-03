---
status: current
last_verified: 2026-09-04
source_of_truth: 本頁是幾次執行的記錄，不隨程式碼更新；規則以 skills/fankeel/SKILL.md 的 Subagents 段與 lib/stages.js 為準
---

# 鏈跑成一支 workflow — 2026-09-04 的記錄

`skills/fankeel/SKILL.md` 說四個 dispatch 是上限，而上限蓋不住的那個形狀——一次
fan-out 的輸出餵下一次 fan-out——只有 **Workflow** 工具蓋得住；在此之前那段話後面跟著
「unmeasured」，因為這個 repo 沒有任何一條鏈真的以 workflow 跑過。這一頁是第一批跑過
的記錄。**沒有對照組**：沒有一條鏈同時以四個 Agent dispatch 跑一次放在旁邊，所以這裡
的數字說的是「花了多少」，不是「比較省」。要比較，要另開一對。

每一列都是從 host 自己的工具結果抄的（`usage` 區塊），不是 agent 自報。

## build — implementer 接 reviewer，兩個 task

| | |
|---|---|
| run id | `wf_11bc22a5-a5f` |
| 派出時的 HEAD | `19203c6`，工作區另有兩個測試檔與 `lib/stages.js`、`TODO.md` 未提交的 in-session 改動 |
| 形狀 | `pipeline` 兩段：implementer 改一對檔案、回路徑不 commit；reviewer 讀同一對檔案的 `git diff`，回 schema 化的 findings |
| task | `gate`（`skills/fankeel/SKILL.md` + `docs/subagents.md`）、`chains`（`skills/fankeel-verify/SKILL.md` + `skills/fankeel-audit/SKILL.md`） |
| agent | 4 — 2 implementer、2 reviewer，全部 `model: 'sonnet'`，逐個指定 |
| subagent tokens | 319,526 |
| 工時 | 814,181 ms（13.6 分鐘） |
| 工具呼叫 | 135 |
| 錯誤 / 跳過 / 空結果 | 0 / 0 / 0 |
| 回到 parent 的 | 兩個 task 各一個 `{impl, review}` 物件；diff 一行都沒回來，reviewer 的 findings 共 6 條 |

reviewer 抓到的：`gate` 兩個 must（本頁當時還不存在，兩面的連結都是死的——本頁就是回應）、
一個該退的改動（implementer 為了過一條全檔禁 `never launch` 的測試，改了
`docs/subagents.md:22` 一句無關的 probe 敘述；測試收窄成只查那一段，那句還原）；
`chains` 一個 should（audit 段落被改成「a Workflow pipelines」以過 `\bWorkflow\b`，
改成「the Workflow tool pipelines」）。三件都在本 session 裁決，寫在 commit 訊息。

parent 端在鏈的兩跳之間**沒有** commit：reviewer 靠路徑釘範圍（`git diff -- <那個 task
的檔案>`），因為兩個 implementer 改的檔案不相交。這是 build 鏈跑成 workflow 時和
`skills/fankeel-build/SKILL.md` 第 4、5 步（parent 逐 task commit、reviewer 釘 `BASE..sha`）
不同的地方，也是 `TODO.md` 那條「build 的鏈是否也跑成 workflow」要決定的事。

## 這一頁不說的

- 哪一種比較便宜。沒有對照組。
- Workflow 內的 `PostToolUse` hook 有沒有把 implementer 改的檔案記進這個 session 的
  claims——`touched:` 那行在下一個 prompt 出現了那四個檔案，但 `hooks/inject.js` 的
  git-dirty 掃描也會加，分不出是哪一個加的。
