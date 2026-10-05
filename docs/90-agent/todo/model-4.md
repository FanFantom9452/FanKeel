---
label: model
title: fast 只給 sonnet 子 agent
description: fast mode 能不能只套在 sonnet 子 agent：官方說只支援 Opus、只能整個 session 開關，等上游
state: blocked
link: docs/90-agent/reference/model-choice.md
group: fast 可依 agent 設定
timing: upstream: Sonnet 支援 fast，或 fast 可依 agent 個別設定
stamp: 2026-10-05
---

來源：2026-10-05 使用者在「修 /fankeel hook 逾時」任務的 build 階段提出（session 2f5b7e13）：fast mode 能不能只套用給子 agent，而且只限 sonnet；opus 不要 fast。

要先查清楚再決定：
- Claude Code 的 fast mode（用 `/fast` 切換）是整個 session 的開關，還是能依 agent 指定；Agent 工具的參數、agent 檔的 frontmatter、Workflow `agent()` 的選項裡有沒有對應欄位。
- fast mode 支不支援 sonnet：Claude Code 自己的說明寫的是「Opus 加快輸出」，sonnet 有沒有 fast 版本還不知道。
- 如果只能整個 session 一起開關：主 session 開 fast 時，沒有指定 model 的子 agent 會不會跟著繼承。

怎樣算做完：查得到設定方式，就把 implementer、reader、reviewer 這些 sonnet 子 agent 設成 fast，主 session 與 opus 子 agent 不開，並把查到的事實寫進 model-choice.md。查不到任何支援方式，就把這條移到 Blocked，timing 寫 `upstream:`。

查證結果（2026-10-05，TODO 全表盤點的 survey 查官方說明，使用者在 gate 選結案）：fast mode 只支援 Opus 5.5、Opus 5 與 Opus 4.8，不支援 Sonnet。它是整個 session 的開關，用 `/fast` 切換；Agent 工具的參數、agent 檔的 frontmatter、Workflow 的 `agent()` 都沒有對應欄位。沒指定 model 的子 agent 會不會跟著繼承，文件沒寫，也沒實測。所以本條移到 Blocked，等上游讓 Sonnet 支援 fast，或讓 fast 能依 agent 個別設定；事實已寫進 model-choice.md 的 Fast mode 一節。
