已結束超過 14 天的 session 條目連同它自己的 build 目錄，原樣搬到 config 目錄下的 `fankeel/shelf/`，用 `node:sqlite` 記索引；`readAll(root, {shelf:true})` 把架上條目併回，五處讀者、週報與 adopt 都看得到。

| file | change | dispatch |
|---|---|---|
| lib/shelf.js、scripts/shelf.js | 新：搬移（複製比對後刪）、索引、`run`/`find`/`restore` | implementer, sonnet |
| lib/registry.js | `readAll` 加 `{shelf}` 選項、註解改寫 | implementer, sonnet |
| lib/station.js、lib/spend.js、lib/profile.js、lib/settingsuggest.js、scripts/task.js | 五處帶 `{shelf:true}`；adopt 找不到時先 `restore` | implementer, sonnet |
| lib/weekly-collect.js | `sessionFiles` 也讀架上 | implementer, sonnet |
| package.json | `engines` → `>=22.13` | in-session — 一行 |
| docs/90-agent/reference/registry.md、skills/fankeel-land/SKILL.md | 架子、選項、不變式 4 | implementer, sonnet |

proves it done: `tests/shelf.test.js`——搬後本地只剩 live 與近期、檔案總數不變、`readAll`/`sessionFiles` 仍回三筆、`restore` 後 adopt 成功；現在 lib/shelf.js 不存在而失敗。
against the map: lib/registry.js 那行「one entry per session under .fankeel/sessions/」與 registry.md 不變式 4 要改寫，其餘無衝突。
unverified: `node:sqlite` 從 22.13 起免旗標，沒在 22.13 上實跑。
spec: docs/90-agent/plans/2026-11-02-session-shelf-design.md

```json gate
{"questions":[{"header":"Design→Plan","question":"Design -> Plan | fankeel : session 與 build 集中歸檔","options":[{"label":"Go to Plan (Recommended)","description":"核可 spec：14 天門檻、build 跟著條目搬（舊條目都沒有 record 欄位）、不壓縮、engines 提到 22.13、名字叫 shelf；下一步拆成 plan 任務。"},{"label":"Stay in Design","description":"還開著的決定：TODO 原寫要壓縮，這版選擇不壓縮讓讀者直接讀 JSON；要壓縮就留下來改。"},{"label":"暫停","description":"先停在 design；next 設為「design 待核可：shelf 歸檔 spec」。"}],"multiSelect":false}]}
```
