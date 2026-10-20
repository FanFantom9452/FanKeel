---
status: decision
last_verified: 2026-10-20
---

# retro 讀整份遮蔽過的 session 包（10-20）

一句話：land 每次都問要不要把這個 session 匯出成一個遮蔽過敏感字的 gzip 包，retro 只在匯出後提供、在 opus 上讀那個包；`/fankeel-retro-all` 讀所有包，只對兩個以上的包都出現的問題提出修改。

依據兩份判決：[retro-full-record](../90-agent/judgements/2026-10-20-retro-full-record.md) 與 [retro-land-vs-skill](../90-agent/judgements/2026-10-20-retro-land-vs-skill.md)（選 A）。設計與計畫在 [99-archive/2026-10-20-retro-bundle-design.md](../99-archive/2026-10-20-retro-bundle-design.md)。

## 決定

- `record.js session` 把主對話、所有 subagent 對話、以及 adopt 來源 session 的對話打成一個 `.jsonl.gz`，工具呼叫與結果都保留，不經過模型。
- 每個字串寫出前先遮蔽：`.fankeel/sensitive.txt` 的字與金鑰、token、私鑰的樣子都換成 `[REDACTED:<kind>]`；敏感字檔存在卻讀不到時，什麼都不寫。
- 包預設放 `.fankeel/bundles/`，不進 git；`--commit` 且 2 MB 以內才放進紀錄目錄跟著 commit。
- land 的 gate 每次都問匯出；retro 只在匯出後提供，讀包、跑在 opus。
- `record.js retro` 把 retro 的回覆原文與處置歸檔在任務紀錄下；`retro --bundle` 讓沒有紀錄的包也能歸檔；`retro --cross` 歸檔跨包報告。
- `/fankeel-retro-all` 對還沒有 retro 的包各派一個 retro，問題要在兩個以上的包有證據才提出修改，最多五段。

## 為什麼

只有 retro 的結論、沒有原始對話，就只能聽那個 agent 一面之詞；別的使用者做完的任務，這邊也拿不到內容。整份對話能還原才能拿來參考。retro 跑在 sonnet 或 haiku 太弱，所以固定 opus。敏感資料改成遮蔽而不是擋下，是因為擋下就沒有紀錄了。

## 放棄了什麼

- 只留 retro 的結論、不留原始對話：判決原本這樣建議，被使用者否決。
- 命中敏感字就整份不匯出：會讓有敏感字的 session 完全沒有紀錄。
- 包一律 commit：長 session 壓縮後仍可到數十 MB，所以預設留在本機。
- 單一 agent 一次讀完全部 session 寫成一份長 MD：一個 context 裝不下，也分不出哪個問題重複出現。
