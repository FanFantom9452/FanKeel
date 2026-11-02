node scripts/docs-check.js
  12 references that no longer resolve — 全部來自鄰居 tour 移除（tour-keel.js、tour-record.js、station.md 行數）或早就存在的頁面（rationale.md、improvement-brief.md、model-3、notify-2、survey SKILL.md:309）；沒有一條指向 shelf 的檔案。

node scripts/residue.js
  6 undecided paths（.claude/、.fankeel/tmp/、.playwright-mcp/、鄰居的 pstack 判決兩檔與 remove-tour plan）；1 個已合併但還有東西的 worktree agent-ac92340102f84920b；.fankeel/build 662M、.claude/worktrees 193M。

knip · deptry：都沒裝。
docs-audit.js：兩週一次的深度檢查這次沒跑；它列出 28 份參考文件落後程式碼，大多跟這次無關。

- docs/02-architecture/layout.md:121 — registry.js 說成「one entry per session under .fankeel/sessions/」，現在 readAll 可以讀架子、adopt 會從架子搬回
- docs/90-agent/reference/registry.md:364-366 — 「registry 保留 workspace 跑過的每一個任務」，現在本地只剩 live 與近期條目，其餘在架子上；要補一句並連到「架子」一節
- scripts/render.js:263 — 註解說「on the 22.5 floor」，engines 已是 >=22.13
- scripts/residue.js:66 — 註解說「package.json's engine floor (Node 22.5)」，同上
- .fankeel/map.md:61 — 由 map.js 產生，layout.md 修好後重跑就會改
- docs/03-decisions/2026-10-20-task-boards-as-svg.md:15 — 寫「Node 下限維持 >=22.5」；這是有日期的決策紀錄，保留不改

adversary: 上面 5 句過時的說法；cuts：沒有（lean）
clean: lib/shelf.js、scripts/shelf.js、readAll 的註解、skills/fankeel/SKILL.md 不變式 4、land 技能頁的 shelf 一行

```json gate
{"questions":[{"header":"Audit→Land","question":"Audit -> Land | fankeel : session 與 build 集中歸檔","options":[{"label":"Go to Land (Recommended)","description":"在 land 修掉 4 句過時的說法（layout.md:121、registry.md:364、render.js 和 residue.js 的 22.5 註解）並重跑 map.js；決策紀錄保留；版本升 minor，完整 suite 只認鄰居的紅。"},{"label":"Stay in Audit","description":"沒有還開著的決定：shelf 的程式沒有可刪的地方，docs-check 與 residue 的條目都屬鄰居或既有問題。"},{"label":"暫停","description":"先停在 audit；next 設為「audit 完成，待 land：4 句過時說法」。"}],"multiSelect":false}],"next":"audit 完成，待 land：4 句過時說法"}
```
