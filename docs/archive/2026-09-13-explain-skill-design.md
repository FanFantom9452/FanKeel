---
status: current
---

# fankeel 不再出貨 output style：原則改走 skill 與注入

**一句話**：Claude Code 固定在 Default，fankeel 的語氣與輸出規則只從提示詞來——每個 stage 的注入（已經有），加一個按需載入的 `fankeel-explain` skill（新）。三個 output style 退役。

## 為什麼

- **使用者看得到、選得到。** plugin 出貨的 style 出現在每個使用者的 `/config` picker 裡（2026-09-13：`fankeel:fankeel-review`、`fankeel:fankeel-pipeline`、`fankeel:fankeel-terse`），而維護者要的是所有人留在 Default。文件沒有把 plugin style 藏起來的辦法（https://code.claude.com/docs/en/plugins-reference.md 未記載）。
- **style 到不了 subagent。** subagent 跑自己的 system prompt，只有 fork 繼承（https://code.claude.com/docs/en/sub-agents.md）。所以它們不是給 background agent 用的，也改變不了派出去的工作。
- **隨 stage 變的形狀本來就在注入裡。** `output shape:` 是「the dynamic half a style cannot do」（`docs/output-styles.md:50-52`），每個 prompt 重送。
- **放棄的東西。** style 在 system prompt 裡，compaction 稀釋不到；skill 要描述命中才載入。mode 開著時注入每輪重送，差距只在 mode 外。

## 1. 三個 style 停止出貨

- `output-styles/` 刪除，`.claude-plugin/plugin.json` 拿掉 `outputStyles`。
- `.fankeel/docs.json:35` 的 `output-styles` bucket 拿掉。
- `tests/output-styles.test.js` 刪除；`tests/source.test.js:173` 的 shipped 清單拿掉 `output-styles`。
- `tests/render.test.js:343-351` 改讀 `skills/fankeel/SKILL.md`：留下 `The <n> always-on rules` 那條斷言（Calibration 節已經這樣寫），刪掉 `<N> lines a turn` 那條——那句講的是注入與 `fankeel-pipeline` 的重疊，style 退役後不存在。
- `lib/stages.js:47`、`:73`，`tests/stages.test.js:53`，`tests/brief.test.js:162` 的註解改成只講注入，不再以「放進 style 會怎樣」為理由；`tests/docs.test.js:488` 那句講的是過去，不改。

## 2. 理由記下來，舊頁退役

- `docs/output-styles.md` 移到 `docs/archive/`；`README.md:179` 與 `docs/README.md` 指向它的列改寫或移除。
- 新增 `docs/decisions/2026-09-13-no-output-styles.md`：寫下「為什麼」四點、0.20.0 當初為什麼選 style（`docs/output-styles.md:26-48`）、這次為什麼推翻，以及第 3 節兩處偏離原 prompt 的依據。
- `skills/fankeel/SKILL.md` 的 `## Output styles` 節改成一段：使用者要更短或固定格式時，指向 `fankeel-explain` skill 或該 stage 的 `output shape:`，不承諾「會記得」。
- `TODO.md:88`（style 到不到 subagent）刪除——文件已經回答：到不了。

## 3. `fankeel-explain` skill

- `skills/fankeel-explain/SKILL.md` 照 `.fankeel/build/2026-09-13-explain-skill/SKILL.md` 草稿全文建立。
- description 帶觸發詞：presentation、report、status sync、project init、簡報、報告、進度同步、整理思路，以及 session 失焦、重複或可能誤解專案時；長度 60–500 字元（`tests/skills.test.js:80-81`）。
- `tests/inventory.test.js:13` 的名單加上 `fankeel-explain`。
- 兩處刻意偏離原 prompt：反轉只在證據推翻了某個假設時用；七個自問換成「只讀第一行和最後一行」的可驗證檢查。依據（`docs/plans/2026-09-09-design-class-prompt.md:221`、`docs/improvement-brief.md:776-789`）寫在 decision record，不寫進 skill。

## 4. survey 說出不知道的

- `lib/stages.js:236` 的 survey template 加一行 `unknown: <needs confirming, or "none">`，`skills/fankeel-survey/SKILL.md` 的 Output 區塊同步。
- survey 注入區塊在 reference size 下仍小於 2400（`tests/render.test.js`）：現在 2339，估計加 41。

## 5. caveman.zip

- `caveman.zip` 刪除，`.gitignore:6-8` 移除。
- `tests/docs.test.js:509` 註解裡的例子從 `caveman.zip` 改成 `.impeccable/`。

## What proves it done

| 條件 | 怎麼證明 |
|---|---|
| 新 skill 有被測到 | `tests/inventory.test.js` 先加名字 → `skills/ holds exactly the known directories` 紅；建 skill → 綠 |
| style 真的沒了 | `.claude-plugin/plugin.json` 無 `outputStyles`、`output-styles/` 不存在、全套綠 |
| survey 的形狀 | 渲染出的 survey 區塊含 `unknown:`，且小於 2400 |
| 文件 | `docs-check`、`todo-check` exit 0 |
| skill 真的會被叫到 | headless `claude -p --plugin-dir <tree>` 送「幫我準備一份專案進度同步」，transcript 裡有 `Skill` 呼叫 `fankeel-explain`；跑兩次 |

## 不做

- 不改 `land` 與 `/fankeel` init 的注入（各剩 4 與 39 bytes）；同步六欄只在 skill 裡。
- 不動 `ALWAYS`。
- 不改有日期的紀錄：`docs/reports/2026-09-07-style-to-subagent.md`、`docs/judgements/`、`docs/plans/2026-09-07-*`、`docs/README.md:64,119` 的「read in from caveman.zip」。

## 未驗證

- settings 仍寫著 `fankeel:fankeel-terse` 的使用者，style 消失後 Claude Code 怎麼處理：文件沒寫，本機沒有人設。
