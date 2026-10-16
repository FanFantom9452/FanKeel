---
status: current
---

# Pane：route、tasks、TODO 可收合，TODO 標題跳到 station

Approved at the design gate on 2026-10-17, against the mockup at
`.fankeel/build/2026-10-16-pane-fold-todo/mockup.html` (uncommitted; drawn
from the real `statusRows`, `routeSvg` and `tasksSvg`). Covers the TODO
entries Pane 的 route、tasks 可收合 and Pane 底部的 TODO 跳轉按鈕, plus the
probe setup for 子代理 brief 改走 spawn.

## 1. Folding

- route and tasks each get a head row drawn as a `Button`: `▾ route 2/6` and `▾ tasks 3/5` expanded, `▸ route 2/6 design` and `▸ tasks 3/5` folded.
- `onPress` flips a fold flag held in the Pane's `state` closure (`hooks/pane.ts`) and calls `$.ui.invalidate('ui.render')`.
- Folded, the block is its one head row: no Svg on Desktop, no body rows in the terminal.
- The fold flags live in memory only; a new session starts expanded.
- Desktop and terminal both fold; in the terminal the head row is the same Button, drawn as text.

## 2. The TODO block

- The foot gains a foldable TODO block in the same shape: head `▸ TODO 30` folded, `▾ TODO 30` expanded, the count being the project's open entries.
- Expanded, it lists entries one row each, title only, Ready first, at most 6 rows.
- Each title row is a `Button` that opens the station at `#/p/<pkey>/todo/<id>`.
- Past 6 rows, a dim `還有 N 條` row is a `Button` opening `#/p/<pkey>/todo`.
- The `開啟 station` Button stays as it is; with no station running, the TODO buttons give way to the dim `station 未啟動` like it does.
- The entries come from the project's `todo` bucket in `.fankeel/docs.json`, read with `$.fs`: each file's frontmatter `title` and `state`.
- `pkey` is `root + '/' + project`, or `root` when the entry has no project — the same one-liner as `pkeyOf` in `lib/station.js`.

## 3. The station route

- `parseHash` in `assets/station/station.js` reads a trailing `/todo` or `/todo/<id>` on `#/p/<pkey>` as a focus, not as part of the pkey.
- After the project page draws, the TODO panel (`#todo`) — or the entry `<id>` inside it — is scrolled into view.
- `docs/90-agent/reference/station.md` names the two sub-routes.

## 4. brief-3 probe setup

- The probe the TODO entry 子代理 brief 改走 spawn describes is prepared as files the user can load, without running it; running it stays the user's, in an interactive session.

## What proves it done

| check | how |
|---|---|
| a title Button opens the entry's url | `tests/pane.test.js`: pressing it makes `$.process.run` receive `…#/p/<pkey>/todo/<id>` |
| folding works and is driven by `onPress` | `tests/pane.test.js`: after `onPress` the tasks block is one row; the test goes red when `onPress` stops flipping the flag |
| the list caps at 6 | `tests/pane.test.js`: with 8 entries, 6 title rows and a `還有 2 條` row |
| the sub-route parses and scrolls | a station test: `#/p/<k>/todo/<id>` yields pkey `<k>` and focuses `<id>` |
| the artefact agrees with itself | the head's count equals the number of entries the list draws from |
| it works on the real Desktop | the user clicks a fold head and a TODO title once on Desktop |
