---
status: current
---

# ponytail 收錄：三項收進 fankeel，其餘解耦

2026-09-12。接續 caveman 的做法：盤點 → 逐項核准 → 寫成 fankeel 自己的 →
解耦並以測試釘住 → 解除安裝留給使用者。盤點見
[簡報 §6.5](../improvement-brief.md#65-ponytail-去依賴)。

使用者在 design 核准收錄三項：`ponytail-review`、`ponytail-audit` 的程式碼那一半、
ladder。不收：`ponytail-debt`、`ponytail-gain`、`ponytail-help`、三個 hook。

plan 階段對照 map 改了一處：design 原本寫「每個頂層程式碼目錄一個 reviewer」，
和 current 頁 `docs/subagents.md:362-368` 衝突——切目錄會丟掉「沒人呼叫這個」這類
發現——所以 §3 改成三個 lens 各掃整棵樹。§5 多了 `docs-check` 對 report 的處理。

## 1. 解耦

- `lib/render.js` 不再讀外掛清單：`ponytailLine`（:108-110）、`has` 的 require（:20）、`rulesFor` 傳入的 `ponytail`（:133）與 export（:383）一起拿掉，:97-107 的註解隨之刪除。
- `lib/plugins.js` 刪除：`lib/render.js` 是它唯一的 production caller，拿掉後沒有人用。
- `lib/stages.js:352` 的 audit 規則以固定句取代 `{{PONYTAIL}}`：`Code half: three reviewers by lens, cuts only.`，比它取代的 fallback 句短；`RENDER_TOKENS`（:441）拿掉 `ponytail`。
- 註解與散文不再點名外掛：`lib/live.js:34` 拿掉 `ponytail:` 前綴；`scripts/docs-audit.js:15` 改說程式碼那一半是三個 reviewer lens；`skills/fankeel-land/SKILL.md:188` 改成不點名。
- 測試跟著改：`tests/route.test.js` 裡 `plugins.has` 與 `ponytailLine` 的測試（:17-18 的 require，:192-240）刪除；`tests/stages.test.js:100-102,227-230,323-331` 改斷言固定句；`tests/render.test.js:611-612` 的註解改寫。

## 2. 刪減審查（review）

- `agents/fankeel-reviewer.md` 新增 `## Cuts` 一節：五個標籤 `delete:`、`stdlib:`、`native:`、`yagni:`、`shrink:`；格式 `path:line: <tag> <要刪的>. <取代它的>.`；結尾 `net: -<N> lines possible.`，沒得刪就回 `lean`；一個 smoke test 或 assert 自檢永遠不算刪減項。description 補一句它也做 audit 的程式碼那一半。
- `skills/fankeel-build/SKILL.md` 的 reviewer 模板（:293-310）加 Part 4：只看這個 diff 新增的行，照 agent 檔 `## Cuts` 的格式回報；刪減項和其他 finding 一樣進 fix row。

## 3. audit 的程式碼那一半

- `skills/fankeel-audit/SKILL.md:176-179` 改寫：每兩週那一輪派三個 `fankeel-reviewer`，各掃整棵樹、各帶一個 lens、只做 `## Cuts`——沒人需要的（`delete:`、`yagni:`）、別的東西已經在做的（`stdlib:`、`native:`）、可以更短的（`shrink:`）。依 net 排序，和文件那一半的發現一起在關卡提出，不自動套用。取代「有裝就用、沒裝就說」的分支。
- `skills/fankeel/SKILL.md:482` 與 :510-516 的程式碼那一半：ponytail 那一列換成 fankeel 自己的三個 lens；`none of them` 那列拿掉，graphify / codegraph 那列保留。
- `tests/skills.test.js:107` 改成斷言 audit skill 寫著三個 `fankeel-reviewer` 與 `## Cuts`，不再斷言 `ponytail-audit`。

## 4. ladder

- `skills/fankeel-design/SKILL.md` 第 2 步加五階，停在第一個成立的：它不必存在 → 標準函式庫 → 平台原生 → 依賴（先用專案已有的）→ 最少行數。只寫在 skill，不進注入層：design 的注入已經是 2434 / 2500 bytes（`skills/registry.json`）。

## 5. 文件

- reference 頁跟上：`docs/pipeline.md:357,921-923,975-977`、`docs/subagents.md:366-368`。
- `docs/improvement-brief.md` §6.5 改寫成已落地、收了哪三項，不留指向已刪程式碼的 `path:line`。
- `docs/decisions/fankeel-shell.md` 論證外掛偵測那一節末尾加一行 `*(Superseded 2026-09-12: …)*` 註記，不改原句：決策記錄記的是當時。
- `scripts/docs-check.js` 不再對 report 檢查路徑是否存在，理由和 decision 相同：report 是有日期的快照，它點名的是當天存在的檔。刪掉 `lib/plugins.js` 會讓 `docs/reports/2026-09-02-process-state-review.md:214` 被標成 `gone`，而 report 事後不改。
  - *Corrected 2026-09-12:* 這個前提是錯的。`scripts/docs-check.js:206` 在這條 branch 之前就對 `report` 與 `archive` 直接 return，那份 report 從來不會被標成 `gone`；Task 6 因此只留下釘住 :206 的測試，腳本沒改（見 ledger 的 ruling）。
- `TODO.md:74` 與 `TODO.md:120` 兩條 ponytail 條目關閉；`docs/README.md` 補這份設計與它的 plan 的索引列。
- `skills/registry.json` 用 `scripts/stage-registry.js` 重新產生。

## 6. 證明做完

- 新測試放在 `tests/source.test.js`：git 追蹤的 `lib/`、`scripts/`、`hooks/`、`agents/`、`skills/`、`output-styles/`、`assets/`、`.claude-plugin/` 檔案都不含 `/ponytail/i`。現在紅（`lib/render.js`、`lib/stages.js`、`lib/plugins.js`、`lib/live.js`、`scripts/docs-audit.js` 與三份 SKILL.md），做完綠。
- `tests/skills.test.js` 的 audit 斷言改寫後，現在紅，做完綠。
- 產出物：audit 階段渲染出的注入不含 `{{`、不含 `ponytail`；`skills/registry.json` 裡 audit 的 `prompt_bytes` 不大於現在的 2424。
- 全套 `npm test` 綠；`docs-check` 與 `todo-check` exit 0。

## 7. 不做

- 不收 `ponytail-debt`、`ponytail-gain`、`ponytail-help`，也不收三個 hook。
- 不解除安裝 ponytail：land 時提出指令，由使用者自己跑。

## 未驗證

build 的 Part 4 會不會讓 fix round 變多：刪減項照規則進 fix row，但還沒有一次 build 跑過它。
