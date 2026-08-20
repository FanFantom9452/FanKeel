---
description: Open the fankeel task registry — see what this session and every other live session is working on, and start, adopt, pause or clear a task.
---

Use the `fankeel` skill.

Read every `.fankeel/sessions/*.json` under the project root, show the active
tasks with their stage, scope and — for anything last seen more than 12 hours ago
— its age, then ask what to do: carry on, start, adopt, stand down, or clear out.

`$ARGUMENTS`, when present, is the one-line task name for a new task. Ask for the
scope; never guess it.

A task moves through `survey` → `design` → `build` → `verify` → `land`. At the end
of a stage, offer the next stage, staying put, and pausing — never announce a
stage complete and stop.
