---
status: design-intent
---

# The patrol takes `## Ready` in

Decided 2026-09-30 at the design gate of the task "TODO 全表盤點並全做；盤點改成盤完直接進實作":
`/fankeel` stops offering `## Ready` as its own option. The patrol, `TODO 全表盤點`, is the one
option that both walks every heading and builds what is buildable, on a fixed route that carries
`plan` and `verify`.

## 1. The option

- `/fankeel` init offers no `## Ready` option; Ready entries are reached through the patrol, and by name through **Other**.
- The patrol stays the last option whenever `TODO.md` has an entry, and its route is `survey,plan,build,verify,land`.
- `## Needs a decision` gets the slot Ready used to take: `orient.js`'s option limit drops the Ready term.
- `orient.js`'s `patrol:` line says the patrol builds Ready, and its `start:` line says the patrol starts with `--todo` once per Ready id.

## 2. The stages

- The survey `## The patrol` section: every Ready entry that is still true and buildable in this session is `do now`; the report names them, and the route is already wide enough, so no `task.js route` widening is needed for them.
- The build `## The patrol` section: the do-now entries are the plan's tasks, and each closes its own entry with `todo.js done`.

## 3. The documents

- `docs/90-agent/reference/todo.md`, `docs/02-architecture/pipeline.md`, `docs/01-guide/development.md` and `docs/01-guide/getting-started.md` describe the merged option; archive, decision and report pages are left as written.

## 4. todo-3

- The station project page already draws finished entries (`assets/station/station.js`'s `todoPanelHtml`, `data-block="todo-done"`), so the decision "a station column" is closed as already built rather than rebuilt.

## Testing

`tests/orient.test.js` asserts no Ready option, the new `patrol:` wording and a Needs-a-decision
limit of three with a patrol; `tests/render.test.js` pins the new INIT sentence; `tests/skills.test.js`
pins `survey,plan,build,verify,land` in the three skills. Each fails against today's text.
