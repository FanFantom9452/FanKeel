---
status: design-intent
last_verified: 2026-10-27
---

# 任務板升級：檢查、視覺、在 gate 頁上編輯（10-27）

一句話：任務的 `.board` 多一道 agent 可呼叫的檢查，畫出來有類別配色、圖示與圖例，並且在 session 停在 gate 時，可以直接在 station 的 gate 頁上編輯並寫回檔案，改動自動附進 gate 的回答。

依據：[judgements/2026-10-26-archify-vs-chartroom.md](../judgements/2026-10-26-archify-vs-chartroom.md)（借 archify 的 `validate --json` 想法，不借程式碼）。使用者在 survey 看過兩邊渲染後升為 architectural，並選了「三塊一起設計」「完整編輯並寫檔」。Mockup：`.fankeel/build/2026-10-27-board-upgrade/mockup.html`。

## 背景事實

- 上游 Chartroom（`F:/ymlab/_ext/chartroom`，commit `47506de`，與已 vendor 的版本同一個 commit）的 `src/core/` 有三支純函式還沒複製：`validate.js`（88 行，`validateDoc`，`CODES = dup-id, no-id, bad-field, bad-ref, cross-view-edge, frame-cycle`）、`ops.js`（170 行，`apply(doc, batch)`）、`diff.js`（106 行，`diff`、`summarize`）。`lib/chartroom/README.md` 規定「不改，只重抄」，重抄這三支符合規定。
- Chartroom 的節點已經有 `fill`、`stroke`、`color`、`icon` 欄位（`lib/chartroom/core/fields.js:44-48`），`toSVG(sc, theme, { icons })` 收主題與圖示解析器（`lib/chartroom/geometry/svg.js:9`）。fankeel 目前全用預設值。
- gate 頁對 ```mermaid 圖已經有「點節點標記進回答」（`assets/station/diagram.js` 的 `onMark`）。

## 1. 板子檢查

- 重抄上游 `src/core/validate.js` 到 `lib/chartroom/core/validate.js`，README 的檔案清單與 commit 一起更新。
- `lib/board.js` 新增 `checkBoard(text)`，回 `{ ok, problems: [{ code, id, line, message, fix }] }`：`ParseError` 轉成 `code: 'parse'` 並帶 `line`；`validateDoc` 的每一筆照它的 code；未知欄位回 `code: 'unknown-key'`（警告，不讓 `ok` 變 false）；`icon` 用了 fankeel 沒有的 `fk:` 類別回 `code: 'unknown-category'`（警告）。`fix` 是每個 code 一句固定的修法提示。
- 新增 `scripts/board.js check <file> [--json]`：文字模式一行一個問題，`--json` 印 `checkBoard` 的結果；有錯誤時 exit 1，只有警告時 exit 0。
- `skills/fankeel-design/SKILL.md` 寫 `.board` 那段加一句：寫完跑 `scripts/board.js check`，修到沒有錯誤才算寫完。
- station 的 `GET /station/board/…svg` 遇到檢查錯誤時，422 的內文改成 `checkBoard` 的文字輸出。

## 2. 視覺

- 類別走既有的 `icon` 欄位，前綴 `fk:`：`fk:ui`、`fk:service`、`fk:store`、`fk:queue`、`fk:external`。不新增欄位，所以不會被檢查當成未知欄位。
- `lib/board.js` 的類別表把每個類別對到一組 `fill`／`stroke`／`color` 與一個 24×24 內嵌 SVG 圖示（fankeel 自帶，不加依賴）。節點自己寫的 `fill`／`stroke`／`color` 優先於類別。
- 主題：底色、字型、邊線、frame 的顏色取 station 自己的配色（mockup 定稿的值），以 `theme` 傳給 `toSVG`。只做淺色。
- 圖例：用到至少一個類別時，在板子左下角畫出（寬度不足 720px 時移到板子下方）類別與各自的數量。圖例由 `lib/board.js` 在 scene 之後補成 SVG 群組，並擴大 viewBox，不改 `lib/chartroom/`。
- 沒有用到任何 `fk:` 類別的舊板子，輸出只差主題顏色。

## 3. 在 gate 頁上編輯

- 重抄上游 `src/core/ops.js` 與 `src/core/diff.js` 到 `lib/chartroom/core/`。
- gate 頁顯示該 session 最新的 `.board`，以內嵌 SVG 呈現，這樣才能點擊與編輯。這一點推翻 10-20 決定裡「卡片用 `<img>`、不嵌 SVG」：嵌入只出現在 gate 頁，SVG 由 `toSVG` 產生，每段文字與屬性都已跳脫，圖示只來自 fankeel 自帶的表；session 卡片仍然用 `<img>`。新寫一份 decision 記錄這個例外。
- 只有 session 停在 gate 時（registry 的 `gateAt`，或有待答的題目）才能編輯；其他時候工具列灰掉，顯示原因。agent 這時在等回答，不會同時寫檔。
- 工具列：選取、改文字（節點與連線）、拖動節點、新增節點（可選類別）、新增連線、刪除、標記給 AI（附一句話）、復原。
- 每次編輯，前端把一筆 Chartroom op batch 用 `POST /station/board/<session>/<name>` 送出，帶 nonce。伺服器 `parse`，`apply`，`validateDoc`，有錯就回 422 並拒絕寫入；沒錯就寫回 `.board` 檔，回傳新的 SVG。session 不在 gate 時回 409。
- 標記不寫進 `.board`。標記和每一筆寫入，都記在板子旁的 `<name>.changes.jsonl`（一行一筆：時間、`summarize` 的文字或標記內容）。
- gate 頁側欄在回答框上方列出這次 gate 以來的改動（讀 `changes.jsonl`），每筆可以移除，移除的是標記，或以反向 op 復原。
- 改動清單由 `hooks/resume.js`（AskUserQuestion 的 PostToolUse）附進回答，不由頁面附。不管是在 station 還是 Claude Desktop 回答，這個 hook 都會跑：它讀這個任務 build 目錄下每個 `*.changes.jsonl` 裡還沒送出的紀錄，附在 `<stage>-answer.md` 的回答之後，也附進它注入的 `additionalContext`，然後把這些紀錄標成已送出。沒有未送出的紀錄時，輸出不變。
- station 代答時這個 hook 也會跑：`hooks/gate.js:192-197` 是以 `permissionDecision: 'allow'` 加上 `updatedInput.answers` 放行，工具照樣執行，所以 PostToolUse 會觸發；這個回答形式在 2026-09-24 的 probe 裡確認過（`docs/90-agent/reference/station.md:1530`）。那次 probe 看的是模型有沒有收到回答，沒有觀察 PostToolUse 本身，所以 verify 要在 `gate.station` 打開的真實 session 跑一次，確認 `<stage>-answer.md` 附上了改動。這個專案的 `gate.station` 目前是 `off`，所以今天每個回答都經由終端或 Desktop。

## 4. 測試與完成標準

- `tests/board-check.test.js`：`tests/fixtures/levelmark.board` 回 `unknown-key`（`owner`）；一塊連線指向不存在節點的板子回 `bad-ref` 並 `ok: false`；`scripts/board.js check --json` 的 exit code。現在會失敗，因為 `checkBoard` 與 `scripts/board.js` 不存在。
- `tests/board-theme.test.js`：帶 `fk:store` 的節點畫出類別的 fill 與圖示；圖例的計數等於板子裡該類別的節點數（產物自我對帳：圖例數字與 `.board` 由同一份資料算出，兩者必須相等）。
- `tests/board-edit.test.js`：session 在 gate 時 POST 一筆改名，檔案改了、`changes.jsonl` 多一行；不在 gate 時 409；會造成 `bad-ref` 的 batch 回 422，檔案不變；nonce 錯誤時 403。
- `tests/resume-board-changes.test.js`：build 目錄有一筆未送出的 `changes.jsonl` 紀錄時，`hooks/resume.js` 寫出的 `<stage>-answer.md` 與 `additionalContext` 都含那一筆，跑完後該紀錄標成已送出；再跑一次就不再附上。現在會失敗，因為 resume.js 不讀 `changes.jsonl`。
- render reviewer 對照 mockup，檢查 gate 頁的 `board`、`legend`、`board-toolbar`、`board-changes`、`board-check` 五個 block。
