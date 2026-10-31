---
status: decision
last_verified: 2026-10-31
---

# 關卡問題的 header 改寫成這一站→下一站（10-31）

一句話：關卡問題的 `header` 不再只寫剛完成的站名，例如 `Survey`，改寫成問題本身的轉場，例如 `Survey→Plan`；超過 12 欄時只寫目的地，例如 `→Design`。

計畫在 [99-archive/2026-10-31-gate-header-move.md](../99-archive/2026-10-31-gate-header-move.md)。

## 決定

- `lib/handoff.js` 新增 `gateHeader(from, to)`，`formatProblem` 從問題開頭的 `This -> Next` 推出應有的 header，單寫站名的舊格式一律退回。
- 寬度照舊用 `width()` 量，`→` 算一欄。`Survey→Design`、`Verify→Design`、`Design→Survey` 這三種是 13 欄，改寫成 `→Design`、`→Survey`。
- stage 規則（`ALWAYS[0]`）、stage agent 的 brief、fankeel 與 land 的 skill、brain agent 都改用同一個說法。`ALWAYS[0]` 變長以後，audit、verify、design、land 四站的規則超過字數上限，所以縮短了這四站的措辭，每站預算維持 2450。

## 為什麼

Claude 桌面版的側欄會在「Waiting」旁顯示等待中問題的 header。原本只寫 `Survey`，和問題本身的 `Survey -> Plan` 對不起來，看側欄時看不出這個 session 卡在哪一步。

## 放棄了什麼

- 把上限放寬到 13 欄：實測時 13 欄的 header 工具也收，但使用者選了只留目的地。
- 一律用縮寫，例如 `Surv→Desg`：寬度一定放得下，但不好讀。
- 舊格式和新格式並存：gate-19 定過「只留一種格式」，所以舊的直接退回。
