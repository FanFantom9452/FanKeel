---
judged: 2026-09-10T15:04:31.734Z
model: fable
agent: fankeel-judge
task: "處理 TODO：Ready 一條與七條待決議，決議走 fankeel-ask"
session: 98873819-d200-4e3b-be77-be352547e51e
stage: design
---

# 判斷 7：verify 的 verifier 要釘哪個 agent，Workflow 的寫檔要求要不要留

## Question

# 判斷 7：verify 的 verifier 要釘哪個 agent，Workflow 的寫檔要求要不要留

## 問題

兩件互相牽動的事：

1. `skills/fankeel-verify/SKILL.md` 的「One verifier per task」整段沒有寫
   `subagent_type`，所以會落到全工具的 `general-purpose`——而證據表要它做
   red-green，也就是說那個 subagent 手上有 Edit 與 Write。
2. 同一支 skill 的 Workflow 段要求 verifier 把證據列寫進檔案再回傳路徑。若
   pipeline 本來就把回傳值留在腳本裡，這個要求可省；省掉就不必新增一個 agent。

## 你可以自己讀的檔

- `skills/fankeel-verify/SKILL.md:140` — 標題「One verifier per task, where a
  ledger exists」
- `skills/fankeel-verify/SKILL.md:155-157` — 那段講四個上限與「說幾個、哪個
  模型」，通篇沒有 `subagent_type`
- `skills/fankeel-verify/SKILL.md:181-183` — Workflow 段的寫檔要求本文，理由寫的
  是不讓證據列回到本 session 的 context
- `skills/fankeel-verify/SKILL.md:132` — 同一支 skill 前面一節有寫
  `subagent_type: fankeel-reader`，所以不是這支 skill 不知道要寫
- `skills/fankeel-build/SKILL.md:290,313` — build 的 reviewer 兩處都釘
  `subagent_type: fankeel-reviewer`
- `skills/fankeel-plan/SKILL.md` — grep `subagent_type` 零命中。**`TODO.md` 只
  點名 verify，plan 有同樣的缺口而沒被寫進條目**
- `agents/fankeel-reviewer.md` — 全文，特別是 `:5` 的 `model: sonnet` 與它的
  工具清單
- `agents/fankeel-reader.md`、`agents/fankeel-judge.md` — 另外兩支現成 agent 的
  工具清單。三支都不能 Edit/Write/NotebookEdit
- `skills/fankeel/SKILL.md` 的 Subagents 一節 — 特別是講 Workflow 與 pipeline
  中介結果落在哪裡的那幾段
- `docs/reports/2026-09-04-chains-as-workflows.md` — 這個 repo 實際把 chain 當
  workflow 跑的紀錄

## 已知的事實

- 現成三支 agent（reader、reviewer、judge）都不能寫檔。一個要做 red-green 的
  verifier 必須能跑測試（Bash），但不必能改檔——除非 red-green 的「red」是靠
  改原始碼做出來的。這是這題的關鍵分歧。
- Workflow 的 `agent()` 回傳值留在腳本裡，不進父 session 的 context。若這一點
  成立，`:181-183` 那個寫檔要求的理由就自我抵銷了。請自己去確認這一點，不要
  只信這份 brief。
- `skills/fankeel-plan/SKILL.md` 的同款缺口不在 `TODO.md` 裡。你的答案如果適用於
  plan，請一併說。

## 算什麼是答案

verifier 釘哪個 `subagent_type`：現成的三支之一、還是需要新的一支（新的話說出
它的工具清單與 `model:`）。以及 Workflow 段的寫檔要求留或刪，理由。若兩件事的
答案互相決定（例如刪掉寫檔就不必新增 agent），把那條依賴說清楚。

## 回傳形狀

- 一行結論（兩件事各一句也可以，但總共不超過兩行）。
- 三到六行理由，每行一個。
- 一行「這個決定在什麼情況下是錯的」。
- 不要重述這份 brief。

## Answer

pick: 寫檔要求留、理由句改寫；verifier 釘新的一支 `fankeel-verifier`（`tools: [Read, Grep, Glob, Bash, Write]`、`model: sonnet`；Write 只寫指定路徑的證據檔，Bash 跑測試與唯讀 git，不改樹；Workflow 腳本裡寫 `agentType: 'fankeel:fankeel-verifier'`）。兩件事的依賴方向是：留寫檔才需要新 agent；plan 沒有同款缺口。
why: 「`agent()` 回傳留在腳本裡」成立——session `07a6a1d4` 的 `wf_448647af-83d` 十個 agent 只喚醒 parent 一次（transcript 第 592 行，`task-notification`，10,263 字元），內容就是腳本 `return { chains, docs, session }` 的 join；verifier 的 notes 與 adversary 的 why 都在裡面是因為腳本寫了 `verify: r`，證據列不在是因為它們在三個檔案裡。所以寫檔擋的不是「回傳進 session」，而是「列進 join」。
寫檔另有三個受力點，刪了就斷：adversary 只讀路徑（`SKILL.md:203`，Agent 後備形式更只能如此）、跨 task 裁決要能回頭開檔而不把列放進 join（`:187-188`）、`→ build` 的 finding 要有 `path:line` 可引——`journal.jsonl` 以 hash 為鍵，引不了。`:181-183` 該改的是理由句，並把路徑釘到 `.fankeel/build/<plan>/`：09-04 那支寫進 scratchpad，scratchpad 會被清。
留寫檔就要 Write：09-04 三個 verifier 各呼叫 `Write` 一次（agentType `workflow-subagent`，預設全工具）；`fankeel-reader` 明寫 Bash 不拿來寫檔（`agents/fankeel-reader.md:25-26`），`fankeel-reviewer` 的 Bash 只限 git（`:27-29`），`fankeel-judge` 是 fable 加固定四欄——三支都不合，新 agent 是被寫檔決定的，不是被 red-green 決定的。
red-green 不歸 verifier：`SKILL.md:137-138`、`:209-210` 把它留在 session，並行 verifier 共用一棵樹；要紅就照 build reviewer 的做法在 scratch copy 上（build `:299-303`），否則該列寫 `no negative path`。釘型別只關掉 Edit/Write 這條路——三支現成 agent 都保留 Bash，`guard.js` 只掛 `Edit|Write|NotebookEdit`（`plugin.json:51,76`），`git stash` 這條要靠新 agent 檔的散文擋，這是 TODO:76 那條的事。
brief 兩處事實錯：`skills/fankeel-plan/SKILL.md:290` 釘了 `subagent_type: fankeel-reviewer`，grep 是一命中不是零；plan 唯一沒型別的是 `**Dispatch:**` 行的 implementer，它本來就要 Edit/Write，無缺口。build `:290` 是 reviewer prompt 裡的 `THE MAP:` 行，釘點只有 `:313`。
would flip if: Workflow 腳本本身能寫檔（sandbox 露出 fs）——那 verifier 回列、腳本落檔，`fankeel-reader` 就夠，不必新 agent；這件我沒跑一支 workflow 驗不了。或 red 必須改共用樹上的原始碼——那沒有型別解得了，verifier 只能在 session 內跑。
unread: nothing
