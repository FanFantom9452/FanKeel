---
status: design-intent
---

# TODO 全表盤點 — every entry, checked by script

The 2026-10-17 patrol's survey report carried `entries: 29 listed, 29 in TODO`
over seven Ready lines and one paragraph saying the 22 Blocked and Watch entries
were seen only by title. `skills/fankeel-survey/SKILL.md`'s `## The patrol`
already asks for one line per entry; nothing checked it, and the gate went out.
The user asked that a patrol never pass over Watch or Blocked again. The same
patrol also does what this survey found buildable.

## 1. The patrol's survey report is checked line by line

- A patrol is a task whose route is exactly `survey,plan,build,verify,land`, the
  route `/fankeel`'s INIT rule starts it on; at `survey`, its open TODO entries
  (every entry whose state is not `done`) are the list the report must cover.
- `readGate` refuses the gate when any open entry has no line, above the last
  `json gate` block, naming it — by id or by title — together with one of the
  dispositions `do now`, `needs the user`, `waiting on`, `keep`.
- The refusal names the missing ids, so the stage agent knows which to add.
- Scope: entry-file TODOs and a controlled survey only — a hand-written `TODO.md` yields no list, and an in-session survey has no handoff file to read; the skill says so.
- `hooks/gate.js`, `hooks/gate-write.js` and `scripts/gate-check.js` pass the
  list, so the stage agent hears it as it writes the file and the controller
  is refused before the question goes out.
- The survey skill's `## The patrol` says the check exists.

## 2. What this patrol builds

- `docs/90-agent/reference/station.md`'s three references to
  `assets/station/station.js` that point at unrelated lines point at the
  `NAV_TREE` settings item, `navHtml` and the `csmore` details element, each
  with a quote docs-check can compare.
- README.md's paragraph on parallel `npm test` runs names the commit-limit
  signature — `VirtualAlloc failed`, exit `0xC0000409`, `0xC000012D` — as the
  machine running out of commit, not a failing test.

## What proves it done

| test | proof |
|---|---|
| a patrol survey report missing an entry is refused | a test in `tests/handoff-patrol.test.js` that turns red when the check is removed |
| a report naming every open entry with a disposition passes | the same file |
| a task not on the patrol route, or not at survey, is not checked | the same file |
| station.md's three references resolve and carry quotes | `node scripts/docs-check.js` reports none of the three |
| README.md names the signature | `grep -n 0xC000012D README.md` |
