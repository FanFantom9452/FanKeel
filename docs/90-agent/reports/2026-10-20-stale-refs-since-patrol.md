---
status: decision
last_verified: 2026-10-20
---

# 舊引用、escape-scan --since 接時間、盤點不誤標已落地條目

一句話：三個小修都已落地，docs-check 乾淨，`--since` 能切到時間點，盤點規則多一句「內文說已落地、只剩重量的條目標等待，不標馬上做」。

計畫在 [2026-10-20-stale-refs-since-patrol.md](../../99-archive/2026-10-20-stale-refs-since-patrol.md)，任務紀錄在 [2026-10 月紀錄](../records/2026-10.md#r-2026-10-19-f3f1ecbc-2)。

## 做了什麼

- 三筆失效引用改好：brain agent 檔的舉例路徑換成真的檔，另外兩處行號跟上 `lib/stages.js`（a415882b）；`tests/brief.test.js` 跟著改（a6b199f8）。
- `scripts/escape-scan.js` 的 `--since` 收帶 `Z` 或時差的 ISO 時間，沒帶時區的拒絕（8f01f30a）。
- `skills/fankeel-survey/SKILL.md` 的 Ready 規則讀條目內文到最後一段有日期的紀錄；survey skill 的位元組上限從 23500 調到 23700（55d70690）。

## 沒做什麼

- 盤點規則只改文字，沒有在條目加欄位讓腳本機械判斷；下次盤點才看得出模型會不會照做。
- 「工具參數中文寫成轉義」第 40 行「`--since` 只收日期」是當天紀錄，保留不改。
- verify 沒派對手 agent，也沒跑 @slow；land 的完整套件 4876 通過。
