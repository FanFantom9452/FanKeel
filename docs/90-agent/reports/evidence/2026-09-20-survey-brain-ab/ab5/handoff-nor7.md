# survey — which code reads the registry's `started`, and what each reader does with it

map summary (`node scripts/map.js`):

```
fankeel map — F:\ymlab\fankeel\.fankeel\map.md

  234 markdown files, 7 planned, not built, 110 retired, 13 undeclared
```

scanner (`node scripts/survey.js started --all`):

```
fankeel survey — 592 files, matching: started
source: git
cap: none
skipped: 1 over the size cap, 187 with no pattern for their extension

declarations:
  lib/guard.js:84  const startedAt = (data) => {
  tests/inject.test.js:558  function stopStarted(cfg) {
  tests/task.test.js:70  const started = (dir, id, task, project) =>

documentation:
  docs/archive/2026-08-25-init-scan-residue.md:1280  # Zero is a legal step and means all hollow: a plugin that has started and not yet
  docs/archive/2026-09-05-anchor-remaining.md:252  ### 0. It already said it started
  docs/reports/evidence/2026-09-20-survey-brain-ab/ab4/handoff-nor5.md:1  # survey — 誰讀 registry 的 `started`，各自拿它做什麼
  docs/reports/evidence/2026-09-20-survey-brain-ab/ab4/handoff-nor6.md:1  # survey — 誰讀 registry 的 `started`，各自拿它做什麼
  docs/reports/evidence/2026-09-20-survey-brain-ab/handoff-942566e9/survey.md:1  # survey — which code reads the registry's `started`, and what each reader does with it
  skills/fankeel-survey/SKILL.md:42  ### 0. It already said it started
```

The declaration scanner reports declarations, not field reads, so the readers
below come from `grep -rn started lib/ scripts/ hooks/ assets/station/station.js`
with every cited line opened by `sed -n`.

## The readers

- scripts/task.js:563 — `start` writes `started: stamp`; scripts/task.js:951 — `adopt` keeps `source.started || stamp` on purpose, so an inherited task does not lose the tie-break; scripts/task.js:705 and :716–745 — the rename deletes `claims`, `notes`, `burn`, `clock`, `moves`, and deliberately keeps `started`.
- lib/dirty.js:148 — `claimWrites` does `Date.parse(data.started)` as the mtime cutoff for dirty paths; an unparseable one returns `{ added: 0, declined: 0 }` rather than claiming anything. Sole caller hooks/inject.js:182. `updated` is rejected as the cutoff at lib/dirty.js:98 because it moves every prompt.
- lib/guard.js:84 `startedAt` and :94 `claimedFirst` — the collision tie-break: the older `started` holds the file, and a side with no readable one loses regardless of which side asks.
- lib/handoff.js:12 — the handoff directory key: `started` stripped of `-`/`:` and cut to 15 chars, `.fankeel/build/task-<stamp>`; anything not `\d{8}T\d{6}` returns null, so the stage gets no path. Consumed by lib/render.js:20, scripts/task.js:37, hooks/gate.js:25, hooks/resume.js:25.
- lib/station.js:366 — copies `started` onto the session model; :530 `keptDays` uses it as the day bucket for caches predating `days`; :614 puts it in the page payload.
- lib/detail.js:652 — `day: d.started.slice(0, 10)`, a UTC cut, which lib/station.js:527 notes differs from the local days `days` counts.
- assets/station/station.js:357, 605, 654–659, 1242, 1255, 1337, 1402, 1547 — the page: which local day a session counts on, the x position of its whole spend, the 開始 column and `updated - started` as duration, the 30-day window test, and the sort key.
- lib/stage-registry.js:38 — fixture only, `started: ago(2 * 3600e3)`.

## Not readers

- lib/registry.js has zero matches for `started`: there is no accessor, so each of the six readers parses `data.started` itself, while `updated` has `registry.updatedAt` (used at lib/station.js:367).
- `startedAt` at lib/live.js:109 and lib/station.js:327 is Claude Code's own process field from the live manifest, not the registry's `started` — the same name, a different source.

## Documents

docs/registry.md:31 lists which writer owns each field and does not list `started` among them; docs/registry.md:101 states the mtime-vs-`started` rule that lib/dirty.js:148 implements, and docs/station.md:131 and :570 match the page's use. No disagreement found.

planned, not built: docs/improvement-brief.md, docs/plans/2026-09-01-stage-timing-design.md, docs/plans/2026-09-01-stage-timing.md, docs/plans/2026-09-09-design-class-prompt.md, docs/plans/2026-09-19-stage-agents-design.md, docs/plans/2026-09-19-survey-brain-design.md, docs/plans/2026-09-19-survey-brain.md — lib/handoff.js:6 cites the survey-brain design page, so that one is partly built already.
not found: none — `started` matched; no synonym scan was needed.
unknown: whether `classForRoute(['survey','design'])` returning `null` (checked by running it) is intended for this two-stage route, and whether the page's UTC `day` versus local `days` split at lib/detail.js:652 is a live defect or accepted.
skipped: one file over the size cap, `session-31b5f48b-full.md` (830K transcript dump, no declarations), and 187 files with no declaration pattern for their extension — `.json`, `.txt`, `.html`, evidence dumps under docs/reports/evidence. None hold registry-reading code; lib/, scripts/, hooks/ and assets/station/station.js were grepped directly instead, which is where the readers live. `tests/` matches were not enumerated beyond the two fixtures above.
class: spike — the output is an answer, nothing is built.
route: unchanged — `survey,design` was said at `start`; the ratchet forbids dropping `design` for spike's `survey,build`.

```json gate
{
  "questions": [
    {
      "question": "survey 找到六處讀 registry 的 started，要接哪一步？",
      "header": "survey",
      "multiSelect": false,
      "options": [
        {
          "label": "收下這份調查 (Recommended)",
          "description": "接受 spike 分類與 route 不變（survey,design）：六處讀者為 scripts/task.js:563/951/705（寫入、adopt 沿用、rename 保留）、lib/dirty.js:148（dirty 檔的 mtime 分界線）、lib/guard.js:84/94（碰撞時舊的 started 勝）、lib/handoff.js:12（交接目錄 task-<stamp>）、lib/station.js:366/530/614 與 lib/detail.js:652（頁面與 day 分桶）、assets/station/station.js 七處 UI。lib/registry.js 完全沒有 started 存取器；lib/live.js:109 的 startedAt 是 Claude Code 行程欄位，不是這個欄位。收下即結案，不再繼續讀。"
        },
        {
          "label": "先釐清 day 的 UTC/local 落差",
          "description": "唯一還開著的決定：lib/detail.js:652 把 started 切前十字得到 UTC 日期，而 lib/station.js:527 的註解說 days 數的是 local 日。要我把兩邊讀完、指出跨時區時哪一列會錯，再回來報告。"
        },
        {
          "label": "補讀 tests/ 裡的覆蓋",
          "description": "這次只點名 tests/inject.test.js:558 與 tests/task.test.js:70 兩個 fixture，沒有清點測試對 started 的斷言。要我列出哪些測試真的鎖住 tie-break 與 handoff 目錄命名，指出沒有測試保護的讀者。"
        },
        {
          "label": "改成 survey,build 並動手",
          "description": "把這題當成要修的東西而不是要答的問題：加 registry.startedAt 存取器，讓六處不再各自 Date.parse。這是改 route（design 換成 build），ratchet 不允許降級，所以要你明確指定新 route。"
        }
      ]
    }
  ],
  "next": "survey 完成：六處讀 started，lib/registry.js 沒有存取器；選一項或指定新 route。"
}
```
