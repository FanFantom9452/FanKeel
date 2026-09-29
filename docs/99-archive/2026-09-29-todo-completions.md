---
status: archived
last_verified: 2026-09-29
source_of_truth: TODO.md, scripts/todo-check.js
---

# TODO completions

Retired 2026-09-29. A closed entry is now an entry file with `state: done`
under `docs/90-agent/todo/`, carrying its sha and, where known, its session;
`todo.js migrate` turned the eleven records below into those files.

What happened to a `TODO.md` entry once it was closed. Whoever removes a bullet
from `TODO.md` adds one record here in the same change: the entry's original
text verbatim, its disposition, and the commit that closed it. `todo-check`
reads this page against the previous commit's `TODO.md` and refuses a deletion
it cannot find a matching record for here.

Newest first. One record per closed entry:

```
- original: 〔model〕每個角色用哪個模型、每個模型預設多少 effort 要定：profile key 蓋掉 agent 釘的模型、`haiku` 給機械活（哪些算機械）、effort 只能改 agent 檔 frontmatter — [model-choice.md](docs/90-agent/reference/model-choice.md).
  disposition: done
  sha: 6c8506c5d5ba634a01272b208518890d8f8b4c20

- original: 〔stage-agents〕09-29 回答檔四次沒寫出、原因未明：重裝後若再漏，讀 `<stage>-answer.miss.json` 的 reason — [hooks/resume.js](hooks/resume.js).
  disposition: done
  sha: 6c8506c5d5ba634a01272b208518890d8f8b4c20

- original: 〔verify〕要不要把 lint／build 列成 verify 必過一關：先比對 AI-Native SDLC playbook 的 Triple-Check 與現有 verify，再決定 — [skills/fankeel-verify/SKILL.md](skills/fankeel-verify/SKILL.md).
  disposition: done
  sha: 8ad448cc8613c35ce004fd24283e2c88aaadd382

- original: 〔plan〕要不要給 plan 加 Risks 欄：先比對 playbook 的 plan.md 範本與現有 plan，再決定 — [skills/fankeel-plan/SKILL.md](skills/fankeel-plan/SKILL.md).
  disposition: done
  sha: f8b701d7b6b13b7733b184ae1491e3ad05965b46

- original: 〔review〕要不要支援專案自訂 `review.md`：先比對 playbook 的審查 SOP 與現有 reviewer lens，再決定 — [agents/fankeel-reviewer.md](agents/fankeel-reviewer.md).
  disposition: done
  sha: 5b62d69845e076c6ba65374b4b868444fef1cf58

- original: 〔skills〕09-24 對照 addyosmani/agent-skills、mattpocock/skills 是 WebFetch 摘要、沒 clone，六個候選沒挑：clone 下來逐字重看，再和使用者逐條挑 — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md).
  disposition: done
  sha: 4b94d8a6e78e940655de74ee9d90152b8dbd4063

- original: 〔workflow〕要不要拿掉 Workflow、統一成 brain＋背景 agent：brain 沒有 Workflow，但 ledger groups 三個以上仍印 workflow；budget.js 也不量 subagents/workflows/ 底下的 agent — [lib/plantasks.js](lib/plantasks.js).
  disposition: done
  sha: 1b091fed77beb348d4ec603ad73e2acb09a61f99

- original: 〔await〕group 號依派工序編、非 ledger group，await 仍可能指到舊 `build-g<n>.md`；試過在 handoff 時自動清 inflight 但已撤回——markInflight 分不清 group brain 與 build close，需 registry 記下這訊號 — [scripts/await.js](scripts/await.js).
  disposition: done
  sha: ff16478e07e437bbd0e67d9c5e8e70acd7bf6786

- original: 〔stage-agents〕brain 停掉時它的背景 implementer 還在跑，完成報告落到主控、沒人接：重派的 brain 又做一次 Task 8。要不要讓 brain 等完子 agent 才能交回 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
  disposition: done
  sha: 90d2c5af8241f2f7ab102feae1734adf0500bb57

- original: <the entry's text, verbatim, as it read in TODO.md>
  disposition: done | measured-no-change | abandoned
  sha: <the commit that closed it>
```

`done` — the work described happened. `measured-no-change` — it was measured
and the answer was to leave things as they are. `abandoned` — nobody is doing
it and nobody decided to.

- original: 〔todo〕刪掉的條目沒留下結果：加一頁完成紀錄（原文、做了／量過不改／放棄、sha），`todo-check` 擋沒記的刪除；land 時讓使用者確認新條目的 heading — [scripts/todo-check.js](scripts/todo-check.js).
  disposition: done
  sha: 6240a6cd265a4a795101192e5e9266e80e2488e0

- original: 〔commit〕重送已提交的改動到 `ready --worktree` 報 conflict——唯一還沒查的洞；group 共用 `build-commit.md` 已在 88c9cb8d 修掉，09-29 主樹誤 reset 一事查過非文字漏洞 — [lib/render.js](lib/render.js).
  disposition: done
  sha: 9c2e21f7ad1dd819cbed4907233194a5bf46a348
