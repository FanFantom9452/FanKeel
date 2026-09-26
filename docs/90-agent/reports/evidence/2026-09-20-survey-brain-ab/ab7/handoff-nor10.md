# survey — which code reads the registry's `started`, and what each reader does with it

```
fankeel map — F:\ymlab\fankeel\.fankeel\map.md

  235 markdown files, 7 planned, not built, 110 retired, 14 undeclared

Read it before designing anything. It is regenerated, so it cannot be stale;
if it is wrong, the project's own documents are what is wrong.
```

```
fankeel survey — 631 files, matching: started
source: git
skipped: 1 over the size cap, 223 with no pattern for their extension

declarations:
  lib/guard.js:84  const startedAt = (data) => {
  tests/inject.test.js:558  function stopStarted(cfg) {
  tests/task.test.js:70  const started = (dir, id, task, project) =>

documentation:
  docs/archive/2026-08-25-init-scan-residue.md:1280  # Zero is a legal step and means all hollow: a plugin that has started and not yet
  docs/archive/2026-09-05-anchor-remaining.md:252  ### 0. It already said it started
  docs/reports/evidence/2026-09-20-survey-brain-ab/ab4/handoff-nor5.md:1  # survey — 誰讀 registry 的 `started`，各自拿它做什麼
  docs/reports/evidence/2026-09-20-survey-brain-ab/ab4/handoff-nor6.md:1  # survey — 誰讀 registry 的 `started`，各自拿它做什麼
  docs/reports/evidence/2026-09-20-survey-brain-ab/ab5/handoff-nor7.md:1  # survey — which code reads the registry's `started`, and what each reader does with it
  docs/reports/evidence/2026-09-20-survey-brain-ab/handoff-942566e9/survey.md:1  # survey — which code reads the registry's `started`, and what each reader does with it
  skills/fankeel-survey/SKILL.md:42  ### 0. It already said it started

skipped, and openable by hand:
  .claude-plugin/marketplace.json
  .claude-plugin/plugin.json
  .fankeel/.gitignore
  .fankeel/docs.json
  .fankeel/profile.json
  .gitattributes
  .gitignore
  .ignore
  assets/station/index.html
  docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab-provenance.txt
  ... and 198 more, not listed
```

The scanner reports declarations, so every reader below came from a
grep of `lib hooks scripts assets` plus `sed -n` on each line cited.

**Writers.** `started` is stamped once and never re-stamped.

- scripts/task.js:563 — `start` writes `started: stamp` with `updated`.
- scripts/task.js:705-707 — `task` (rename in place) deliberately keeps it: "It is the collision tie-break… not re-opened by renaming".
- scripts/task.js:947-951 — `adopt` carries `started: source.started || stamp`; the comment says re-stamping "lost that answer permanently".

**Reader 1 — collision tie-break (guard).**

- lib/guard.js:84-87 — `startedAt(data)` parses it; `NaN` → `null`.
- lib/guard.js:95-100 — `claimedFirst(theirs, mine)`: when two sessions both hold a file, the older `started` wins. A claim with no parseable `started` cannot win, and mine having none also loses, so the tie-break is symmetric.

**Reader 2 — retroactive claims (dirty).**

- lib/dirty.js:148-149 — `claimWrites` uses it as the mtime cutoff; not finite → `{ added: 0, declined: 0 }`, a declared hole rather than a silent one.
- lib/dirty.js:98-101 — why it, not `updated`: `updated` is rewritten every prompt, so measuring against it would drop every write before the last.

**Reader 3 — handoff directory key (stage agents).**

- lib/handoff.js:12-16 — `dirFor` strips `-` and `:`, takes 15 chars, demands `/^\d{8}T\d{6}$/`, and returns `.fankeel/build/task-<stamp>`. A malformed or missing `started` returns `null`.
- lib/render.js:115-119 and :400-410 — the stage-agent brief is `null` when that path is `null`, so no report file is named.
- hooks/gate.js:47 — reads the stage's gate block from that path.
- hooks/resume.js:75-77 — writes the user's answer beside it.

**Reader 4 — reporting, day bucketing, sort.**

- lib/detail.js:652 — `day: d.started.slice(0, 10)`, the cache's UTC date.
- lib/station.js:366 — passed through to the model as `started` or `null`.
- lib/station.js:530-533 — `keptDays` buckets a whole pre-`days` spend on `dayOf(started)`.
- lib/station.js:614 — emitted in the sessions JSON.
- assets/station/station.js:357, 605, 654, 1242, 1255, 1337, 1402, 1547 — day membership, the spend point's x, elapsed as `(updated || started) - started`, the thirty-day window, the `開始` sort column and the detail panel.

planned, not built: docs/improvement-brief.md, docs/plans/2026-09-01-stage-timing-design.md, docs/plans/2026-09-01-stage-timing.md, docs/plans/2026-09-09-design-class-prompt.md, docs/plans/2026-09-19-stage-agents-design.md, docs/plans/2026-09-19-survey-brain-design.md, docs/plans/2026-09-19-survey-brain.md
not found: none — `started` matched; no second term was tried
unknown: docs/plans/2026-09-19-survey-brain-design.md is still `design-intent`, yet lib/handoff.js:6 cites its §5 as built. Not drift by this skill's table, but the page's status lags the code.
skipped: 223 files whose extension has no declaration pattern (JSON, CSS, HTML, `.txt`, `.patch`) and 1 over the size cap. The registry records themselves are JSON and so never scanned — I read `.fankeel/sessions/ce59a0ff-efb1-459f-9126-1b8f475a2946.json` by hand for the field. No file was dispatched to a reader; nothing here needed a second context.
class: spike — the output is this answer. Nothing is to be built, and no flow changes.
route: unchanged — the record already carries `route: ["survey","design"]`, a two-stage route someone said at `start`, and the ratchet is one-way.

```json gate
{
  "questions": [
    {
      "question": "survey 讀完了：`started` 有三個寫入點、四類讀者。接下來怎麼走？",
      "header": "survey",
      "multiSelect": false,
      "options": [
        {
          "label": "接受，收尾",
          "description": "(Recommended) 接受 spike 這個分類與這份清單就是答案：`started` 寫入只在 scripts/task.js:563，rename (:705) 與 adopt (:947) 刻意保留它；讀者是 lib/guard.js:95 的 claim 先後、lib/dirty.js:148 的 mtime cutoff、lib/handoff.js:12 的 build 目錄鍵（lib/render.js、hooks/gate.js、hooks/resume.js 都靠它）、以及 lib/detail.js:652 與 station 的日期分桶與排序。接受等於同意不進 design、不改任何檔案，這個 task 到此為止。"
        },
        {
          "label": "追 handoff 這條",
          "description": "唯一還沒定案的一點：lib/handoff.js:12 的 dirFor 在 `started` 缺漏或格式不合時回 null，於是 lib/render.js:400 給不出 stage agent 的 brief。要我再讀 tests/brief.test.js:283（`a stage agent on a record with no started gets the ordinary brief`）與 lib/render.js 的那條 early return，把「沒有 started 時整條 stage-agent 路徑怎麼降級」寫清楚，再回到這個 gate。"
        },
        {
          "label": "查 design-intent 落差",
          "description": "docs/plans/2026-09-19-survey-brain-design.md 仍標 design-intent，但 lib/handoff.js:6 直接引它的 §5 當已實作的依據。要我把那一頁與 lib/handoff.js、lib/render.js 逐條對照，說出哪些段落程式已經追上、哪些還沒，作為之後改 frontmatter 的憑據。這一輪只讀不改。"
        },
        {
          "label": "掃 JSON 那 223 個",
          "description": "scanner 對 JSON、CSS、HTML、`.txt` 沒有 declaration pattern，223 個檔案沒被打開過——registry 的 session 檔本身就在裡面，我只手開了本 session 那一個。要我針對 `.fankeel/` 與 assets 下的 JSON/HTML 再跑一次純文字比對，確認沒有第五類讀者躲在沒掃到的檔案裡。"
        }
      ]
    }
  ],
  "next": "survey done: started has 3 writers and 4 reader groups; class spike, route unchanged."
}
```
