---
status: current
last_verified: 2026-10-17
---

# Drop the 10-10 plan drafts

The four untracked 2026-10-10 drafts under `docs/90-agent/plans/` are pre-land copies of work that landed and is archived, tracked, under `docs/99-archive/`. They are deleted; the archived copies stay.

## 1. Delete the drafts

- `docs/90-agent/plans/2026-10-10-decisions-human-design.md`, `2026-10-10-decisions-human.md`, `2026-10-10-todo-patrol-lint-suite-design.md` and `2026-10-10-todo-patrol-lint-suite.md` are removed with `rm`; they are untracked, so there is nothing to `git rm`.
- The same four names under `docs/99-archive/` are left untouched.

## Files

| file | change |
|---|---|
| `docs/90-agent/plans/2026-10-10-decisions-human-design.md` | deleted |
| `docs/90-agent/plans/2026-10-10-decisions-human.md` | deleted |
| `docs/90-agent/plans/2026-10-10-todo-patrol-lint-suite-design.md` | deleted |
| `docs/90-agent/plans/2026-10-10-todo-patrol-lint-suite.md` | deleted |

## What proves it done

| check | before | after |
|---|---|---|
| `git status --short docs/90-agent/plans/` lists none of the four 2026-10-10 drafts | four `??` lines | none |
| `.fankeel/map.md` names none of the four plans/ paths after `map.js` regenerates it | lines 132-135 | none |
