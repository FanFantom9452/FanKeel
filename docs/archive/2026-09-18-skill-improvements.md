---
status: current
last_verified: 2026-09-18
---

# 十五項改進意見分段成 TODO — 實作計畫

**Goal:** 把使用者 2026-09-18 口述的十五項改進意見,依「已存在 / 已裁決 / 真缺口」分段,
真缺口的十條寫進 `TODO.md`,並修正一條既有條目。

**Architecture:** 單一檔案的文字編輯。條目的逐字內容已在
`.fankeel/build/2026-09-18-skill-improvements/todo-draft.md` 定稿並經 design 關卡核准,
本計畫只負責把它們放進 `TODO.md` 的正確標題底下,並通過 `scripts/todo-check.js` 的六項檢查。
不實作十五項裡的任何一項,不發版 —— 兩者都是使用者在 design 關卡明確決定的。

**Tech Stack:** Node.js,`node --test`。`package.json` 的 `dependencies` 與
`devDependencies` 都是空物件 —— 這個專案不加依賴。驗證用 `scripts/todo-check.js` 與
`scripts/orient.js`,兩支都是本 repo 的既有腳本。

**Spec:** [2026-09-18-skill-improvements-design.md](2026-09-18-skill-improvements-design.md)

## Global Constraints

從專案本身取得,不是憑記憶:

- **沒有 `CLAUDE.md`**。`ls CLAUDE.md` → No such file or directory。所以沒有專案層級的
  縮排、commit 風格或禁則可引用;慣例只能從既有檔案本身讀。
- **`package.json`:`dependencies` 與 `devDependencies` 皆為 `{}`**,`engines` 未設。
  `scripts.test` 是 `node --test`,`scripts.clean` 是 `node scripts/tmp-clean.js`。
  不得引入任何新依賴。
- **`node --test` 的 spec reporter 不印 `ok` / `not ok`**,印的是 `✔` / `✖` 與
  `ℹ pass` / `ℹ fail`。用 `grep -E '^ℹ (pass|fail)'` 取結論,不要 grep `ok`。
- **`scripts/todo-check.js:49` `MAX_ENTRY_CHARS = 200`**,正規化空白後計算。
- **`scripts/todo-check.js:61` `SECTIONS = ['Ready', 'Needs a decision', 'Waiting']`**。
  任何其他標題底下的條目都會被判為「沒人說它的狀態」。
- **`scripts/todo-check.js:108` `STAMP = /(?:^|\s)(\d{2})-(\d{2})\.?$/`** —— **錨在行尾**。
  `## Waiting` 條目的 `MM-DD` 戳記必須是整條的最後一個東西。
- **`scripts/todo-check.js:122` `LIFTS = /\blifts when:\s*(.+)$/i`**,而 `:127` 是把
  `STAMP` 從尾巴剝掉之後才取事件文字。所以順序固定:`lifts when: <事件>.` 然後 `MM-DD.`。
- **戳記只在 `## Waiting` 底下被要求**(`scripts/todo-check.js:236` 的註解逐字:
  「The stamp is asked for under `Waiting` and nowhere else」)。`Ready` 與
  `Needs a decision` 不要加戳記。
- **連結不得指向 `plan`、`decision`、`report`、`archive` 四種 role 的頁面。**
  那四種記的是某個時刻而非現況。可用的是 `reference` role 的頁面,以及不在任何
  bucket 裡的程式碼。
- **`.fankeel/map.md` 現況**:192 個 markdown,**3 個 planned, not built**
  (`docs/improvement-brief.md`、`docs/plans/2026-09-09-design-class-prompt.md`,
  以及本計畫的 spec),96 個 retired,8 個 undeclared。
- **`TODO.md` 現況**:Ready 0、Needs a decision 3、Waiting 11。本計畫之後應為
  Ready 2、Needs a decision 9、Waiting 13。

## File structure

| 檔案 | 責任 | 本計畫動它嗎 |
|---|---|---|
| `TODO.md` | 待辦索引,三個標題各自回答「還缺什麼」 | **改** —— 加 10 條、改 1 條 |
| `.fankeel/build/2026-09-18-skill-improvements/todo-draft.md` | 條目的定稿逐字內容與各自的證據 | 讀,不改 |
| `scripts/todo-check.js` | 六項檢查的執行者 | 讀,不改 |
| `scripts/orient.js` | 產出物那一列的第二條路徑 | 只執行 |

一個檔案,一次編輯。沒有第二個任務 —— 十條條目全部落在 `TODO.md` 的三個標題底下,
拆成兩個任務只會讓兩邊爭同一個檔案而序列化,而審查者無法一邊核准一邊否決。

## Task 1: 十條新條目與一條修改進 `TODO.md`

**Files:**
- Modify: `TODO.md` — `## Ready` 加 2 條、`## Needs a decision` 加 6 條、`## Waiting` 加 2 條並改 1 條
- Read: `.fankeel/build/2026-09-18-skill-improvements/todo-draft.md` — 十條的定稿逐字內容與每條的證據出處
- Read: `scripts/todo-check.js` — 六項檢查的實際條件,尤其 `STAMP` 錨在行尾這件事
- Read: `scripts/orient.js` — 驗證時跑,它印的三個數字要和 `TODO.md` 三節的 bullet 數一致

**Interfaces:**
- Consumes: none —— 這是計畫的第一個也是唯一一個任務
- Produces: none —— 沒有後續任務依賴它的輸出

**Dispatch:** in-session — 十條的逐字內容是本 session 自己寫的,已經在這個 context 裡,
派工無法移除已經在這裡的殘渣;而工作本身是同一個檔案上的兩三次 Edit。

### 步驟

先建立對照組,證明檢查真的會紅:

1. 在 `TODO.md` 的 `## Waiting` 底下,先只加〔caveman〕解除安裝那一條,**但故意不寫
   `lifts when:` 子句**。
2. 跑 `node scripts/todo-check.js`。**它必須非零退出,並且指名這一條缺 `lifts when:`。**
   若它是綠的,檢查沒在看這一條,後面所有綠都不算數 —— 停下來查為什麼。
3. 補回 `lifts when: 〔caveman〕挑功能那條定案. 09-18.`,再跑一次,**必須轉綠**。
   這一步只動 `lifts when:` 一個變因,所以紅轉綠只可能由它造成。

然後把其餘條目放進去。在 `TODO.md` 的 `## Ready` 底下,加這兩條:

```markdown
- 〔release〕0.70.0 發版:HEAD 領先 `origin/main` 30 個 commit,裝著的副本凍在 `70771cd`,所以 N23 修好的 guard 箭頭誤判與 `lib/gates.js` 都沒在跑 — [scripts/version.js](scripts/version.js). 推送後要換終端機。

- 〔docs〕`docs/decisions/2026-09-18-needs-decision-all.md` 兩處假敘述:ledger 只有 21 條 `Ruling:`、3 條點名編號,實質定案在 design 文件;送關卡的是四個編號不是三個 — [docs/registry.md](docs/registry.md).
```

兩條都不帶 `MM-DD` 戳記 —— 戳記只在 `## Waiting` 底下被要求。

在 `TODO.md` 的 `## Needs a decision` 底下,加這六條:

```markdown
- 〔registry〕136 筆 entry 沒有任何版本欄位,`burn`/`usage`/`spend`/`clock` 全部無法歸因到哪一版外掛 — [lib/registry.js](lib/registry.js). 待決:記 plugin version、記 gitCommitSha、還是兩個都記。

- 〔caveman〕20 skill 裡要吸收哪些:`caveman-stats` 由 hook 算真實 token、Native Core 六個流程 skill、`cavecrew` 的委派決策指南 — [docs/improvement-brief.md](docs/improvement-brief.md). 待決:挑哪些改寫成 fankeel 規則。

- 〔session〕堆疊手段:subagent 佔 token 從 30.7% 升到 53%,但回傳只佔工具輸出 7.6%、叫醒只佔主回合 7% — [docs/improvement-brief.md](docs/improvement-brief.md). 待決:§6.2 四個候選挑哪個。

- 〔docs〕`.fankeel/build/` 不在 `docs.json` 任何 bucket,不受任何檢查管,但一份任務的證據全在那裡 — [lib/docs.js](lib/docs.js). 待決:進 docs.json 當 fixture、只寫進 documents.md、還是維持不管。

- 〔skill〕三個唯讀 agent 都有 Bash,而 Bash 寫得了檔:`fankeel-reader`、`fankeel-judge`、`fankeel-reviewer` 沒有 Edit/Write 但有 Bash — [agents/fankeel-reader.md](agents/fankeel-reader.md). 待決:拿掉 Bash、靠 hook 擋、還是接受。

- 〔gates〕`gates` 只存 `{at, stage, header, picked}`,沒存全部選項;station 讀了 `labels` 但只餵「最常被換掉」統計 — [lib/gates.js](lib/gates.js). 待決:存全部選項、只存被換掉的、還是維持現狀。
```

在 `TODO.md` 的 `## Waiting` 底下,除了步驟 3 那條之外再加這一條:

```markdown
- 〔gates〕第一筆 `gates` 資料:程式碼 2026-09-18T00:18 落地,136 筆 entry 目前 0 筆有它 — [lib/gates.js](lib/gates.js). lifts when: 0.70.0 裝好、換終端機後有 session 正常結束. 09-18.
```

最後改既有那條。在 `TODO.md` 的 `## Waiting` 底下,把 design class 那條整行換成:

```markdown
- design class:mockup 已落地,其餘是另一個 architectural 任務;計畫的三份必讀來源已不存在,內容多半已併進簡報 — [簡報 §4.1](docs/improvement-brief.md#41-design-階段的-mockup-步驟前端任務). lifts when: 下一個前端任務出現. 09-18.
```

原句的 `lifts when:` 是「下一個前端任務出現,執行 `docs/plans/2026-09-09-design-class-prompt.md`」。
拿掉那個路徑,因為該計畫的「必讀」三份文件全在
`C:\SynologyDrive\School_ClassProjects\caveman\`,實測整個 `School_ClassProjects`
目錄已不存在。戳記從 `09-10` 前移到 `09-18`,因為今天有人重讀過並同意它還在等。

### 驗證

```
node scripts/todo-check.js
```

必須 exit 0。

```
node scripts/orient.js
```

它的 `todo:` 區塊必須印 `Ready 2`、`Needs a decision 9`、`Waiting 13`,
並且與 `TODO.md` 三節各自的 `- ` 開頭行數一致。

## Coverage

| promise | task |
|---|---|
| **發版寫成 `## Ready` 的條目,不在這個任務執行。** 推送 30 個 commit 到公開的 GitHub repo 是對外且難以回復的動作 | Task 1 |
| **關卡上明確問一次。** 這條卡住使用者十五項裡的兩項(第 5 條的誤判修正、第 15 條的 | struck — 已在 design 關卡問過,使用者選「先不發,只寫成 TODO 條目」 |
| **`## Ready` 兩條**:〔release〕0.70.0 發版;〔docs〕修 `docs/decisions/2026-09-18-needs-decision-all.md` 的兩處假敘述 | Task 1 |
| **`## Needs a decision` 六條**:〔registry〕版本號欄位;〔caveman〕20 skill 挑哪些;〔session〕堆疊手段挑哪個;〔docs〕`.fankeel/build/` 的定位;〔skill〕唯讀 agent 的 Bash;〔gates〕要不要存全部選項。 | Task 1 |
| **`## Waiting` 兩條**:〔caveman〕解除安裝(等挑功能定案);〔gates〕第一筆資料(等發版加換終端機)。 | Task 1 |
| **修一條既有的**:`## Waiting` 的 design class 那條,補上它引用的三份必讀來源已經不存在 | Task 1 |
| **關卡上列出六條與它們的裁決,讓使用者逐條決定。** 使用者今天又提了一次,就是訊號 | struck — 已在 design 關卡問過,使用者選「核准,進 plan」,即維持原裁決 |
| **第 2、3、8 條已完整存在**,要說的是「在哪裡、怎麼用」而不是寫成待辦 | struck — 已在 design 關卡逐條說明 |
| **第 12、13 條已有結論**,要說的是結論本身 | struck — 已在 design 關卡逐條說明 |
| **第 11 條的資料推翻了使用者的假設**,要說清楚,因為它會改變第 9 條怎麼選手段。 | struck — 已在 design 關卡逐條說明 |

五條由 Task 1 交付,五條在 design 關卡上已經完成 —— 後五條講的是關卡上要說什麼,
而關卡已經發生,不是 build 的工作。

成功準則兩條(`## 成功準則` 未編號,所以是脈絡不是承諾)也都落在 Task 1 的驗證段:
`todo-check.js` 的紅綠對照在步驟 1 到 3,產出物那一列在驗證段的 `orient.js` 對數。
