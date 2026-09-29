---
status: decision
last_verified: 2026-09-29
---

# TODO 全表盤點（09-29 第三輪）：決策紀錄

一句話：這輪修了五條 Ready：await 的 group 標記、同名 plan 的舊 ledger、gate 答案帶進後面的 brief、`/fankeel` 注入量提醒，以及 design 閘門拿掉「方向／逐塊」。另外實測同名 `.claude/agents` 覆寫檔，並關掉 promo30 v3 解除的條目。

計畫見 [../99-archive/2026-09-29-todo-patrol-3.md](../99-archive/2026-09-29-todo-patrol-3.md)；design 只在 `.fankeel/build/task-20260929T122234/design.md`（gitignored），這份紀錄就是它留下的部分。

## 為什麼

盤點時看到這幾條在實際跑的時候反覆出事：同一題在 gate 被問三、四次；`await.js` 要加 `--agent` 才等得到東西；同日同名 plan 的舊 ledger 讓 `ready` 印 `none`。最後這條本輪開 build 時又重現了一次，plan 因此改名為 `-3`。

## 定了什麼

- `await.js` 會清掉沒有 `kind` 的 group 標記；`markInflight` 取目前最大號再加一，不再重用號碼；不帶 `--agent` 時盯最新的標記。
- `ledger.js init --range`：range 跟紀錄裡的不同時，換成新的 ledger；range 相同或沒給，當作續跑。
- gate 答案經 `answeredOf` 帶進後面各站的 brief，最多 6 行（`ANSWERED_MAX`）。`gate.js` 會拒絕重問已經答過的題；`gateProblem` 會把沒有 `next`（暫停選項）的 gate 判為無效。
- `/fankeel` 時，CLAUDE.md 加 MEMORY.md 超過 4000 tok（`INPUT_WARN_TOKENS`）就多印一行，指向新的 `fankeel-slimmer` agent。門檻是使用者 09-29 定的；當時實測是 4,107 tok，已經超過。
- design：前端任務一律出 mockup，並直接帶逐塊調整；`design.mockup` 的預設與 `when` 規則不變，使用者 09-29 定為「只限前端任務」。build 後的逐塊調整，改成只要這次 task 改了頁面就做。
- 同名覆寫實測：專案的 `.claude/agents/fankeel-reader.md` 蓋不過 `fankeel:fankeel-reader`，只有派不帶前綴的名稱時才生效。紀錄在 `station-6`，條目留在 Ready。

## 沒做的

- await-3 的「17 tasks」計數：找不到算這個數字的程式碼，那一半仍留在 TODO。
- `kind: 'close'` 沒能在實跑中觀察到：安裝版的 hook 早於 b9e7bfc5，所以「插件重裝後實跑」條目保留。
- group brain 寫進別的 session 的 task 資料夾：TODO `brief-1`。
- verify 判定可接受、但沒補測試的兩處：await 的 `o.group` 條件，以及 `inject.js` 傳入 `input` 的那段接線。
- `tests/serve.test.js` 的 detached serve 在整套測試負載下逾時一次，單獨跑 8/8 綠，視為已知的偶發失敗。
