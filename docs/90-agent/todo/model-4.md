---
label: model
title: fast 只給 sonnet 子 agent
description: fast mode 能不能只套在 sonnet 子 agent，主 session 與 opus 子 agent 都不開
state: decision
link: docs/90-agent/reference/model-choice.md
---

來源：2026-10-05 使用者在「修 /fankeel hook 逾時」任務的 build 階段提出（session 2f5b7e13）：fast mode 能不能只套用給子 agent，而且只限 sonnet；opus 不要 fast。

要先查清楚再決定：
- Claude Code 的 fast mode（用 `/fast` 切換）是整個 session 的開關，還是能依 agent 指定；Agent 工具的參數、agent 檔的 frontmatter、Workflow `agent()` 的選項裡有沒有對應欄位。
- fast mode 支不支援 sonnet：Claude Code 自己的說明寫的是「Opus 加快輸出」，sonnet 有沒有 fast 版本還不知道。
- 如果只能整個 session 一起開關：主 session 開 fast 時，沒有指定 model 的子 agent 會不會跟著繼承。

怎樣算做完：查得到設定方式，就把 implementer、reader、reviewer 這些 sonnet 子 agent 設成 fast，主 session 與 opus 子 agent 不開，並把查到的事實寫進 model-choice.md。查不到任何支援方式，就把這條移到 Blocked，timing 寫 `upstream:`。
