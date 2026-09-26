---
status: current
---

# TODO 四條＋tune live：description 版本與 effort、gate 問法分情境、station 答 gate、station 回放、真實頁面逐塊調 — design

一句話：TODO 四條加使用者 09-24 在 design 關卡追加的第 5 條。第 1、2 條是規則加驗證，第 3 條先探測、成功才做成 profile 設定，第 5 條讓 `tune.js` 能在 JS 渲染的真實頁面上逐塊調，第 4 條照 mockup 的方向重畫回放、再用第 5 條在真 station 上調細節。

依據：[survey 報告](../../.fankeel/build/task-20260924T072540/survey.md)（per-machine，未提交），以及 2026-09-24 design 關卡使用者的四個答案。`## Waiting` 不在範圍內。

## 1. description 帶版本與 effort

- `skills/fankeel/SKILL.md` 的「Open the `description` with the model」一條改成 `<別名> <版本> · <effort>: <標題>`，例：`sonnet 5 · medium: survey stage agent`。
- 版本從 session 環境區塊列出的模型家族讀（本日：Fable 5.1、Opus 5.5、Sonnet 5、Haiku 4.5），不寫死在 agent 檔或程式裡。
- effort：agent 檔的 frontmatter 有 `effort:` 就照寫；沒有就寫 `inherit`（使用者 09-24 選定），不猜數字。Agent 工具本身不能設 effort。
- 對派出去的 Workflow `agent()` 呼叫同樣適用：`label` 以同一格式開頭。
- 關掉 `TODO.md` `## Ready` 的那一條。

## 2. gate 問法分情境

- `skills/fankeel/SKILL.md` 的 gate 章節加三種情境：stage gate 維持三選項（加一個 hand off）；單選且要比對內容的，每個選項帶 `preview`；`multiSelect` 不支援 `preview`，選項 description 寫成單行可比對的內容（路徑、第一句），不寫理由。
- `lib/handoff.js` 的 `gateProblem` 接受 `preview`：必須是非空字串，且只能出現在 `multiSelect` 不為 `true` 的題目；違反時回傳指名欄位的 problem，和現有欄位同樣格式。
- `gateMatches` 把 `preview` 納入比對，站 agent 交回的 gate 帶 `preview` 時，主控照抄也要一字不差。
- 不寫進 `lib/stages.js` 的 `ALWAYS`：不佔每輪注入額度（使用者 09-24 選定）。
- 關掉 `TODO.md` 的〔gate〕問法分情境那一條。

## 3. station 直接答 gate

- build 第一件事是探測：`claude -p --session-id <uuid> --settings <hooks>`，PreToolUse hook 對 `AskUserQuestion` 回 `permissionDecision: allow` 加 `updatedInput.answers`，看提問是否被跳過、模型拿到的是不是那個答案。探測腳本與輸出放在 `.fankeel/build/2026-09-24-todo-four/`。
- 探測成功：`lib/profile.js` 新增 `gate.station`，值 `off` 或等待秒數，預設 `off`；station 的 profile 頁加一張卡（使用者 09-24：station profile 可以設定）。設了秒數時，`hooks/gate.js` 在 gate 發出後等 station 寫的 `<stage>-answer.md` 至多那麼久，拿到就用 `answers` 回填，逾時照常交回 terminal。
- station 頁顯示目前懸著的 gate，並能送出答案，寫成 `lib/handoff.js` `writeAnswer` 已有的格式。
- 探測失敗：不加 key，結果與指令寫進 `docs/90-agent/reference/station.md`，說明遠端作答走 `/remote-control`。
- 兩種結果都關掉 `TODO.md` 的〔station〕答 gate 那一條。

## 4. station 回放呈現

- mockup `.fankeel/build/2026-09-24-todo-four/mockup.html`（opus 產生）核准的是方向，不是逐像素；細節在 build 之後用第 5 節的 live 模式在真 station 上逐塊調（使用者 09-24 選定，取代原本的真資料快照腳本）。
- 照 mockup 的方向重畫 `assets/station/station.js` 的 `replayHtml`：stage、gate 問答、派出的 agent 各成一段並有標記。
- 新畫的每個區塊在產生它的原始碼裡字面寫出 `data-block="<name>"`，名稱沿用 mockup 的：`cost-strip`、`toc`、`filter-bar`、`segment-header`、`gate-pair`、`agent-dispatch`、`tool-collapsed`、`tool-output`。
- 工具呼叫與輸出預設摺疊成一行摘要，可展開。
- 每段旁邊顯示時長與 token 花費，數字來自 `lib/replay.js` 已有的事件欄位。
- 回放頂部有目錄（依段）與依事件種類的篩選。
- 關掉 `TODO.md` 的〔station〕回放呈現那一條。

## 5. 在真實頁面上逐塊調整（tune live 模式）

使用者 09-24：mockup 表示不了真實情況；點一塊、說改什麼的做法要能用在真實畫面上。

- `scripts/tune.js serve <dir> --src <file,...> --rebuild "<cmd>"`：`--src` 給了就是 live 模式。`<dir>` 是 JS 渲染的真實頁面（station 是 `.fankeel/`），overlay 照舊在瀏覽器裡往上找 `data-block`，JS 產生的區塊一樣點得到。
- `wait` 在 live 模式多印 `sources`：在 `--src` 檔案裡 grep 字面的 `data-block="<name>"`，回傳 `file:line`，implementer 從那裡改原始碼，不改頁面的 HTML。
- `done` 在 live 模式的檢查換成：`--src` 以外的檔案沒被動到（取 `wait` 時的快照比對），動到就退回並拒絕，和靜態模式同一個 `rejected` 事件；接著跑 `--rebuild`（station 是 `node scripts/station.js write`），成功才送 `done` 讓頁面重載，失敗照拒絕處理。
- 靜態模式的行為一行不變：沒給 `--src` 就是今天的 `tune.js`。
- `skills/fankeel-design/SKILL.md` 第 3 步寫明兩種走法，design 關卡由使用者選：**方向**——mockup 核准就走，細節交給 render reviewer；**逐塊**——mockup 只定方向，build 寫出真頁面後進 live 模式逐塊調，調完才往 verify。
- `skills/fankeel-build/SKILL.md` 寫明選了逐塊時，前端 task 落地後開 live 模式、迴圈到使用者說好，每則請求一個 implementer（`design.mockup` 的模型）。
- 前提寫進兩份 skill：要調的區塊必須在原始碼裡字面寫出 `data-block="<name>"`，拼接出來的名稱 grep 不到。

## 6. 貼近真頁面：proxy、Alt+click、任意元素、mockup 引用真元件

使用者 09-24 在 build 關卡看了 §5 落地的 7830：只有一頁、元件的互動全不見、只能選大區塊。原因各一：overlay 攔下每個 click（`preventDefault`）；只認 `data-block`，`station.js` 只有 20 個；`tune.js serve .fankeel` 送的是靜態副本，要伺服器的功能都沒有。使用者提的方向：像專案共用的 CSS 元件一樣，引用真的東西。

- `scripts/tune.js serve --proxy <url> --src <files>`：把請求轉給真的伺服器（station 是 `station.js serve`），HTML 回應注入 overlay，其餘原樣轉送。所有頁面、路由、細節載入、答題表單都是真的。`--proxy` 與 `<dir>` 擇一；給 `--proxy` 時 `--rebuild` 可省，因為 `station.js serve` 每次請求都重讀 `assets/station/` 的 css 與 js。
- overlay 改成一般 click 照常給頁面，**Alt+click** 才選取；按住 Alt 時才畫外框。靜態模式同樣適用，拿掉右下角的 live 開關。
- 任何元素都能選，不限 `data-block`：Alt+click 選最內層元素，Alt+滾輪往父層走、面板上列出路徑可點回。請求帶 `selector`（路徑）、`classes`、`text`（前 80 字）、最近的 `block`（沒有就空）。
- `wait` 的 `sources` 改成：先 grep 字面 `data-block="<block>"`，再逐一 grep 元素的 class 名（`class="..."` 或 `'<class>'` 字面出現處）於 `--src` 檔案，依命中數排序回傳 `file:line`，最多 10 筆。
- `done` 的 live 檢查不變：`--src` 以外有改動就退回並拒絕。
- `skills/fankeel-design/SKILL.md` 第 3 步：mockup 必須引用專案自己的樣式與元件——`<link>` 專案真的 CSS 檔（不複製，複製會走鐘），從真頁面渲染出的 DOM 起稿（`node scripts/render.js` 抓），只改要重新設計的部分；新加的東西才寫新樣式。mockup 放在能用相對路徑連到專案 CSS 的地方，或由 `tune.js serve --proxy` 供應。
- `skills/fankeel-build/SKILL.md` 逐塊迴圈改用 `--proxy`，並寫明 Alt+click 與任意元素。

## 驗收

- 第 2 條：`tests/` 新增 `gateProblem` 測試——帶 `preview` 的單選通過、`multiSelect` 帶 `preview` 被拒、`preview` 非字串被拒；現在三個都不會照預期回報，改完才會。
- 第 3 條：探測輸出本身就是證據；成功的話再加 `hooks/gate.js` 讀到答案檔即回填、逾時放行的測試。
- 第 4 條：渲染出來的頁面上，每段標頭的花費加總要等於該 session `burn` 的總和（同一來源兩個數字要對得上）；render reviewer 對照 mockup 拍。
- 第 5 條：`tests/` 新增 live 模式測試——`wait` 回傳 `data-block` 所在的 `file:line`、`done` 在 `--src` 以外有改動時退回並拒絕、`--rebuild` 失敗時拒絕；沒給 `--src` 時既有 tune 測試全綠。
- 第 6 條：`tests/tune.test.js` 新增——`--proxy` 時 HTML 回應帶 overlay、非 HTML 原樣轉送（位元組相同）；`wait` 對只有 class 沒有 `data-block` 的請求回傳 class 命中的 `file:line`；overlay 的單純 click 不被攔（jsdom 或字串斷言 handler 先檢查 `altKey`）。在真 station 上 Alt+click 一個按鈕、送一則改動，頁面重載後只有那個元素變了——使用者親眼確認。
- 全部：整套測試前後都綠，`node scripts/todo-check.js` 綠。

## 對照 map

`.fankeel/map.md` 列的 `hooks/gate.js`、`lib/handoff.js`、`lib/replay.js`、`lib/profile.js` 的描述都不和這份矛盾；第 3 條成功時 map 的 `gate.js` 一行要補「等 station 答案」。沒有把尚未存在的東西寫成已存在。

## 沒驗過的

`updatedInput.answers` 能不能跳過提問——第 3 條整條都押在這個探測上。第 5 條另有一件沒驗：station 頁在 `tune.js serve .fankeel/` 底下能不能正常載入它的資料腳本（今天它由 `station.js serve` 供應）。第 6 條沒驗：`station.js serve` 的即時更新（它的輪詢或 event stream）經過 proxy 是否照常；不行的話 proxy 對那條路徑改成串流轉送。
