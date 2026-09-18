---
status: decision
last_verified: 2026-09-18
source_of_truth: lib/usage.js, docs/station.md, skills/registry.json, skills/fankeel/SKILL.md, docs/subagents.md
---

# caveman：一樣都不吸收 — 決策紀錄

`TODO.md`〔caveman〕條問的是 caveman 1.0.1 二十個 skill 裡要吸收哪些，背景在
`docs/improvement-brief.md` §1.5、§6.4。那一條列了三項候選——`caveman-stats`、Native
Core 六個流程 skill（`investigate-first`、`lean-build`、`migration`、
`safe-refactor`、`surgical-patch`、`verify-and-stop`）、`cavecrew` 的委派決策
指南——每項都已經有 fankeel 自己的對應，而且更強或至少一樣。三項都不吸收。

## caveman-stats → `lib/usage.js` 與 station 的花費分頁

`caveman-stats` 由 hook 在 session 內算好注入：本 session 的真實 token 用量與估計
節省，模型不參與計算。`lib/usage.js` 的 `addUsage()` 對每個 `requestId` 只算最後
一份 `usage`，跨 input/output/cache-read/兩種 cache-write 五個欄位分開算，不是
只看一個 session——station 的花費分頁把它按 stage × model 攤開，`usd`、
`cost: null` 分開表示「沒有價目表」與「零元」。caveman-stats 只能看見它注入的
那一次提示；花費分頁是每個登記過的 session 都能事後打開看，一樣是量到的而不是
模型估的，多了跨 session 與按階段兩層。

## Native Core 六個流程 skill → 七個 `fankeel-<stage>` skill 與 `entry_condition`／`stop_condition`

Native Core 的六個 skill 是六份各自獨立的流程樣板，使用者依任務形狀挑一份；
`docs/judgements/2026-09-10-pattern-skill.md` 判過這一類。fankeel 的七站
（survey、design、plan、build、verify、audit、land）是同一條路線依 class 選
子集，不是六份互斥樣板；`skills/registry.json` 每一站都有 `entry_condition`
與 `stop_condition` 兩個機械可讀欄位，這正是這輪 survey 說 Native Core 缺的
「進入／停止條件成對」，fankeel 已經有。

## cavecrew 的委派指南 → 「Dispatch by default」一節與 `docs/subagents.md`

`cavecrew` 是一份「什麼時候該 delegate」的決策指南；cavecrew-builder、
cavecrew-investigator、cavecrew-reviewer 三個 agent 已經個別對到
`fankeel-fixer`、`fankeel-reader`、`fankeel-reviewer`，不在這條待決之列。指南
本身對到 `skills/fankeel/SKILL.md` 的「Dispatch by default, never the
filtering」一節：預設派工，例外只有兩種——一個管線已經濾掉殘留，或者只是一次
工具呼叫——不必先判斷「這件事夠不夠大」。`docs/subagents.md` 的「When to
dispatch one」接著給量測支持這條規則：具名搜尋一支殘留只差 2.55×，不具名搜尋
差到 9.23×。cavecrew 的指南是散文判斷；fankeel 這邊是規則加量測。

## 不吸收，不是沒看

三項都讀過，都有機械可查的對應：`lib/usage.js`、`skills/registry.json`、
`skills/fankeel/SKILL.md` 三個原始碼位置與 `docs/subagents.md` 一份量測頁。
`TODO.md`〔caveman〕解除安裝那條的 `lifts when:` 是這條定案，這條一落地它就從
`## Waiting` 移到 `## Ready`——解除安裝本身不在這一輪做，因為那改的是使用者
自己的 Claude Code 設定，不是這個 repo。
