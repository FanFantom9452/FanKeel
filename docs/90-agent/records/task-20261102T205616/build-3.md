結論：verify-2 抓到的缺口已修好並通過 fast suite（6234 pass、0 fail 於 commit c3afd5ec）。

- hooks/guard.js +3/-1 — `emitCommit` 多收 `stop`；warn 模式的判定沒有 `permissionDecision` 時，同一個輸出同時帶 additionalContext 與 ask，block/deny 仍壓掉 ask。
- tests/guard-preanswer.test.js +15 — 新增 warn 模式 `git commit && git push` 仍要 ask 且保留警告的測試。
- skills/fankeel-build/SKILL.md +1 — 審查規則第 3 部分加一條檢查。
- tests/skill-size.test.js +1/-1 — fankeel-build 位元組上限 43100 改 43500（該檔註解規定成長要在此調高；技能多了 391 位元組）。

紅色變異（我自己跑）：把 `emitCommit` 的合併那行停用，guard-preanswer 6 pass、1 fail；還原後 7 pass、0 fail，`git diff --stat` 回到預期。

verify 抓到、build 審查沒抓到的是：當一個分支因為「已經輸出了東西」而讓路（抑制、提早 return、`!emit(...) &&`）時，build 的測試只餵了 block 這一種輸出形狀，沒有餵 warn 這種只有 context、沒有決定的形狀。審查規則已補上：讓路的分支必須對另一邊每一種可能輸出的形狀都有測試，缺一種就是發現。

done: 3 of 3 — 本任務無 ledger，三條缺口（引號刪除、controlled-stage 與 block 排序、warn 排序）皆已修。Task 3 的手動項依先前回答維持開啟。
docs-check: 剩一條 `bare-code`（docs/90-agent/todo/notify-2.md:18），非本範圍所改，未動。
已知限制（非本次修正）：SHELL_WRAPPER 對 eval、ssh、python -c 等仍漏接。
未能檢查：沒有端到端實跑真正的 hook，只有單元測試與變異。使用者已睡，依指示未等答覆，也沒有 push。

reads:
hooks/guard.js — 約 :52-70 與 :144，看 emitCommit 合併 ask 的寫法
tests/guard-preanswer.test.js — :111 起的 warn 測試，確認它餵的是無決定的判定
skills/fankeel-build/SKILL.md — :402 新增的審查檢查句

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : TODO 全表盤點　warn 模式缺口已修且 suite 全綠，進 verify 再驗？","options":[{"label":"Go to Verify (Recommended)","description":"fast suite 6234 pass、0 fail 於 commit c3afd5ec；紅色變異已確認新測試會轉紅。進 verify 重驗 warn 排序那一條，其餘兩條已在上一輪 verify 通過。"},{"label":"Stay in Build","description":"若要先補端到端實跑 hook，或擴充 SHELL_WRAPPER（eval、ssh、python -c）再驗；後者目前記為已知限制。"},{"label":"暫停","description":"先停在這裡，改動已提交、suite 為綠，之後再繼續。"}]}],"next":"進 verify 重驗 warn 模式排序，通過後 land"}
```
