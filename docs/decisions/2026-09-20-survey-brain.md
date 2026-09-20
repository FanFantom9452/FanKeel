---
status: decision
last_verified: 2026-09-20
---

# survey 交給 Opus 大腦 — 決策紀錄

[2026-09-19-station-live.md](2026-09-19-station-live.md) 把原本的請求切成兩半，
這是第二半的第一刀：一站交給站 agent，主控只派工，交接走檔案。分支
`stage-agents`，路線七站全走，52 個 commit。
設計見 [../archive/2026-09-19-survey-brain-design.md](../archive/2026-09-19-survey-brain-design.md)，
計畫見 [../archive/2026-09-19-survey-brain.md](../archive/2026-09-19-survey-brain.md)，
量測見 [../reports/2026-09-20-survey-brain-ab.md](../reports/2026-09-20-survey-brain-ab.md)。
其餘各站要不要跟進，仍在 [../plans/2026-09-19-stage-agents-design.md](../plans/2026-09-19-stage-agents-design.md)，
`TODO.md` 的 `## Needs a decision` 有一條。

## 一、定案

| 問題 | 定案 | 為什麼 |
|---|---|---|
| 新舊模式怎麼並存 | profile 的 `stage.agents`，預設 `false`；`controlling(stage, values)` 決定某一站是否換成主控區塊 | 這是一次實驗，不是取代。預設關著，量測不佳就不必回滾任何東西 |
| 主控與站 agent 怎麼分工 | Opus 站 agent 在站尾決定下一步——route、派工、關卡選項都由它寫進交接檔；Sonnet 主控只照檔案執行 | 判斷留在讀了整站的那一邊。主控若要自己決定，就得把站的內容也讀進來，那正是這件事要省掉的 |
| 交接怎麼傳 | 走檔案**路徑**，不走內容：`.fankeel/build/task-<started>/<stage>.md`，結尾是一個 ```json gate``` 區塊 | 貼內容等於把整站塞回主控的 context，派工要省的就是這個 |
| 關卡怎麼留在主 session | `hooks/gate.js` 用 `PreToolUse` 的 `updatedInput`，把主控送出的佔位 `AskUserQuestion` 換成交接檔裡那一題；`hooks/resume.js` 把答案寫回檔案 | Task 1 先探測才敢設計：`GATE_DECISION` 回 `none` 時題目確實被換掉，而使用者仍然自己選。探測結果是設計的前提，不是事後補證 |
| 大腦憑什麼能寫檔 | `fankeel-brain` 是第三個帶 `Write` 的 agent，只為一個檔案——它自己的交接檔 | [fankeel-shell.md](fankeel-shell.md) 的「subagent 永遠沒有 registry entry」仍然成立：沒有 entry 就沒有認領，所以它寫的路徑不會跟父 session 搶。例外寫在 `tests/agents.test.js` 的 `MAY_WRITE`，每一個都附理由，而不是把斷言拿掉 |
| 站的規則怎麼到大腦手上 | 透過 `renderBrief`，不是靠 skill | **subagent 不繼承 skill。**五個既有 agent 檔都沒設 `skills:`，也都沒有 `Skill` 工具。agent 檔的 `skills:` 可以預載全文，但這次沒用它：brief 是動態的，skill 是靜態的 |
| 臨時要問一個判斷時 | 沿用 `fankeel-judge` 的形狀 | 已經有一個一問一答、讀完就丟的 agent，不需要第二種 |
| build 要派一整組時 | workflow 由 script 產生，主控只拿到 `scriptPath` | 背景 subagent 沒有 `Workflow` 工具，所以產生器必須留在主控這邊 |

## 二、落在哪

| task | 落在 |
|---|---|
| 1 | `updatedInput` 探測——沒有程式，結論進設計：題目換得掉，使用者仍自己選 |
| 2 | `lib/profile.js` 的 `stage.agents`；`lib/handoff.js`（交接目錄由 `started` 推出，改名與 adopt 都留得住） |
| 3 | `lib/stages.js` 的 `controlFor`、`lib/render.js` 的 `rulesLines`、`hooks/brief.js` 與 `hooks/resume.js` 的 root |
| 4 | `hooks/gate.js` 換題目、`hooks/resume.js` 寫回答、`scripts/task.js` 的 `next --from-gate` |
| 5 | `agents/fankeel-brain.md` 與 `.claude-plugin/plugin.json` |
| 6 | `skills/fankeel/SKILL.md`、`skills/fankeel-survey/SKILL.md`、`docs/subagents.md` 新一節與「六個 agent」、`docs/pipeline.md`、`docs/README.md`、`README.md`、`TODO.md` |
| 7 | `docs/reports/2026-09-20-survey-brain-ab.md` 與 `docs/reports/evidence/2026-09-20-survey-brain-ab/` 底下七批量測 |

## 三、量到什麼

七批 A/B，最後一批組內比較：花費 **1.05×、0.97×**（打平），時間 **1.4–1.6 倍**，
主控 context 仍多 8k。數字全部出自證據檔，不是估的。

**為什麼打平而不是變便宜**：主控並沒有變短，它照樣跑完整站，只是換成便宜的模型；
然後又多付一整個 Opus 大腦的 context。報告第 8 節量到大腦的 output 只佔它自己花費的
26–31%，其餘是「多開一個 context」的固定成本。要真的變便宜，得讓其中一邊真的縮短，
而不是換模型。這條仍開著，在 `TODO.md` 的 `## Needs a decision`。

## 四、build、verify、audit 抓到的

- **Task 7 的互動實跑揭出入口缺口**：`start` 與 `task` 沒有印主控規則，最後一站的選項一不是 `down`。headless 四臂量不出來，只有真的走一次才會撞到
- **verify**：`README.md` 的注入場合漏了 `task.js task`；`docs/reports/evidence/` 副本的 `require` 路徑；索引不該期待 `fixture` 角色（連帶補了 `.fankeel/docs.json` 的 bucket 與三個測試）
- **verify 的引用漂移**：`docs/documents.md` 一條寫成 `path:行-行` 的引用歪了四個 commit 沒人發現——範圍式引用不帶引文，`docs-check` 只列不驗。改成單行加引文，並用一次對照證明 `docs-check` 抓得到。剩下的範圍式引用記進 `TODO.md`
- **verify 的 adversary**：一格「grep 回 9 行」是轉抄的，實跑是 11 行。結論不變，數字改正
- **audit**：43 對文件互相對照全部無歧異；讀出 `conflict()` 有四個 predicate 而三頁只算到兩三個，`read` 一頁都沒提。不屬於這條分支，記進 `TODO.md`
- **audit 的 adversary 打掉四條我自己的**：其中一條是我用了 `| head -40` 而輸出剛好 40 行，把截斷讀成「沒有」——這個陷阱我自己記過還是踩了

## 五、沒驗到的

- 主控 context 少掉的那一段有沒有換成更難用的東西，只有量，沒有讀
- 大腦寫的交接檔守字數上限那一行沒生效，ab7 量過，仍未修
- audit 的 adversary 只能確認**現在**的樹沒被動過，不能確認四個 reader 跑的每一刻
- 三個 cuts lens 有兩個申報了未覆蓋的檔案範圍，所以 `net:` 不是全樹的總數
