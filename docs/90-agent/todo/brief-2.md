---
label: brief
title: brain 沒收到 brief
description: 10-01 build 重訪：brief 約 10.6KB，Claude Code 存成檔、只給 2KB 預覽，prompt 是 build 加說明的兩個 brain 沒開那個檔；brain 的 agent 檔已加「先讀存檔」，等一次實跑確認
state: done
link: agents/fankeel-brain.md
group: 存檔 brief 被讀到
timing: after: 一次受控 build 的 brain 收到存成檔的 brief，而 prompt 不只 `build`
stamp: 2026-10-07
done:
  at: 2026-10-09
  sha: 91bf98e9
  disposition: done
  session: 91cb51ef-804b-401e-be65-965d64be97b1
---

Session a6409b07-9136-41b8-ba6d-173a1a676500（TODO 全表盤點，安裝版 0.88.0），verify gate 選「先回 build 修 tune-2 紅燈」之後：

- 第一個與第二個 `fankeel:fankeel-brain` 的 prompt 是 `build`，下面再接一段說明（使用者剛給的指示，以及第二次補的「前一個 agent 已留下未提交的修改」）。兩個都直接動手改了檔，沒寫 handoff，也沒回提交請求。第二個明講「The brief wasn't in my context」。await 對第一個印出 `lost`。
- 第三個的 prompt 只有 `build`。它照規矩回了 `commit build-2-g2-commit.md`，之後也寫了 `build-2.md`。

## 根因 2026-10-01

三個 brain 的 transcript（agent af7ff1c63e35f2d54、agent a7b7b989ba5a7c815、agent a7b08103839859a44）第 2 行都是 `SubagentStart:fankeel:fankeel-brain` 的 `hook_success`，第 3 行是 `hook_additional_context`：`Output too large (10.6KB). Full output saved to: …-additionalContext.txt`，後接前 2KB 預覽。hook 三次都產生了完整的 brief；`caseOfPrompt` 三次都回 `{ kind: 'close' }`，與此無關。前兩個從沒 Read 那個存檔，第三個在第 14 行 Read 了它。

修法：`agents/fankeel-brain.md` 的 `## Job` 開頭要 brain 先 Read 存檔，再做別的。這只在下一次實跑時才看得到是否生效，所以條目留著，等那次。

## 完成紀錄

brain brief 的長度由 render.js 的 `BRIEF_MAX` 上限守住。超過時從最舊的 context fact 起裁，並留一行指向 context.md 的完整路徑。brief 裡的 root 路徑改成相對，長度不再隨 root 位置變；worktree 那行留絕對，因為 commit.js 以 repo 頂端解析它。brief 被存成檔、brain 沒讀的根因由此消失。

- commit c65a7a41
- commit 0c3f3973
- commit e9ec4428
- commit 36992369
- commit e4d3167d
- commit fc15d796
- commit 91bf98e9
