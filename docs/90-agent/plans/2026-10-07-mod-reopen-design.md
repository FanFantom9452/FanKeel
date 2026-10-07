---
status: design-intent
last_verified: 2026-10-07
---

# 重開 mod 路線：排序、取代兩份擱置決策、拆 await-title（設計）

一句話：寫一份新的決策紀錄，以「使用者接受每個 session 在 `/plugin` 按一次 Enable for this session」為前提，取代 2026-10-03 的 mod 路線擱置決策與 2026-10-05 的 gate 面板否決，並把五項只有 mod 做得到的能力排成先後；這個 task 本身只交付決策、拆掉已證明失敗的 await-title，以及把後面三項開成各自的 TODO 條目，不實作它們。

為什麼範圍只到這裡：使用者選的選項是「開一個 task 排序五項能力、寫決策紀錄取代 10-03 的擱置、第一批含拆 await-title」。排序與決策是這次的產出；每一項能力各有自己的未知數（例如 `session.append` 對執行中子代理沒測過），硬塞進同一個 task 會讓 verify 無從判定。

## 1. 新決策紀錄

- 新增 `docs/03-decisions/2026-10-07-mod-reopen.md`，`status: decision`，一句話結論在最前：fankeel 重開 mod 路線，mod 只做 command hook 做不到的事，command hook 照舊是底層。
- 「為什麼」逐條回應 10-03 的三個理由：子代理拿不到 `prompt.compose` 這一條不再擋路，因為 `agent.spawn` 改寫的 prompt 已量到成為子代理 transcript 第 1 行（`docs/90-agent/reports/2026-10-03-mod-probe-3.md:14`）；rollout 旗標這一條降為接受的風險；要改設定這一條由使用者接受每 session 按一次 Enable 化解。
- 「定了什麼」寫下五項的排序與每一項的理由，次序見第 3 節。
- 「定了什麼」寫下一條共通規則：每個 mod 都要在沒載入時無害——旗標關、沒按 Enable、或 hook 拋錯被略過時（d.ts 3908 起：拋錯或逾時的 hook 會被略過），fankeel 照 command hook 的行為跑，不丟工作。
- 「沒做的」寫下重新評估的時機：旗標被撤、Enable 在手機或 Remote Control 上按不到、或 `agent.spawn` 改寫在互動式 n>1 下不穩定。

## 2. 取代兩份舊決策

- `docs/03-decisions/2026-10-03-mod-route.md` 前置資料加 `superseded_by:` 指向新決策，照 `docs/03-decisions/2026-09-19-waiting-triggers.md:4` 的寫法；本文不改，因為決策紀錄記的是當時的判斷。
- `docs/03-decisions/2026-10-05-inject-gate-mod.md` 同樣加 `superseded_by:`。它否決「終端或 Desktop 的 gate 報告面板」的理由是 command hook 畫不了介面，而 mod 的 Pane 在每個介面都能開（d.ts 10236），所以這一條一併被取代；它否決函式 hook 注入的那一條，新決策要寫明仍維持（注入繼續用 `hooks/inject.js`），免得被讀成一起推翻。

## 3. 五項的排序

- 第一：拆 await-title。已證實不成立（`docs/90-agent/todo/title-3.md:16`：host 拒絕從 `tool.call` 呼叫 `command.run`，`turn.complete` 又要等使用者答完），留著只會每次 gate 白試三次。這個 task 內做完，見第 4 節。
- 第二：自動 compact 與改寫每次 compaction 的指示。已落地（`hooks/compact.ts`）、互動式實測壓縮成功，缺的是判準改成認 `manual` 加同時間的 `fankeel compact` log 行，以及指南與 README 的兩處文字；這些已在既有條目 compact-2 裡，不另開條目。
- 第三：子代理完整 brief，由 `agent.spawn` 改寫 prompt 取代 `hooks/brief.js` 的一部分。價值最高，但互動式 n>1 沒量過、`session.append` 對執行中子代理沒測過，所以條目的第一步是探測，不是搬遷。
- 第四：每個子代理的 effort 由 `turn.step` 依 agentId 改寫。依賴第三項建立的 agentId 與 Dispatch 行的對應，所以排在它後面。
- 第五：Pane 上的 gate 介面。範圍最大、與其他項不相依，放最後；做它的時候要先讀過 station 頁已有的 gate 面板，避免兩套。

## 4. 拆 await-title

- 刪除 `hooks/await-title.ts` 與 `tests/await-title.test.js`。
- `hooks/mod.ts` 拿掉 `import { register as awaitTitle }` 與 `awaitTitle(on)`，只留 compact。
- `tests/mod.test.js:9` 的測試改成斷言 register 只接上 compact 的 hook（只註冊 `turn.complete`，沒有 `tool.call`）；這是會先紅後綠的那一條。
- `tests/inventory.test.js:73` 的註解拿掉 await-title.ts。
- 完成後 `git grep -n "await-title\|awaitTitle" -- hooks tests` 沒有輸出。

## 5. TODO 條目

- 第三、四、五項各開一個 TODO 條目（用 `scripts/todo.js`），各自寫明來源是新決策、第一步、完成條件；第三項的第一步是互動式 n>1 的 `agent.spawn` 與 `session.append` 探測。
- title-3 在 await-title 拆完、全套測試綠之後關閉。`todo.js done` 從子代理會被分類器拒絕，所以這一步由使用者以 `!` 執行。

## 判定完成

- `tests/mod.test.js` 新斷言「只有 compact」：現在因為 await-title 註冊了 `tool.call` 而失敗，拆完後通過；全套 `node --test` 綠。
- 產出物一列：兩份舊決策的 `superseded_by` 都指到同一個存在的檔案，而新決策的排序列出的條目名稱，和 `docs/90-agent/todo/` 裡實際新開的條目一一對得上（`node scripts/todo-check.js` 與 docs-check 都過）。

## 對照 map

`.fankeel/map.md` 沒有把這兩份決策以外的任何現行頁面寫成與 mod 相衝；第 120–123 行列的 mod 探測與 compact-mod 計畫是過去的計畫，不受影響。`docs/01-guide/profile.md` 那句「Claude 沒有 context 回收機制」與 mod 的 compact 相衝，但它屬於 compact-2 的工作，這個 task 不碰。
