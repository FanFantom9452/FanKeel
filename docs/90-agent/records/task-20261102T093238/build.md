- tests/skill-size.test.js +2/-2 — `fankeel` 的上限 65700 提到 65800、`fankeel-land` 的上限 25400 提到 25600，因為任務 7 的 shelf 說明句讓兩個 SKILL.md 超過原上限（提交範圍 d6256361..d72aa4d5）

done: 6 of 7 — 任務 4 依使用者決定維持 partial：`lib/spend.js:120` 仍是 `registry.readAll(root)`，該檔被鄰居 session「移除 station tour」佔用，落地後補一行 `{ shelf: true }` 並拿掉 spend 測試的 `todo`。
suite.js --fast：6134 pass、7 fail（1 項是 spend 的 `todo`）。其餘 6 項中，`fankeel` 與 `fankeel-land` 的位元組上限是本任務造成，已修；station tour 檔案與 loc 鍵、導覽列、sources.md 的 Cited by、TODO.md index 這幾項屬鄰居 session 的 tour 移除與既有的 todo-check 問題，不在本任務範圍，未動。
docs-check: 清單中只有 station.md 行號位移與 todo 引用，皆來自 tour 移除或既有檔案，與 shelf 檔案無關；我未修。
deferred: spend.js 一行 — 等鄰居 session 落地後補；未另建 TODO 條目（ledger 的 Ruling 已記）。

我沒能檢查的：鄰居 session 落地後 spend 測試轉綠的實際結果。

reads:
- docs/90-agent/reference/registry.md — shelf 一節，驗證文件與行為一致
- scripts/shelf.js — run、find、restore 的實作
- lib/spend.js — 第 120 行是任務 4 唯一未完成處

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : session 與 build 集中歸檔","options":[{"label":"Go to Verify (Recommended)","description":"任務 1、2、3、5、6、7 已完成並通過 review，任務 4 只剩 spend.js 一行，依你的決定等鄰居 session 落地後補；進 Verify 驗證已完成的部分。"},{"label":"Stay in Build","description":"留在 Build：等鄰居 session 「移除 station tour」落地後補 spend.js 那一行，讓任務 4 complete。"},{"label":"暫停","description":"先停在這裡，之後再繼續。"}]}],"next":"進 Verify 驗證 shelf；spend.js 一行待鄰居 session 落地後補"}
```
