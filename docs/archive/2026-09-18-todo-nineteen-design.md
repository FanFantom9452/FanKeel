---
status: design-intent
last_verified: 2026-09-18
---

# TODO Needs a decision 十九條一起做 — 設計

使用者在 `/fankeel` 的選單上答了「DO IT ALL」。取的是 `## Needs a decision` 全部十九條；
`## Waiting` 十三條在等外部事件，不在這一輪。survey 用四個 lens 讀完十九條，98 個
`path:line` 逐一核過，2 個不成立（見 `.fankeel/build/2026-09-18-todo-nineteen/`）。

每一條待決都在這裡定案。定案的依據寫在該節，不另開 decision 頁，只有 §1 例外——它
是「一樣都不吸收」，那個判斷要活得比這份設計久。

survey 改寫了五條的前提，這份設計照改過的寫：

- `:103` 說五支 CLI 都回空集合；實跑 `acceptedFlags()` 只剩 `judge.js` 是空的。
- `:97` 的「只寫進 documents.md」已經做了（`docs/documents.md:121-159`）。
- `:83` 在 09-11 上線時就訂了規則：再量沒降就拿掉。再量是升。
- `:81` 的候選 1 就是 `hooks/size.js`；候選 2 的一半已經在 `lib/context.js:40`
  （`BUSY = 400000`），缺的是把它接到關卡上。
- `:73` 的三項，reader 說只剩 Native Core 的「進入／停止條件成對」是缺口；
  `skills/registry.json` 每站都已有 `entry_condition` 與 `stop_condition`，所以沒有缺口。

## 1. caveman：一樣都不吸收（`:73`）

- 新增 `docs/decisions/2026-09-18-caveman-absorb-none.md`：三項各對到 fankeel 已有的
  東西——`caveman-stats` 對 `lib/usage.js` 與 station 的花費分頁，Native Core 六個流程
  skill 對七個 `fankeel-<stage>` skill 與 `skills/registry.json` 的進入／停止條件，
  `cavecrew` 的委派指南對 fankeel skill 的「Dispatch by default」一節與
  `docs/subagents.md`。每一對寫一句 fankeel 那邊比較強或一樣的理由。
- `docs/improvement-brief.md` §6.4 補一行指向這份 decision。
- `TODO.md:119`（caveman 解除安裝）的 lifts when 是「挑功能那條定案」，這條落地就成立，
  所以它從 `## Waiting` 移到 `## Ready`。**解除安裝本身不在這一輪做**：它改的是
  使用者自己的 Claude Code 設定，不是這個 repo。

## 2. registry entry 記 `version`（`:75`）

- `task.js start` 與 `task.js adopt` 寫 `version`：外掛根目錄 `package.json` 的
  `version`。只記版本號，不記 commit sha——安裝的 cache 沒有 `.git`，要 sha 得在
  發版時另外烤進去，`scripts/version.js` 現在不做這件事。
- 一個 process 啟動時就釘住外掛路徑，所以 start 當下的版本就是這個 session 所有
  hook 的版本；adopt 開的是新 session，記它自己的版本。
- `task` 改名不動它。舊 entry 沒有這個鍵，讀的人當成未知，不回填。
- `docs/registry.md` 的欄位清單與 `skills/fankeel/SKILL.md` 的「Thirteen more」計數
  一起改。

## 3. `gates` 多存問題本文與選項 description（`:77`）

- 每筆 gate 記錄多兩個欄位：`question`（字串）與 `descriptions`（和 `labels` 同長、
  同順序的字串陣列）。兩樣都存，但都是**新增的兄弟欄位**，`labels` 維持字串陣列，
  `lib/station.js` 讀 `labels` 的兩處不用動。
- 兩個欄位照 `labels` 的方式截斷，上限在 plan 定，寫進 `docs/registry.md`。

## 4. session 頁的主迴圈成本分解（`:79`）

- session 頁每一站多一列主迴圈：回合數、其中 context 在 400k 以上的回合數、那些回合的
  花費與佔該站花費的比例。只放 session 頁——十七項報告 §Q 的第 ① 步就是這樣定範圍的，
  首頁彙總沒人要。
- 資料從 station 已有的逐回合資料算，不新增記錄欄位。
- 畫面見 mockup。

## 5. 關卡上接手：`context:` 行接到 gate 的第四個選項（`:81`）

- 選候選 2。候選 1 就是 `hooks/size.js`，已量過沒用（§6）；候選 4 已經是現行做法
  （串接的 fan-out 走 Workflow）；候選 3 不做——它處理的是倒退，不是堆疊。
- `lib/context.js` 的 `contextLine` 在 `BUSY` 以上時改說：**這一站的關卡加第四個選項——
  接手**：設好 `next`，開新終端機，`/fankeel` → Adopt。取代現在「說一次就好」的提醒。
- 回答後回傳的區塊（`renderResume`）也帶這一行。現在只有 prompt 的區塊帶，而關卡是在
  回答之間問的。
- `skills/fankeel/SKILL.md` 講 `context:` 行的那段、以及「第四個選項沒有一站在用」那句
  一起改。`docs/improvement-brief.md` §6.2 記下選了哪一個。

## 6. 拿掉 `hooks/size.js`（`:83`）

- 照 09-11 上線時訂下的規則：再量沒降就拿掉。改前 `bigPerSession` 0.3846，改後
  0.6136。
- 刪 `hooks/size.js`、`tests/size.test.js`，manifest 拿掉那一筆，`tests/resume.test.js`
  裡針對它的斷言一起拿掉，點名它的文件改掉。
- `docs/sources.md` 裡它出現的 Cited by 格子一起更新（§11 的測試會抓）。

## 7. profile 卡：移到首頁頂端，station 行直接給 `serve --open`（`:85`）

- 首頁的 profile 卡從最後移到最前面。
- `/fankeel` 區塊的 `station:` 行多說一句：要改 profile，用 `station.js serve --open`。
- 兩樣都做：使用者兩次都沒找到，一次是位置，一次是不知道要開 serve。

## 8. 給人讀的入口：station 首頁的「文件」卡（`:87`）

- 首頁多一張「文件」卡，讀各專案已經生成的 `.fankeel/map.md`：文件總數與狀態、
  planned-not-built、undeclared、各 bucket 的 role，附上 map.md 的生成時間。
- 讀哪幾份：每個 registry 根目錄自己的 `.fankeel/map.md`，加上它的 entry 在 `project`
  欄點名的每個專案底下的 `.fankeel/map.md`。一份一段，找不到的不列。
- 不翻譯、不另寫一份內容。reference 頁仍然是寫給 session 的；人拿到的是入口與現況，
  不是第二份會漂移的內容。新增 `guide` role 與擴充 README 都等於手寫第二份，`:91`
  已經示範了兩份會怎麼分岔。
- 不在 hook 裡掃 docs：只讀 map.md，沒有就不顯示這張卡。
- `docs/README.md` 開頭加一行，指向這張卡。

## 9. 根目錄 `.ignore` 排除 `docs/archive/`（`:89`）

- 新增 `.ignore`，一行 `docs/archive/`。ripgrep（`Grep`／`Glob` 工具）從此不搜 archive；
  明確給 `docs/archive` 當路徑時照搜。`survey.js`、`docs-check`、`docs-audit` 讀的是
  `git ls-files`，不受影響。
- `docs/documents.md` 講 archive 的地方補一句。

## 10. 三處兩頁同一件事：各指定來源頁（`:91`）

- 版本號同步的次數：`tests/contract.test.js:256` 旁邊就是強制它的程式，數字留在那裡；
  `docs/development.md:79` 拿掉數字改連過去。十與十二哪個對，build 時實查再寫。
- 「design-intent 的 plan 不判」那句：`skills/fankeel-audit/rationale.md:65` 是這條
  規則的主人，`docs/pipeline.md:985` 改連過去。
- request 落在哪個時窗：這是 `usage` 的歸屬規則，`docs/registry.md:246` 留著，
  `docs/station.md:287` 改連過去。

## 11. `docs/sources.md` 的 Cited by：補齊，加測試（`:93`）

- 一次補齊 archive 以外、grep 找得到的 `docs/` 頁。
- `tests/sources-doc.test.js` 加一條：每一列的報告，grep `docs/`（不含 `docs/archive/`
  與 `sources.md` 本身）找得到的引用頁，都要出現在那列的 Cited by；反過來，Cited by
  列的每個路徑都要存在——§6 刪掉 `hooks/size.js` 之後，留在格子裡的名字靠這半條抓。
- `sources.md:4` 那句「filled by hand from grep」保留，現在有測試守著它。

## 12. 唯讀 agent 的 Bash：補清單（`:95`）

- `lib/guard.js` 的寫入 pattern 補兩類：`node -e`／`--eval` 裡的 `fs` 寫入呼叫
  （`writeFile`、`appendFile`、`createWriteStream`、`rename`、`unlink`、`rm`、`mkdir`、
  `copyFile`），與 `python -c` 裡的 `open(..., 'w'|'a'|'x')`、`write_text`、
  `os.remove`、`shutil`。
- 只讀的 `node -e`（`readFileSync`、`require`）照樣放行。
- 不拿掉 Bash：拿掉就連 `npm test` 和 plugin 的 scripts 都跑不了。

## 13. `.fankeel/build/` 維持不進 docs.json（`:97`）

- 關掉這條。進 docs.json 沒有作用：列檔走 `git ls-files --exclude-standard`，
  gitignored 的 bucket 永遠是空的。
- `docs/documents.md` 把「為什麼不是 bucket」寫成一句明講的決定，而不是讓人去推。

## 14. `docs-check` 驗 `path#fragment`（`:99`）

- 連到 repo 內 `.md` 的連結，片段照 GitHub 的 slug 規則比對目標檔的標題：轉小寫、
  去掉標點（CJK 字留著）、空白換 `-`、重複的標題加 `-1`、`-2`。
- 對照組就在 repo 裡：archive 以外現有 10 個帶片段的連結。每一個都要解析得到，
  解析不到的要嘛真的壞了，要嘛是 slug 規則錯了，build 時逐一判。
- 報告格式和現有的 dead link 一樣，照 role 決定要不要查。

## 15. `station.js` 改用 `node:util` 的 `parseArgs`（`:101`）

- `--root`、`--scan` 用 `multiple: true`；未知旗標照舊 exit 2。
- 改完 `acceptedFlags(station.js)` 走的是 options 表那條路，要仍然非空（§16 的測試會看）。

## 16. `judge.js` 的旗標改成 `acceptedFlags` 認得的形狀（`:103`）

- 只改 `judge.js`：它是五支裡唯一還回空集合的。
- `tests/skills.test.js` 加一條：這五支的 `acceptedFlags()` 都不是空集合。

## 17. `lib/skill-overlap.js` 折進 `scripts/orient.js`（`:105`）

- `OVERLAPS` 與 `overlapsIn` 搬進 `orient.js` 並匯出，刪掉 lib 檔；兩個測試改 require
  路徑。點名 `lib/skill-overlap.js` 的文件一起改。

## 18. 三處重複都收（`:107`）

- `lib/usage.js` 兩個函式改呼叫 `entriesOf()`；`lib/registry.js` 四個三行三元式抽一個
  小 helper；`lib/live.js` 改成 `new Set(...)`。行為不變。

## 19. ledger 記下 plan 階段的範圍（`:109`）

- `ledger.js init` 多一個選填的 `--range <a>..<b>`，寫一行 plan 範圍；`ranges` 把它當
  一列列出，verify 就不會把 plan 的 commit 報成沒人審。
- `skills/fankeel-build/SKILL.md` 叫 `init` 的那一步寫明要帶 plan 的範圍。

## 20. 十九條在 TODO.md 關掉

- 十九條都從 `## Needs a decision` 移除；`:119` 移到 `## Ready`（§1）。
- `todo-check` exit 0。

## 不做

- caveman 解除安裝（§1），與 `TODO.md:117` 的極端版——後者要 §5 落地後再量才知道要不要。
- 翻譯 reference 頁。
- §6.2 的候選 3。
- `ledger.js` 的 `--range x ranges` 不報錯（`TODO.md:127`，Waiting）：同一支檔，但不是這條。

## What proves it done

| test | 條目 | 現在 | 之後 |
|---|---|---|---|
| `tests/skills.test.js`：五支 CLI 的 `acceptedFlags()` 都非空 | §16 | 紅（`judge.js` 空） | 綠 |
| `tests/guard.test.js`：`node -e` 寫檔、`python -c` 寫檔被擋；只讀的放行 | §12 | 紅 | 綠 |
| `tests/docs-check.test.js`：壞片段被報；CJK 標題的片段解析得到 | §14 | 紅 | 綠 |
| `tests/sources-doc.test.js`：Cited by 與 grep 比對 | §11 | 紅（13 列） | 綠 |
| task 的測試：`start` 寫的 `version` 等於 `package.json` | §2 | 紅 | 綠 |
| gates 的測試：記錄帶 `question` 與 `descriptions` | §3 | 紅 | 綠 |
| context 與 render 的測試：`BUSY` 以上的那行講關卡接手，回答後的區塊也帶它 | §5 | 紅 | 綠 |
| `tests/ledger.test.js`：`init --range` 那列出現在 `ranges` | §19 | 紅 | 綠 |
| station view 的測試：profile 卡在第一張；有 map.md 才有文件卡；主迴圈列 | §4 §7 §8 | 紅 | 綠 |
| `npm test` 前後都綠 | §15 §17 §18 §6 | 綠 | 綠 |
| `Grep` 搜一個只在 archive 出現的詞：之前有檔、之後 0；給 `docs/archive` 路徑仍找得到 | §9 | 有 | 0 |
| 三句重複的話各 grep 一次，只剩來源頁那一處；連過去的新連結 `docs-check` exit 0。（`docs-audit` 的 pairs 按兩頁共用的原始檔配對，不按句子，這兩對改完仍會列出） | §10 | 兩處 | 一處 |
| `todo-check` exit 0，`## Needs a decision` 0 條，`:119` 在 `## Ready` | §20 | 19 條 | 0 條 |
| 產出物：渲染後的 session 頁，各站主迴圈回合數加總等於頁上的總回合數；400k 以上回合的花費不超過該站花費 | §4 | 沒有這列 | 相符 |

## 對照地圖

- 與目前的頁面有衝突、要跟著改的：`docs/registry.md`（§2 §3 §10）、`docs/station.md`
  （§4 §7 §8 §10）、`docs/documents.md`（§9 §13 §14）、`skills/fankeel/SKILL.md`
  （§2 §5）、點名 `hooks/size.js` 與 `lib/skill-overlap.js` 的頁（§6 §17）。都在這份
  設計裡列了；verify 的 docs-check 會抓漏的。
- `docs/improvement-brief.md` 是 design-intent；§5 與 §1 改它的 §6.2、§6.4，是在記錄
  決定，不是把它當現況讀。
- 沒有把 design-intent 的東西當成已存在來寫。

## 還沒查的

§5 的 `context:` 行是上一個 prompt 或上一次回答時量的。build 迴圈中間沒有 prompt 也沒有
關卡，所以 context 在那段時間跨過 400k，站尾的關卡看不到。
