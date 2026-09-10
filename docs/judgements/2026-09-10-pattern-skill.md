---
judged: 2026-09-10T15:04:31.478Z
model: fable
agent: fankeel-judge
task: "處理 TODO：Ready 一條與七條待決議，決議走 fankeel-ask"
session: 98873819-d200-4e3b-be77-be352547e51e
stage: design
---

# 判斷 5：16 行 pattern skill 的極簡形式，要不要採用

## Question

# 判斷 5：16 行 pattern skill 的極簡形式，要不要採用

## 問題

現在的 stage skill 較重（`skills/fankeel/SKILL.md` 61.9K，
`skills/fankeel-build/SKILL.md` 23.8K），而且混了兩種讀者：人類讀者要理由，
模型讀者要指令。`surgical-patch` 證明 16 行就夠。要不要把 stage skill 改寫成
那個形狀？改的話人類讀者那半去哪裡？

## 你可以自己讀的檔

- `docs/improvement-brief.md:89` — §1.4 的提案本文
- `docs/improvement-brief.md:93-103` — `surgical-patch` 完整 16 行，被引為樣板
- `skills/fankeel-build/SKILL.md`、`skills/fankeel-survey/SKILL.md`、
  `skills/fankeel-verify/SKILL.md` — 現況，各自的長度見 `ls -la skills/`
- `skills/fankeel-build/rationale.md`、`skills/fankeel-audit/rationale.md`、
  `skills/fankeel-plan/rationale.md` — 這個 repo 已經有「把理由拆成另一個檔」的
  先例，三支 skill 有 rationale.md，其餘沒有
- `skills/registry.json` — 每 stage 已經有 `entry_condition` 與 `stop_condition`，
  正是 pattern skill 形狀的那一對
- `lib/stage-registry.js:85-86` — SKILL.md 怎麼被讀
- `lib/stages.js:56` — SKILL.md 是 session 開始時讀一次

## 已知的事實

- `entry_condition` 與 `stop_condition` 這一對已經在 `skills/registry.json` 裡了，
  是 2026-09-10 那個 task 做進去的。pattern skill 形狀所需的骨架有一半已經在。
- 三支 skill 已經有 `rationale.md`，四支沒有。也就是說「拆開兩種讀者」這個做法
  在這個 repo 已經開始了，但沒做完。
- 這題與判斷 4（條件載入到節）互相決定：若條件載入做到節，SKILL.md 就不必為
  最重的情況寫；若 SKILL.md 縮到 16 行，切節就沒什麼可切。兩題的答案要能並存。
- SKILL.md 只在 session 開始讀一次，不是每輪成本。

## 算什麼是答案

採用或不採用。採用的話：哪幾支先改、16 行裡放什麼、現有內容分到 `rationale.md`
還是 `docs/` 底下的 reference 頁、以及怎麼確認改完之後 stage 的行為沒有退化
（這個 repo 有 `evals/` 可以當回歸測試）。不採用的話：說出 `surgical-patch` 的
16 行為什麼不適用於一個帶 route、閘門與 ledger 的 pipeline。

## 回傳形狀

- 一行結論。
- 三到六行理由，每行一個。
- 一行「這個決定在什麼情況下是錯的」。
- 不要重述這份 brief。

## Answer

**結論：不採用「把 stage `SKILL.md` 縮成 16 行」；fankeel 已經有那一層，缺的是把人類讀者那半搬完。**

- `surgical-patch` 的 entry+bullets+stop 形狀，在 fankeel 對應的是每站的注入規則塊，不是 `SKILL.md`：`lib/stages.js:301-309` 的 `build` 就是七條指令加 entry 行加 output 行，2290 bytes、cap 2400，而且每個 prompt 重送（`docs/pipeline.md:314`）；caveman 的 16 行是一次載入的，fankeel 那 16 行等價物早就存在且被預算鎖住。
- `SKILL.md` 縮到 16 行會丟掉注入塊放不下的載重內容：`skills/fankeel-build/SKILL.md:259-261` 明說 commit 骨架「injection has no room for it, so this paragraph is where `build` reads it」，reviewer 模板（`:280-310`）與 `ledger.js` 的 flag-before-verb 文法（`:62-69`）也只在這裡——這與 `docs/pipeline.md:315`「nothing load-bearing lives only here」互相矛盾，帶 route、閘門與 ledger 的 pipeline 有模板和命令文法，token-discipline pattern 沒有，所以 16 行不夠用。
- brief 的兩條「已知事實」要修正：(a) `registry.json` 的 `entry_condition`/`stop_condition` 是從 `lib/stages.js` 規則尾與 `SKILL.md` 的 `**Done when**` 生成的（`lib/stage-registry.js:70-89`，缺了就在 `:96-97` throw），不是獨立骨架，任何改寫都必須保留 `**Done when**`；(b) `lib/stages.js:56` 講的是入口 `fankeel` skill 的 Start flow，stage skill 是「進站讀一次」（`tests/skills.test.js:176`、`docs/decisions/2026-09-05-skill-split-design.md:16`），且讀進來之後常駐、每輪重送為 input，不是一次性成本。
- 該做的是把 `2026-09-05-skill-split-design.md` 的拆分做完：當時 `verify` 被列為 0 行 rationale（`:33`）、196 行，現在 244 行且 `:109-135` 是整段 2026-08-26 的量測（1.5×/1.59×/2.77×）——先拆 `verify`；`build` 從拆後 458 行漲回 473（Claude Code 上限 500，`:41-44`），殘留 7 行帶日期的量測句要再搬一次；`survey` 25/266 低於門檻的判斷仍成立。搬到 `rationale.md` 而不是 `docs/`，契約已在 `tests/skills.test.js:183-229` 鎖死。
- 回歸手段不是 `evals/`：五個 case 沒有一個碰 `build` 或 `ledger`，`scripts/eval.js` 只評 `tool_used` 與 regex（`:9-10`）；真正的回歸是 `tests/skills.test.js` 釘住的三十五句與 `Output` 區塊等於 `templateFor(stage)`，加 `tests/render.test.js` 的注入預算。
- 與判斷 4 並存：`SKILL.md` 留作程序＋模板檔，節粒度條件載入若做，切的是程序裡的 plan/no-plan 分岔；rationale 搬出是另一軸，兩者不互斥。

**這個決定在什麼情況下是錯的：** 若 `2026-09-05-skill-split-design.md:158` 那條「模型會不會從 plugin cache 跟著相對連結去讀 `rationale.md`」至今仍未驗證且驗出來是不會，那再往 `rationale.md` 搬等於把理由丟掉，屆時該做的是先補這個驗證而不是繼續拆——我在 `docs/` 與 `TODO.md` 裡找不到它被驗過的紀錄。
