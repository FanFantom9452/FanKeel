---
status: decision
last_verified: 2026-09-26
---

# TODO Ready 五條：決策紀錄

一句話：09-26 的五條 Ready 走完整條 route，14 個 task 落地了 13 個。audit 可以分批跑，也會提醒兩週沒跑。docs 改成先出搬移表、核可後再搬，fankeel 自己的 docs 已經搬到 audience preset。subagent 之間用 `context.md` 交換資料。design 站可以選 `design.mockup: auto`、多選 `design.skill`，也有了 fankeel 自帶的設計指南。station 換成浮動圖示、只重繪有變動的區塊，網頁答題可以交回終端。wizard-motion 測試改成每次 spawn 各用一個 `--user-data-dir`。Task 14（Trovara 的搬移）留給使用者在那個 repository 自己做。

design 見 [../99-archive/2026-09-26-ready-five-design.md](../99-archive/2026-09-26-ready-five-design.md)，計畫見 [../99-archive/2026-09-26-ready-five.md](../99-archive/2026-09-26-ready-five.md)。

## 定了什麼

- **fankeel 的 docs 用 audience preset**：599 列的搬移表先給使用者看，核可後才 apply。舊的平面路徑已經沒有程式在寫入（`judge.js` 與 `newestPlan` 都從 `docs.json` 查桶），但 `lib/stages.js` 的 artifact 路徑還寫死 `docs/plans/`，這條留在 `TODO.md` 的 Needs a decision。
- **audit 的提醒只報天數**：`--record` 寫 `.fankeel/audit.json`；超過 14 天，`orient` 會說 `audit: N 天未跑`。不用 cron，也不用排程。
- **`context.md` 經腳本**：任何 subagent 都透過 `scripts/context.js` 讀寫，不直接開檔。
- **設計指南由 fankeel 自帶**：`skills/fankeel-design/design-guide.md` 從六個設計 skill 提煉而來；`fankeel-mockup` 先讀它，再載入 prompt 指名的 skill。
- **`design.mockup: auto` 不問就畫**：畫完直接開頁。
- **網頁答題是選用的**：60 秒後建議交回終端或手機，按鈕走 `handoff=terminal`。

## 量到什麼

`context.md` 的 A/B 各跑一次，結果什麼都沒顯示。兩個 arm 都沒有派出 subagent，機制一次也沒觸發過。報告見 [../90-agent/reports/2026-09-26-context-md.md](../90-agent/reports/2026-09-26-context-md.md)。乾淨的那一次花了 $12.82；之前兩次碰撞作廢的執行約花 $5.50，原因是 `ab.sh` 的輸出檔沒帶 session id。

## 回頭的地方

- verify 的 adversary 打掉兩條：`skills/fankeel/SKILL.md` 的 `source_of_truth` 還寫搬移前的路徑（`docs-check` 不驗 frontmatter，所以沒抓到），以及報告漏記那 $5.50。audit 站補齊了，`skills/fankeel-station/SKILL.md` 的同類路徑也一併修正。
- `docs/90-agent/reference/station.md` 有 24 條行號引用，被 Task 9–11 對 `station.js` 的改動推移了；audit 站照 docs-check 報的新行號逐條改好。
- 每兩週一次的深度巡檢（47 組頁面對讀、293 頁分批讀、3 個 code reviewer）這次沒跑，`audit.json` 也沒寫入。沒有這個檔時 `orient` 的 `auditLine` 不會提醒，所以第一次巡檢記在 `TODO.md` 的 Ready，不靠提醒。
