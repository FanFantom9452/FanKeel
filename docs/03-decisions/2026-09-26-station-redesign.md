---
status: decision
last_verified: 2026-09-26
---

# Needs-a-decision 全清與 station 改版：決策紀錄

一句話：`TODO.md` 的六條 Needs-a-decision 定了五條，一條（拆站專屬 agent）移到 `## Waiting`，等 verify 的 k 重跑再定；design 站多了專屬的 `fankeel-mockup` agent；station 可以直接看到並回答卡著的問題，tune 改完會跳通知並自動刷新；設定精靈改成卡片。

design 見 [../archive/2026-09-26-station-redesign-design.md](../99-archive/2026-09-26-station-redesign-design.md)，計畫見 [../archive/2026-09-26-station-redesign.md](../99-archive/2026-09-26-station-redesign.md)。

## 定了什麼

- **只拆 mockup**：`agents/fankeel-mockup.md` 固定用 opus、effort high，畫 mockup 前先載入 prompt 指名的設計 skill；逐塊調整時只改指定的那一個 `data-block`。其他站先不拆。
- **effort 分角色**：每個 agent 檔的 frontmatter 各自帶 `effort:`（judge 用 xhigh、mockup 用 high、fixer 用 low，其餘用 medium）；`task.js start`／`stage` 會印出建議主 session 用的 effort。從不建議 max，因為它有時會過度推理。
- **docs tree 兩軸**：bucket 可以帶 `audience: human|agent`，目錄加編號；沒有 `docs.json` 的專案，survey 才問一次要不要照建議建立。docs-check 仍然只依角色檢查，不看 audience。
- **ADR = binding 子集**：`binding: true` 同時最多七條（`BINDING_CAP`），由 `map.md` 列出，不注入到每輪 prompt。
- **station 答題**：卡著的問題在 station 上可以直接回答，有 Other 輸入框；只答一部分會被回 400；`gate.station` 設成 300。
- **模型花費依版本分**：`modelKey` 分到 `<family>-<major>[-<minor>]`，Opus 5 和 Opus 5.5 各自一條。

## 走回頭或改過的

- Task 13 在真頁面上逐塊調整（r-0019 到 r-0025），調了七輪。派工面板改成預設顯示圖表後，執行中那一列的標記不見了，`station-live-page` 測試因此每次都失敗；修法是在圖表上方列出執行中的 agent。
- 調整用的 agent 不能用 Playwright MCP：它會在 repo 根目錄寫出 `.playwright-mcp/`，tune 會把這當成 `--src` 以外的改動退回。改用 headless Edge，截圖存到 `.fankeel/build/` 底下。
- 前端後續（`design.mockup: auto`、浮動圖示通知、局部重繪、萃取設計 skill 精華、`design.skill` 多選）合併成 `TODO.md` 的一條 Ready，留給下一輪前端 design。

## 沒收掉的

- `tests/station-wizard-motion.test.js` 在完整測試下偶爾會失敗，單獨跑都會過；`tests/station-cli.test.js` 也偶發過一次。原因還沒查。
