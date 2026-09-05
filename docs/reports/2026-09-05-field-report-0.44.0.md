---
status: current
last_verified: 2026-09-05
source_of_truth: 本頁是另一個 session（084994f1，F:/ymlab/Latex/production）在 0.44.0 上跑完一整輪之後的回報，逐字收錄、不隨程式碼更新；它點名的每條缺陷各有一行 TODO.md
---

# fankeel 0.44.0 — 未收掉的 session 清冊 ＋ 一輪完整跑完之後的回報

回報日期：2026-09-05
外掛版本：`0.44.0`（`C:\Users\Owner\.claude\plugins\cache\fankeel\fankeel\0.44.0`）
原始碼倉庫當下狀態：`F:\ymlab\fankeel` @ `7d29c65`，分支 `skill-split`
產生這份報告的 session：`084994f1-bef0-4dc7-8946-48f777ea2d41`（`F:\ymlab\Latex\production`，已 stand down）

**搜尋範圍（誠實說明）**：`find` 掃過 `C:\Users\Owner` 與 `F:\ymlab`（`-maxdepth 6`），
`F:\MC_Server` 底下的兩個 registry 是從 `station.html` 得知的。**其他磁碟與更深的層級沒有掃**，
所以下面的數字是**下界**，不是全貌。

---

## 第一部分：沒有收掉的 session

**11 個 registry，11 條 `active: true`。** 只有 2 個 registry 是乾淨的。

| # | registry | session | 任務 | 停在 | 閒置 | claims |
|---|---|---|---|---|---|---|
| 1 | `F:\ymlab\fankeel` | `1b2db068` | 拆分七個 stage skill | `build` 4/7 | 8 小時 | 14 |
| 2 | `F:\MC_Server\…\00_Day_of_Killing_II_DEV\…` | `59403ab9` | TODO 全清：四條決策落槌 | `audit` 6/7 | 17 小時 | 10 |
| 3 | `F:\ymlab\EMU3000_Web` | `246f9b6f` | 把 Export/data 推上內部 Gitea | `design` 2/2 | **3 天** | 0 |
| 4 | `F:\ymlab\School_ClassProjects\ccexp` | `a95b0b68` | 寫 docs/12：提示詞組裝機制 | `land` 5/5 | **4 天** | 6 |
| 5 | `F:\ymlab\School_ClassProjects\ESP32s3-pressure` | `35e2180b` | 跑 XH711 探針的 FULL 輪 | `build` 4/4 | **7 天** | 4 |
| 6 | `F:\ymlab\School_ClassProjects\ESP32s3-pressure` | `83b02de7` | 整理全專案文件成單一來源 | `survey` 1/7 | **7 天** | 0 |
| 7 | `F:\ymlab\sec-test` | `bc0c0734` | 幻覺套件偵測擴到 crates.io / Go / Maven | `audit` 6/7 | **7 天** | 12 |
| 8 | `F:\ymlab\SBIR\ProjectWorkspace` | `38dc2b09` | 定義權限模型 | `survey` 1/3 | **8 天** | 0 |
| 9 | `F:\ymlab\SBIR\ProjectWorkspace` | `e8268bd0` | 封存 A2 資料源進版控 | `land` 7/7 | **8 天** | 0 |
| 10 | `F:\MC_Server\…\00_DeathArenaII_DEV\…` | `3c04231f` | 閘門系統遊戲內驗收 | `verify` 2/2 | **9 天** | 0 |
| 11 | `F:\ymlab\claude-kit` | `0b81e429` | 確認 install 是否比對版本並自動安裝 | `survey` 1/1 | **9 天** | 0 |

乾淨的兩個：`F:\ymlab\Latex\production`（5/5 全收）、`F:\ymlab\PaperResearcher`（1/1 全收）。

### 值得注意的形態

- **9 條閒置 3 天以上**，其中 6 條閒置 7 天以上。
- **7 條 claims 是 0** —— 開了任務、推了 stage，但一個檔都沒動。第 9、11 條甚至已經
  在 `land`／唯一的一階，claims 仍是 0。
- **`stage` 與 `next` 對不上的兩條**：
  - `a95b0b68` 停在 `land`，`next` 卻是「build：docs/12 → 01 五處 → 02 四條 → README」
  - `3c04231f` 停在 `verify`，`next` 卻是「做鑰匙道具 → 建第一道門 → 進遊戲跑全流程」
  兩條都是「stage 推過去了，實際工作沒跟上」。
- `3c04231f` 是 `configDir: null` 的舊格式紀錄，同時 claims 0、閒置 9 天。

---

## 第二部分：`/fankeel-station` 看不到 11 個 registry 裡的 6 個

**這是這份報告裡最重要的一條，因為它讓上面那張表在你日常的工具裡是看不到的。**

`station.html` 只列出 5 個 registry。實際有 11 個。少掉的 6 個裡有 **7 條 active session** ——
也就是上表第 3、5、6、7、8、9、11 條，全部都是閒置最久的那幾條。

**原因在 `lib/station.js:39-54`**，`discover()` 的 root 來源只有四種：

```js
for (const lead of badge.readLeads(configDir)) add(lead.fields.root);   // ① 還活著的 statusline badge
for (const s of live.runningSessions(configDir) || []) {                 // ② 現在正在跑的 session 的 cwd
    if (s.cwd) add(registry.findStateRoot(s.cwd));
}
for (const root of opts.roots || []) add(root);                          // ③ --root 參數
if (opts.cwd) add(registry.findStateRoot(opts.cwd));                     // ④ 當下的 cwd
```

**它從來不走檔案系統去找 `.fankeel/sessions`。** 所以一個 registry 要被看見，必須此刻有
session 在跑、或還留著 badge lead。而「session 早就關掉、任務放著沒收」——
正是 station 存在的理由 —— 恰好是它結構上看不到的那一種。

SKILL.md 說「For every registry on the machine rather than this one, `/fankeel-station`」，
但實作只能看到「此刻活著的那些」。

**建議**：加一個檔案系統掃描（可以快取索引，或至少 `--scan <dir>`），
或把已知 root 累積寫進 `~/.claude/fankeel/roots.json`，看過一次就記得。

---

## 第三部分：`%TEMP%` 底下有 297,088 個沒清掉的測試暫存目錄

```
$ find /c/Users/Owner -maxdepth 6 -type d -name sessions -path "*.fankeel*" | grep -c /Temp/
297088
```

依前綴分群（全部是依模組命名的測試 fixture）：

| 前綴 | 數量 | | 前綴 | 數量 |
|---|---|---|---|---|
| `fankeel-task-` | 66,287 | | `fankeel-touch-` | 12,255 |
| `fankeel-reg-` | 55,082 | | `fankeel-carry-` | 7,296 |
| `fankeel-hook-` | 35,724 | | `fankeel-dirty-` | 7,022 |
| `fankeel-guard-` | 28,107 | | `fankeel-orient-` | 5,659 |
| `fankeel-ws-` | 20,528 | | `fankeel-root-` | 4,431 |
| `fankeel-resume-` | 18,382 | | `fankeel-gate-` | 3,007 |
| `fankeel-route-` | 18,063 | | `fankeel-home-` | 1,477 |
| `fankeel-brief-` | 13,039 | | 其餘 | 略 |

一個樣本（`fankeel-task-0047wT`）的內容：

```
.fankeel/.gitignore
.fankeel/sessions/aaaaaaaa-1111-2222-3333-444444444444.json
.fankeel/sessions/bbbbbbbb-1111-2222-3333-444444444444.json
cfg/modes/aaaaaaaa-…/fankeel        cfg/modes/aaaaaaaa-…/fankeel.lead
cfg/modes/bbbbbbbb-…/fankeel        cfg/modes/bbbbbbbb-…/fankeel.lead
cfg/sessions/312600.json
9 個檔，13 KB
```

日期範圍 **2026-08-21 → 2026-09-05**（16 天）。隨機取 25 個量 `du`：平均 **16.0 KB／個**，
297,088 個推估 **≈ 4.5 GB**。（是 25 個樣本的外推，不是全量 —— 對 29 萬個目錄跑 `du`
本身就會逾時。）

**建議**：測試的 fixture 在 teardown 收掉自己的暫存目錄；或至少提供
`npm run clean:tmp`。目前這個累積速度是每天約 2 萬個目錄。

---

## 第四部分：跑完一輪之後，工具本身的六條

這一輪是在 `F:\ymlab\Latex\production\LevelMark` 用完整六階
（`survey → design → plan → build → verify → land`，中途因為發現獨立工作而升級加了 `plan`）
做完一個功能：16 個 commit、24 檔 +1816/−144、pytest 654 / vitest 1691 / e2e 14 / smoke。
下面每一條都當場重現過。

### 4.1 `docs-check` 的角色統計與 `roleOf()` 對不上

**位置**：`scripts/docs-check.js:293-301`

```js
const declared = docs.roleOf(tree, rel);
const role = declared || 'reference';                                  // null 一律當 reference 評分
if (!declared && rel.split('/')[0] === docRoot) unfiled.push(rel);     // 但只有 docs/ 底下才列出來
counts[role] = (counts[role] || 0) + 1;
```

**重現**（LevelMark，29 份 markdown）：

```
$ docs-check --root LevelMark
  8 archive, 5 plan, 16 reference          ← 沒有「in no bucket」那一行

$ 直接問 roleOf()
null       GEMINI-MOCKUP-PROMPT.md
null       canvas-nested-sample.md
null       worker/README.md
```

真值是 **13 reference**（`docs/` 深度 1 的 10 份 ＋ `ROOT_REFERENCE` 的 3 份）
＋ 5 plan ＋ 8 archive ＋ **3 份沒有角色**。那 3 份因為不在 `docs/` 底下，
被當成 reference 評分卻不會被列進 `unfiled` —— **兩邊都看不到**。

**咬到的地方**：`fankeel-verify` 要求「A coverage claim states its denominator」。
我照摘要那行寫成「reference 16/16 讀完」，真值是 13/13。是 verify 的 adversary 抓出來的。
SKILL.md 自己寫著「A markdown file in no bucket is reported」，實作只在 doc root 底下兌現。

### 4.2 `docs-check` 沒有「這次改動有沒有新增壞掉的引用」的模式

比**數字**證不了任何事：新增一筆、順手修掉一筆，數字不變。
我這一輪前後都是 21，看起來乾淨；實際開了乾淨 worktree 在基底 commit 比排序後的清單，
才知道是 22 → 21，而唯一差異來自一個未追蹤暫存檔 —— 也就是這條分支新增 0 筆、修掉 0 筆。

**建議**：`--since <ref>`，或至少在文件裡明講「比清單不要比數字」。

### 4.3 `todo-check` 的 `SECTIONS` 寫死、沒有 per-project 出口、exit 1

**位置**：`scripts/todo-check.js:214-221`

LevelMark 的 `TODO.md` 用「## 來自 2026-08-25 的 `/ponytail-audit`」這種日期標題
（六個標題都是，先於 fankeel 存在）：

```
$ todo-check --root LevelMark ; echo $?
… 22 筆 unclassified（＝檔案裡的每一條）
1
```

`fankeel-land` 把它當收尾閘門，但在這個倉庫訊號量是零 —— 新加的三條與既有十九條混在一起。
`MAX_ENTRY_CHARS = 200` 也一併罰了既有條目。

**建議**：讓專案宣告自己的 section 名稱；或在「全檔沒有任何一條符合白名單」時
降級成一次性提示，而不是逐條報錯 ＋ exit 1。

### 4.4 `--root` 相對 cwd 解析，不是相對 registry

```
$ cd LevelMark && docs-check --root LevelMark
fankeel docs-check: nothing readable under this directory.
$ cd ..        && docs-check --root LevelMark
fankeel docs-check — 29 markdown files, tree: flat
```

`survey.js --root` 同樣。session 的 cwd 常常就是專案本身，registry 在上一層，
所以照 SKILL.md 抄會直接失敗，而錯誤訊息看不出是路徑解析的問題。

### 4.5 `ledger.js` 沒有放 build 步驟 3 掃描表的 verb

`fankeel-build` 說「Write the table into the ledger」，但 verb 只有
`init, complete, ruling, show, groups, ranges`。我把表放在回覆裡、把它**揭露的東西**
用 `ruling` 記進 ledger，於是表格本身在壓縮之後就沒了 —— 而那正是 ledger 的用途。

### 4.6 `station.js` 只產 HTML、只印路徑

```
$ station.js
fankeel station — C:\Users\Owner\.claude\fankeel\station.html
```

沒有 `--text` / `--json`，所以一個 session 讀不到自己剛產生的答案。
為了寫這份報告的第一部分，我只能 grep 那個 HTML 撈路徑 —— 而且如第二部分所述，
撈到的還只是 11 個裡的 5 個。

---

## 第五部分：這一輪確實擋下真實錯誤的四件事

1. **`ledger.js groups` 的 `Consumes` 旗標。** 它指出 Task 2 的 `Consumes` 文字點名了
   Task 1，而兩者卻因 `Files` 不相交被分在同一組。那是真的相依：Task 2 的 e2e 需要
   Task 1 的欄位已經在**重建過的 api container** 裡。照 groups 一起送會紅在
   「找不到選擇器」，完全指不到真正的原因。**在第一次 dispatch 之前就擋下來了。**

2. **verify 階段的 adversary。** 打掉我四列證據，四列都成立：
   ① 我把紅綠測試裡「存活的那一支」名字記錯（實際是
   `test_start_with_timezone_against_stored_naive_due`，我寫的那支根本不在 `-k` 的範圍內）；
   ② 分母 16 vs 13（＝4.1）；③ docs-check 比數字不能證明「沒有新增」（＝4.2）；
   ④ 我的截圖舊於一個邊緣溢出的修正 —— 也就是「人眼確認過」的那一版正好是有缺陷的那一版。
   **四件事我自己都不會發現。**

3. **整條分支 review 的多輪收斂**：13 → 6 → 3 → 2 → 2 筆。第四輪推翻了我第三輪做錯的
   決定（把時區偏移換算成 UTC，會讓每個負偏移時區的顯示歪一天；正解是丟掉偏移保留牆鐘）。
   單輪 review 抓不到這個 —— 是「修完再看一次」才看出方向錯了。

4. **range 兩端都釘住的 review。** 四個 task 的範圍互不重疊，在 build 有 dispatch 並行的
   情況下，沒有任何一次 review 走進隔壁 task 的 diff。這件事完全靠 `ranges` 撐著。

---

## 附錄：這一輪的數字

| | |
|---|---|
| route | `survey → design → plan → build → verify → land`（design 階段發現獨立工作，用 `task.js route` 升級加了 `plan`） |
| 各階段 | survey 8m、design 4m、build 8h47m（294k）、verify 35m（26k） |
| commit | 16 |
| diff | 24 檔 +1816 −144 |
| review | 每 task 一輪（4）＋ 整條分支 5 輪 ＝ 9 輪，26 筆發現全數處理 |
| ruling | 6 筆記在 ledger |
| 紅綠證明 | 4 個守衛（2 個在 verify 重跑、2 個在 build 取得） |
| dispatch | 12 個 subagent（implementer 2、reviewer 6、文件讀者 4），除整條分支 review 用 opus 外全部 sonnet |
