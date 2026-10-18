# Survey：station 下一張 gate 頁、plan tab 引用收尾、TODO 全表盤點

fankeel map — 976 markdown files, 3 planned, not built, 322 retired, 23 undeclared
fankeel survey — 2760 files, matching: gate page, station（source: git；skipped: 1528 with no pattern for their extension；excluded: 322 archive、62 decision、140 report）

結論先說：三件事都有可動手的內容。(1) gate-10 的觸發條件「使用者開下一刀 gate 頁任務」正好就是這次，所以它從 Watch 升為 do now，剩 survey、design、build、land 四道 gate 沒有頁。(2) 引用收尾查出兩處真的偏掉：`docs/90-agent/reference/station.md:774` 寫 `navHtml` 在 `assets/station/station.js:1650`，實際在 `assets/station/station.js:1654`；`docs/01-guide/development.md:271` 寫 `badge.clearBadge` 在 `scripts/task.js:159`，實際在 `scripts/task.js:160`。docs-check 說「Every reference resolves」，但它對 21 處沒附引文的行號不檢查，這兩處就是漏網的。(3) 23 條裡沒有任何一條 Blocked 的條件滿足，其餘 Watch 都沒到事件。

- assets/station/station.js:1654 — `function navHtml`，station.md:774 還寫 1650
- scripts/task.js:160 — `badge.clearBadge(dir, sessionId);`，development.md:271 還寫 159
- scripts/await.js:165 — plan gate 頁只在 plan handoff 底下印 `page:` 行，其他四道 gate 尚無
- lib/stages.js:677 — `PAGE_RULE` 寫明 Plan only，擴到其他 gate 要改這條與 await.js
- docs/90-agent/todo/gate-10.md:1 — 兩件沒驗：pane 在 AskUserQuestion 前或後出現；station body min-width 1000px 讓約 800px 的 pane 要左右捲
- 其餘 docs-check 列的 19 處無引文行號，抽查 lib/usage.js:630、plugin.json:31、map.js:39、stages.js:725、task.js:713、inject.js:76、guard.js:136 都仍指到對的東西；lib/detail.js:756 與 :809 也對

planned, not built: bench/add-feature/src/docs/plans/2026-01-01-truncate-design.md、bench/add-feature/src/docs/plans/2026-01-01-truncate.md、docs/90-agent/reference/improvement-brief.md
not found: 無（兩個詞都有命中）
unknown: pane 在 AskUserQuestion 前或後出現、800px pane 是否要橫捲（gate-10 自己列為沒驗）；model-4 的上游官方頁這次沒重讀（本 stage 沒有網路工具）
skipped: 1528 個檔案沒有對應語言的宣告模式，只算檔名，不再打開；沒派 reader，全部自己讀
class: architectural — 新增四張 gate 頁會改 await.js 與 stage 規則這個別處依賴的介面，且路由本來就是七階段
route: unchanged（survey → design → plan → build → verify → audit → land）

## 盤點（patrol）

entries: 23 listed, 23 in TODO

### Ready／Needs a decision
兩區皆為 0 條。

### Blocked
- audit-1 — 讀 todo 檔，條件要「其餘功能落地且換到新機器」，本機查不到新機器：waiting on 新機器與功能全數落地
- build-1 — `npm view knip version` 仍是 6.41.0，與 10-10、10-14 同一版：waiting on knip 新版
- docs-1 — 使用者說另一個專案先做流程圖，本機沒有該專案成果：waiting on 另一個專案的流程圖
- foreign-1 — 四個專案有 .fankeel，但最近 commit 是 KilnPC 10-09、EMU3000_Web 09-01、claude-kit 08-22、PaperResearcher 非 git，沒有一個跑滿一週：waiting on 一個非 fankeel 專案跑滿一週
- model-4 — 上一次重讀官方是 10-16，這次沒有網路工具重查：waiting on 上游讓 Sonnet 支援 fast（未重驗）
- quota-1 — `~/.claude/tokenbar-usage.jsonl` 共 29 行，最後修改 10-12，seven_day_pct 全是 null，沒有跨 7d reset 的讀數：waiting on TokenBar 寫出真實序列
- security-1 — `F:/ymlab/sec-test` 最後 commit 是 2026-09-02，沒有新進展：waiting on AI CODING SECURITY 定案
- spend-2 — 同一份 tokenbar-usage.jsonl 沒有 10 點以上的真實 7 天視窗：waiting on TokenBar 累積資料

### Watch
- design-2 — 事件是「下一個前端任務出現」，這次是 station 前端頁但屬 mockup 以外的 design class 其餘部分尚未觸及，stamp 09-26 才 22 天：keep
- entry-1 — 沒有第二個 host 的使用者或 issue：keep
- explain-2 — 沒有發版或對外展示需要影片：keep
- flaky-1 — 沒有新的整套紅燈紀錄：keep
- flaky-3 — 沒有新的整套紅燈紀錄：keep
- flaky-4 — 沒有新的整套紅燈紀錄：keep
- flaky-5 — 沒有新的整套紅燈紀錄：keep
- gate-10 — 觸發條件是使用者開下一刀 gate 頁任務，使用者這次選了：do now
- model-3 — 沒有受控 task 的 brain 來回次數或缺陷明顯偏高的紀錄：keep
- render-2 — sonnet 渲染審查花費未成為瓶頸，也沒有離線需求：keep
- stage-agents-10 — 本 session 尚未遇到 no verdict：keep
- survey-1 — 這次掃描沒遇到需要第十一種語言的專案：keep
- survey-2 — 沒有程式碼大到 grep 找不到跨檔關係的專案：keep
- test-1 — 本輪沒跑整套測試，沒有新紅燈：keep
- test-8 — 沒有 VirtualAlloc failed 等特徵再出現：keep

### 分組
- do now：gate-10（再加上兩處引用修正，不屬於任何 todo 條目）
- needs the user：無
- waiting on：audit-1、build-1、docs-1、foreign-1、model-4、quota-1、security-1、spend-2
- 沒有任何 Watch 條目的 stamp 滿 60 天，所以沒有要問「保不保留」的

reads:
docs/90-agent/todo/gate-10.md — 四道 gate 頁的範圍、兩件沒驗的事
scripts/await.js — `page:` 行目前只對 plan handoff 印出（第 165 行）
lib/stages.js — `PAGE_RULE`（第 677 行）要擴到其他 gate
docs/90-agent/reference/station.md — plan 頁的做法與要修的第 774 行引用
assets/station/station.js — plan 頁路由與 navHtml（第 1654 行）
docs/01-guide/development.md — 要修的第 271 行引用

```json gate
{
  "questions": [
    {
      "header": "下一階段",
      "question": "三件事盤點完了，要怎麼往下走？",
      "options": [
        {
          "label": "design (Recommended)",
          "description": "接受 architectural 分類與七階段路由。design 先決定四道 gate 頁的範圍與順序，並驗 pane 先後與 800px 橫捲。兩處引用修正也併進後續 plan。"
        },
        {
          "label": "只修引用，gate 頁之後",
          "description": "只做 station.md:774 改 1654 與 development.md:271 改 160，不開 gate 頁。選這個要把路由降級，需另行說明。"
        },
        {
          "label": "先做一道 gate 頁",
          "description": "只挑其中一道先做，其餘留在「其他四道 gate 附 station 頁」這條 TODO。範圍小，但 design 仍要決定挑哪一道。"
        },
        {
          "label": "暫停",
          "description": "停在 survey，不進 design；兩處引用偏移與「其他四道 gate 附 station 頁」轉為 do now 的結論都留在這份報告裡。"
        }
      ]
    }
  ],
  "next": "design：定 survey／design／build／land 四張 gate 頁的範圍，並併入兩處引用修正"
}
```
