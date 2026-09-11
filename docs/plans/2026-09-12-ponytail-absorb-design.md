---
status: design-intent
---

# ponytail 收錄：三項收進 fankeel，其餘解耦

2026-09-12。接續 caveman 的做法：盤點 → 逐項核准 → 寫成 fankeel 自己的 →
解耦並以測試釘住 → 解除安裝留給使用者。盤點見
[簡報 §6.5](../improvement-brief.md#65-ponytail-去依賴)。

使用者在 design 核准收錄三項：`ponytail-review`、`ponytail-audit` 的程式碼那一半、
ladder。不收：`ponytail-debt`、`ponytail-gain`、`ponytail-help`、三個 hook。

## 1. 解耦

- `lib/render.js` 不再讀外掛清單：`ponytailLine`（:108-110）、`has` 的 require（:20）、`rulesFor` 傳入的 `ponytail`（:133）與 export（:383）一起拿掉，:97-107 的註解隨之刪除。
- `lib/plugins.js` 刪除：`lib/render.js` 是它唯一的 production caller，拿掉後沒有人用。
- `lib/stages.js:352` 的 audit 規則以固定句取代 `{{PONYTAIL}}`：`Code half: one reviewer per code dir, cuts only.`，比它取代的 fallback 句短；`RENDER_TOKENS`（:441）拿掉 `ponytail`。
- 註解與散文不再點名外掛：`lib/live.js:34` 拿掉 `ponytail:` 前綴；`scripts/docs-audit.js:15` 改說程式碼那一半由 fankeel-audit 自己做；`skills/fankeel-land/SKILL.md:188` 改成不點名的「這個 session 解耦過的外掛」。
- 測試跟著改：`tests/route.test.js` 裡 `plugins.has` 與 `ponytailLine` 的測試（:17 的 require，:198-239 一帶）刪除；`tests/stages.test.js:101,230-231,323-330` 改斷言固定句；`tests/render.test.js:612` 的註解改寫。

## 2. 刪減審查（review）

- `agents/fankeel-reviewer.md` 新增 `## Cuts` 一節：五個標籤 `delete:`、`stdlib:`、`native:`、`yagni:`、`shrink:`；格式 `path:line: <tag> <要刪的>. <取代它的>.`；結尾 `net: -<N> lines possible.`，沒得刪就回 `lean`；一個 smoke test 或 assert 自檢永遠不算刪減項。description 補一句它也做 audit 的程式碼那一半，仍在 `tests/skills.test.js:81` 的 500 字內。
- `skills/fankeel-build/SKILL.md` 的 reviewer 模板（:293-310）加 Part 4：只看這個 diff 新增的行，照 agent 檔 `## Cuts` 的格式回報；刪減項和其他 finding 一樣進 fix row。

## 3. audit 的程式碼那一半

- `skills/fankeel-audit/SKILL.md:176-179` 改寫：每兩週那一輪，對每個頂層程式碼目錄（取自 `survey.js --tree`）派一個 `fankeel-reviewer`，只做 `## Cuts`，依 net 排序；和文件那一半的發現一起在關卡提出，不自動套用。取代「有裝就用、沒裝就說」的分支。
- `skills/fankeel/SKILL.md:482` 與 :514 的程式碼那一半：ponytail 那一列換成 fankeel 自己的 reviewer；`none of them` 那列拿掉，graphify / codegraph 那列保留。
- `tests/skills.test.js:107` 改成斷言 audit skill 寫著 `## Cuts` 的派工，不再斷言 `ponytail-audit`。

## 4. ladder

- `skills/fankeel-design/SKILL.md` 第 2 步加五階，停在第一個成立的：它不必存在 → 標準函式庫 → 平台原生 → 依賴（先用專案已有的）→ 最少行數。只寫在 skill，不進注入層：design 的注入已經是 2434 / 2500 bytes（`skills/registry.json`）。

## 5. 文件

- reference 頁跟上：`docs/pipeline.md:357,923,975`、`docs/subagents.md:368`。
- `docs/improvement-brief.md` §6.5 註明已落地、收了哪三項。
- `docs/decisions/fankeel-shell.md` 論證 `lib/plugins.js` 機制那段（:312-352）加一行 `*(Superseded 2026-09-12: lib/plugins.js is gone; the code half is fankeel-audit's own — see docs/plans/2026-09-12-ponytail-absorb-design.md)*` 註記，不改原句：決策記錄記的是當時。
- `TODO.md:74` 與 `TODO.md:120` 兩條 ponytail 條目關閉。
- `skills/registry.json` 用 `scripts/stage-registry.js` 重新產生。

## 6. 證明做完

- 新測試放在 `tests/source.test.js`：git 追蹤的 `lib/`、`scripts/`、`hooks/`、`agents/`、`skills/`、`output-styles/`、`assets/` 檔案都不含 `/ponytail/i`。現在紅（`lib/render.js`、`lib/stages.js`、`lib/plugins.js`、`lib/live.js`、`scripts/docs-audit.js` 與三份 SKILL.md），做完綠。
- `tests/skills.test.js` 的 audit 斷言改寫後，現在紅，做完綠。
- 產出物：audit 階段渲染出的注入不含 `{{`、不含 `ponytail`；`skills/registry.json` 裡 audit 的 `prompt_bytes` 不大於現在的 2424。
- 全套 `npm test` 綠。

## 7. 不做

- 不收 `ponytail-debt`、`ponytail-gain`、`ponytail-help`，也不收三個 hook。
- 不解除安裝 ponytail：land 時提出指令，由使用者自己跑。

## 未驗證

build 的 Part 4 會不會讓 fix round 變多：刪減項照規則進 fix row，但還沒有一次 build 跑過它。
