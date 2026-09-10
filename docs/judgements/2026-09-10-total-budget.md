---
judged: 2026-09-10T15:04:31.233Z
model: fable
agent: fankeel-judge
task: "處理 TODO：Ready 一條與七條待決議，決議走 fankeel-ask"
session: 98873819-d200-4e3b-be77-be352547e51e
stage: design
---

# 判斷 3：整個外掛的總 prompt 預算，要不要一個欄位

## Question

# 判斷 3：整個外掛的總 prompt 預算，要不要一個欄位

## 問題

`skills/registry.json` 每個 stage 有一欄 `prompt_byte_budget`，整個外掛的總預算
沒有欄位。要不要加？加在哪個檔、什麼名字、什麼單位、由誰檢查？

## 你可以自己讀的檔

- `skills/registry.json:5-9` — 每 stage 五個欄位：`name`、`entry_condition`、
  `stop_condition`、`prompt_bytes`、`prompt_byte_budget`。七個 stage
- `lib/stages.js:227,255,285,310,333,358,395` — 七個 `budget:` 數字（2400 或 2500）
- `lib/stage-registry.js:98` — `budget` 不是數字就丟例外
- `lib/stage-registry.js:104` — `prompt_byte_budget: stage.budget`，唯一的寫入處
- `tests/stage-registry.test.js:28-35,42-52` — 逐 stage 斷言與會真的紅的控制組
- `scripts/skills-check.js` — grep `budget` 與 `byte` 都零命中，它不碰這個欄位
- `docs/improvement-brief.md:77` — §1.3 的提案本文
- `docs/improvement-brief.md:83` — 提案的欄位清單
- `docs/improvement-brief.md:111` — 那份簡報自己對這一項的評語
- `docs/improvement-brief.md:542` — 同上，另一處
- `docs/decisions/2026-09-10-todo-ten.md:72` — 這一項當時被刻意延後的紀錄
- `skills/fankeel/SKILL.md` 的 While the mode is on 一節 — 「long on purpose and
  will get longer」，說注入區塊唯一的界線是「是否還會被讀到底」

## 已知的事實

- 兩次獨立的全 repo grep（一次由 subagent、一次由主 session）都確認：沒有總和
  欄位、沒有常數、沒有檢查。這不是漏看。
- `docs/improvement-brief.md:83` 提的是照抄 caveman `compile.mjs` 的 `SKILL_KEYS`，
  外加一個 `native_pack.core_prompt_token_budget: 560` 的總和欄位。
- 這個外掛實際注入的不只 stage 規則：`ALWAYS` 四條、task 與 notes、其他 session、
  `<plugin>` 那行、output shape。總預算若要有意義，得先定義它涵蓋哪些。
- `docs/improvement-brief.md:111` 那格的評語是「不可量測」。你可以推翻它，但要說
  你打算量什麼。

## 算什麼是答案

加或不加。加的話：欄位名、放在 `skills/registry.json` 的哪一層、單位（位元組、
字元、或 token）、涵蓋哪些注入來源、由哪個測試或腳本檢查、超了要怎樣（紅還是
只報告）。不加的話：說出 `docs/improvement-brief.md:111` 的「不可量測」為什麼
是對的，以及沒有總預算時什麼東西會擋住無限膨脹。

## 回傳形狀

- 一行結論。
- 三到六行理由，每行一個。
- 一行「這個決定在什麼情況下是錯的」。
- 不要重述這份 brief。

## Answer

結論：不加總和欄位。`skills/registry.json` 維持每 stage 一欄；整塊注入的上限已在 `tests/render.test.js:498`（`< 3000` 字元），缺的是一處文件引用，不是一個欄位。

理由：
1. brief 的「沒有常數、沒有檢查」不成立：`F:\ymlab\fankeel\tests\render.test.js:454-498` 把整塊注入（每個 stage、五條 notes、`next`、第二個 session、壓縮後的 `context:` 行）在 59 字元根路徑下量到 `< 3000`；另有每 stage `< 2400`（`:546`）、init `< 1400`（`:571`）、subagent brief `< 1400`（`tests/brief.test.js:126`）。
2. brief 暗示 `prompt_bytes` 只涵蓋 stage 規則也不對：`F:\ymlab\fankeel\lib\stage-registry.js:57-65` 呼叫的是 `render()`，輸出已含標頭、class 句、`<plugin>` 行、`ALWAYS` 四條（`lib/stages.js:567` 併入）、stage 規則與 output shape；少的只有 notes 與其他 session，正是 `:498` 那個測試補上的。
3. 「總和」沒有付款人：每個 prompt 只送一個 stage 的塊（`F:\ymlab\fankeel\lib\render.js:12-14`），七個預算相加的 17,100 位元組不會出現在任何 context；每 session 的累計等於單塊乘以 prompt 數，後者不是外掛能定的。
4. caveman 的 `core_prompt_token_budget: 560` 對應的是一句指標式常駐 prompt，fankeel 明文拒絕指標模型（`lib/render.js:5-10`），沒有對應物可以命名、也沒有東西可以量。
5. `docs/improvement-brief.md:111` 的「不可量測」指錯了對象：每 prompt 的塊量到位元組；量不到的是「是否被讀到底」，那是模型迴圈裡的性質，與 `lib/stages.js:115-117` 承認沒測的 `Done when` 同類，加欄位救不了。
6. 沒有總和欄位時擋住膨脹的，是「cap 只能置換、不能上調」的慣例（`lib/stages.js:203-205`、`tests/render.test.js:506,562-564`）加記憶欄位的硬上限（`docs/registry.md:68-69,91`：五條 100 字、`next` 120、claims 60）；真正沒 cap 的一塊是 `renderResume`——`tests/resume.test.js` 沒有尺寸斷言，該補的是那個測試，不是 registry 欄位。

錯的情況：若注入模型改成 caveman 式「規則送一次、之後只送指標」，或 `render()` 開始同時送出多個 stage 的規則，那時常駐部分才需要一個獨立的總預算欄位。

未開：無（brief 點名的每個路徑與行號都讀過；`scripts/skills-check.js` grep `budget|byte` 零命中屬實；HEAD `aca11d5`）。
