# survey — which code reads the registry's `started`, and what each reader does with it

```
fankeel map — F:\ymlab\fankeel\.fankeel\map.md

  229 markdown files, 7 planned, not built, 110 retired, 9 undeclared

Read it before designing anything. It is regenerated, so it cannot be stale;
if it is wrong, the project's own documents are what is wrong.
```

```
fankeel survey — 495 files, matching: started, startedat
source: git
skipped: 1 over the size cap, 106 with no pattern for their extension

declarations:
  lib/guard.js:84  const startedAt = (data) => {
  tests/inject.test.js:558  function stopStarted(cfg) {
  tests/task.test.js:70  const started = (dir, id, task, project) =>

documentation:
  docs/archive/2026-08-25-init-scan-residue.md:1280  # Zero is a legal step and means all hollow: a plugin that has started and not yet
  docs/archive/2026-09-05-anchor-remaining.md:252  ### 0. It already said it started
  skills/fankeel-survey/SKILL.md:42  ### 0. It already said it started
```

The scanner reports declarations; `started` is a data key, so the scan is a
near-miss by design and the answer came from five `fankeel-reader` dispatches
(sonnet — the profile declares no `dispatch.floor`) plus my own grep of
`lib/ hooks/ scripts/`. Every line below was opened here.

**Written — two places, both `scripts/task.js`**

- scripts/task.js:271 — `const now = () => new Date().toISOString();` — the format is an ISO 8601 string, not epoch ms
- scripts/task.js:563 — `started: stamp,` — the only fresh write, in `cmdStart`
- scripts/task.js:951 — `started: source.started || stamp,` — `adopt` carries the source entry's forward
- scripts/task.js:705 — `// \`started\` is kept. It is the collision tie-break, and the question it answers —` — the rename path keeps it

**Read — five modules, three jobs**

- lib/guard.js:85 — `const t = Date.parse((data && data.started) || '');` — parsed to epoch ms by the `startedAt` helper (:84), whose `data` is the registry entry
- lib/guard.js:96-100 — `claimedFirst`: `return t < m;` — the earlier `started` wins a contested file; unreadable start loses either way
- lib/guard.js:131 — `if (mineHolds && !claimedFirst(data, mine)) continue;` — the tie-break's one caller
- lib/dirty.js:148 — `const since = Date.parse((data && data.started) || '');` — the mtime cutoff for `claimWrites`; a dirty file older than it is dropped
- lib/dirty.js:98 — `// \`started\` is the cutoff because it is the one timestamp on the record that does not move` — `updated` is rewritten every prompt
- lib/handoff.js:12-15 — `started.replace(/[-:]/g, '').slice(0, 15)` into `.fankeel/build/task-<stamp>/`; anything failing `^\d{8}T\d{6}$` returns null rather than guessing a directory
- lib/station.js:366 — `started: typeof data.started === 'string' ? data.started : null,` — copied onto the row raw
- lib/station.js:530-532 — `Date.parse(s.started)` → `detail.dayOf(started)`, the cache key for a session's pre-`days` spend
- lib/station.js:614 — `started: s.started,` — re-emitted unchanged into the page's JSON
- lib/detail.js:652 — `d.started.slice(0, 10)` — the detail object's `day`, a slice not a parse

**Read again in the browser — nine sites, all `assets/station/station.js`**

- station.js:357 — `inside[localDay(Date.parse(s.started))]` — whether a session counts in a project's window
- station.js:605 — `t: Date.parse(s.started)` — a chart point's x coordinate
- station.js:654, :659 — `stamp(started)` and `mins((s.updated || started) - started)` — the 開始 cell and the run length
- station.js:1242, :1255 — the 30-day window test and the newest-first sort
- station.js:1316, :1547 — `stamp(Date.parse(s.started))` — the session header and detail 開始 labels
- station.js:1337 — `if (k === 'started') return Date.parse(s.started) || 0;` — the list column's sort key
- station.js:1402 — `day(s.started)` — the date-only column (`day()` at :43 is a slice)

**Reached indirectly — no hook touches the field itself**

- hooks/inject.js:182 — `const found = claimWrites(root, sessionId, mine);` — every prompt, through lib/dirty.js
- hooks/gate.js:47 — `gate = readGate(handoffPath(root, mine, mine.stage));` — finds this very file
- lib/render.js:115, :400 — `handoffPath(...)` in the control block and the brain brief
- scripts/task.js:790 — `handoffPath(root, data, data.stage)`

**Silent where it would be expected**

- lib/registry.js — zero occurrences of `started`; the module that owns the entry never reads the field
- lib/badge.js, lib/overlap.js, lib/stages.js, lib/profile.js — zero, checked by grep
- lib/live.js:109 — `startedAt: ... data.startedAt ...` — Claude Code's `sessions/<pid>.json` process start, a different field
- scripts/station.js:314 — the serve process's own start in `serve.json`; scripts/task.js:345 `stampOf` reads `updated` on purpose; registry `gateAt` and `clock[stage]` are separate stamps

**What the documents say, and they agree**

- docs/registry.md:100-101 — "every path git reports dirty whose mtime is later than the task's `started`" — matches lib/dirty.js:148
- docs/collisions.md:69, :119 — the same cutoff, and that a file not later than `started` is dropped without a word
- docs/station.md:131 — `started` among the fields a station row takes from the entry
- skills/fankeel-plan/SKILL.md:269 — "x is milliseconds since `started`" — the plan chart's axis
- docs/registry.md:31 lists who writes which field but has no row for `started` itself — no page states its format; ISO 8601 is only observable from scripts/task.js:271

One reader cited docs/collisions.md:170 and :209-211 for an example entry and a "collision tie-break" sentence. Neither line says that — collisions.md holds the word three times, at :69, :119 and :220 — and a second citation to docs/pipeline.md:131 was really docs/station.md:131. Both were dropped at the check; nothing unverified reached this list.

planned, not built: docs/improvement-brief.md, docs/plans/2026-09-01-stage-timing-design.md, docs/plans/2026-09-01-stage-timing.md, docs/plans/2026-09-09-design-class-prompt.md, docs/plans/2026-09-19-stage-agents-design.md, docs/plans/2026-09-19-survey-brain-design.md, docs/plans/2026-09-19-survey-brain.md — the two survey-brain pages specify `task-<started>` and lib/handoff.js now implements it, the page doing its job rather than drifting; the stage-timing pair is the one that would put per-stage stamps beside `started`.
not found: `startedAt` as the registry's field — it exists only as Claude Code's process field; the scan's `started` hits were three unrelated declarations, so neither term located a reader.
unknown: a second entry is active with this same task line — session 5121ea58, started 2026-09-19T18:02:59.903Z — and I did not establish whether it is a stale duplicate; class on both reads `undefined`.
skipped: the scan skipped 107 files — 1 over the size cap, which it counts without naming, and 106 with no declaration pattern. A reader grepped all 106 openable ones: the 17 config/eval/HTML files match nothing, and the 90 under docs/reports/evidence/ are recorded transcripts where the word appears as CLI output (`"subtype":"task_started"`), not code. No reader of the field is among them. Tests are excluded from the reader list by choice: 37 test files set or assert `started` as a fixture, chiefly tests/task.test.js (82 occurrences) and tests/guard.test.js (13).
class: spike — the deliverable is this answer; nothing was asked to change, and no flow is being altered.
route: unchanged — the entry (started 2026-09-19T18:46:04.635Z) already carries the one-stage route `survey`; spike's `survey,build` would add a stage with nothing to build, so `task.js route` was not run.

```json gate
{
  "questions": [
    {
      "question": "survey 的答案在上面。要收下、升路線，還是再查一輪？",
      "header": "survey",
      "multiSelect": false,
      "options": [
        {
          "label": "收下，任務就到這 (Recommended)",
          "description": "接受這份清單就是答案：兩處寫入都在 scripts/task.js，五個模組直接讀（guard 的搶檔先後、dirty 的 mtime 界線、handoff 的目錄名、station 與 detail 的顯示），瀏覽器端九處，hooks 一律經 lib/ 間接讀，lib/registry.js 自己完全不碰。同時接受 class 是 spike、路線維持單站 survey，這一站結束後任務就站下，不進 build。"
        },
        {
          "label": "升 spike，把讀者寫成一頁",
          "description": "唯一還開著的決定：docs/registry.md:31 的欄位表沒有 started 這一列，沒有任何一頁說它是 ISO 8601，格式只能從 scripts/task.js:271 反推。要的話跑 task.js route \"survey,build\" 升到 spike，build 這站把讀者清單與格式補進 docs/registry.md。棘輪只准往上，選了就不能再降回單站。"
        },
        {
          "label": "再查一輪，兩個具名目標",
          "description": "一、registry 裡還有第二筆 active 且 task 一字不差的紀錄（session 5121ea58，started 18:02:59），我沒查它是不是殘留，也沒查兩筆同時活著會不會讓 guard 的 claimedFirst 把自己判成輸家。二、docs/plans/2026-09-01-stage-timing 這組 design-intent 頁要在 started 旁邊加每站時間戳，我只確認它存在，沒讀它是否改動 started 本身的語意。"
        },
        {
          "label": "問法不對，我重問",
          "description": "如果你要的其實不是「誰讀它」而是「改掉它會壞哪裡」，或是想把 tests/ 的 37 個檔案也算成讀者、或想連 docs/archive/ 一起看，說一句，我用新的鏡頭重跑這一站。這一份報告會被改寫，不是疊加。"
        }
      ]
    }
  ],
  "next": "survey 完成：started 的寫入 2 處、直接讀者 5 個模組、瀏覽器 9 處，class spike，路線維持 survey 單站。"
}
```
