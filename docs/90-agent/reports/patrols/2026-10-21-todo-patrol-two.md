---
status: decision
last_verified: 2026-10-21
---

# TODO 全表盤點（10-21 第二次）：五條結案，兩題交判官

一句話：36 條全部給了處置，land 結案順序與 await 印 gate 兩題交判官裁決後照做，加上 brain 的 gate 自查，共五條結案、兩條新開。

任務紀錄在 [2026-10 月紀錄](../../records/2026-10.md#r-2026-10-21-739fa960)。計畫封存在 `docs/99-archive/2026-10-21-patrol-four.md`，兩份判決在 `docs/90-agent/judgements/2026-10-21-land-close-order.md` 與 `docs/90-agent/judgements/2026-10-21-await-gate-crlf.md`。

## 做了什麼

- 「land 規則先紀錄後結案」與「land 先寫紀錄再結案」結案：land 規則改成 `record.js write` 印出 `filed:` 後才結案，照標題點名條目，結案行引用紀錄（e0bcfdbc、4dfba742）。
- 「brain 的 gate 不寫裸 id」與「brain 交接前先過 gate-check」結案：brain 寫 gate 時整份只用條目標題，交接前先自查（7881da1f）；gate-write hook 帶專案的 TODO id 清單把關（2176d702）。
- 「await 印出去掉 CRLF 的 gate」結案：await 印出 `questions:` 一行，只含 questions，因為 gate hook 只比對這一段（26be3ca0、18f64a2d）。
- 引用行號跟著改：enforcement、registry、subagents、pipeline 與 survey skill（06a3af69、4fcdcc04）。

## 沒做什麼

- verify 找到兩個缺口沒修，記成新條目：「提問時也查 gate 選項數」（gate hook 在受控階段不擋只有兩個選項的 gate），「await 不默默略過 questions」（交接檔還沒寫 gate 就回報時，questions 行默默不印）。
- verify 沒有派對抗審查。
- 其餘 Blocked 與 Watch 條目等的條件都還沒發生，照舊。
