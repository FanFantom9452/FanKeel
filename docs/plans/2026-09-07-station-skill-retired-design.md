---
status: design-intent
source_of_truth: hooks/inject.js, lib/render.js, scripts/station.js, lib/station.js, skills/fankeel/SKILL.md, docs/station.md
---

# The Station Skill Retired — Design

## The ask

Three things, agreed in chat on 2026-09-07: the `fankeel-station` skill goes,
because the `/fankeel` prompt already writes the page and names it; what the
skill said that the reference page did not, and the places where the reference
page lags the code, land in `docs/station.md`; and `scripts/station.js` gains
`--json` so a session can read the rows rather than a counts line.

## What the survey found, and what it rules out

- `hooks/inject.js:71` — `station.write` runs on the `/fankeel` prompt, before
  the block; `lib/render.js:239` prints `station: N stale, M live — <file>` in
  it. The entry already triggers the page.
- `skills/fankeel/SKILL.md:600` — the one current page that sends a reader to
  `/fankeel-station`. The three station plans and the 0.44.0 field report name
  it too; those record a moment and stay.
- `skills/fankeel-station/SKILL.md:3` — the description carries the phrases
  that route to it: "show all sessions", "which sessions are still open",
  "clean up old sessions", "監控站".
- `scripts/station.js:45-50` — `--port`, `--idle`, and an unknown argument
  exiting 2; none on `docs/station.md`, and neither is `--open`. `:319-332` —
  `--forget` and `serve` return before the first-run check at `:336`, so
  `docs/station.md:31`'s "the first run" is the default form only.
- `lib/station.js:716-723` — `write()` returns counts; the rows are in the
  model `gather()` (`:231`) builds and `render()` reads.
- `tests/contract.test.js:275` and `tests/version.test.js:100` pin the
  version-carrying files at eleven; `README.md:286-289` says eleven files and
  nine skills.
- `lib/station.js:249,254` — an active row whose config directory cannot be
  read is `running` and `unknown`, so it prints `live?`; `stale?` cannot occur.
  `docs/station.md:78` is right, and the reader that said otherwise was wrong.

Rules out: any change to `hooks/inject.js` or `lib/render.js` — the entry
already does what the ask wants; a served endpoint for JSON; a `--json` that
writes the page or walks the drives; archiving the three station plans, which
is `docs-audit`'s landed-plan call and they are not quiet yet.

## 1. The skill goes, and its words move

- `skills/fankeel-station/` is deleted; nothing else in the tree lists skills
  by name, so the two manifests need no edit.
- `skills/fankeel/SKILL.md:600` says where the page is instead of naming a
  skill: the `station:` line of the `/fankeel` block, `.fankeel/station.html`
  in the registry, `node <plugin>/scripts/station.js --open` for the newest
  copy, and `serve --open` to clear from it.
- The `fankeel` skill's `description` gains the retired skill's routing
  phrases — "show all sessions", "which sessions are still open", "clean up old
  sessions", "監控站" — and stays under the 500 characters
  `tests/skills.test.js:51` allows.
- `tests/contract.test.js:275` and `tests/version.test.js:100` count ten;
  `README.md:286-289` says ten files and eight skills.
- `TODO.md:67` and `TODO.md:71` are removed in the same change.

## 2. The reference page catches up with the code

- A short opening paragraph on `docs/station.md` says how to open the page —
  `.fankeel/station.html` in the registry, `node scripts/station.js --open`
  for the newest copy, `serve --open` to clear from it — so a reader arriving
  from the `fankeel` skill needs nothing the retired skill used to hold.
- The `serve` paragraph names `--port <n>` and `--idle <minutes>`, with their
  defaults: a port the OS picks, ten minutes.
- The first-run row of the sources table says the walk runs on the default
  form only — `serve` and `--forget` return before the check — and the page
  says that an argument the parser does not know exits 2 before anything is
  written.
- `last_verified` moves to 2026-09-07.

## 3. `--json` prints the rows

- `node scripts/station.js --json` prints the model `gather()` returns as one
  JSON document on stdout and writes nothing: no page, no `roots.json`, no
  first-run walk. `--root` and `--scan` still feed `discover` under it.
- `--json` beside `serve` or `--forget` is refused with exit 2, the way an
  unknown argument is.
- `docs/station.md` says, under "When it is written, and where", what a
  session does with it: read `registries[].sessions[]` and filter on `state`.

## File table

| file | change | dispatch |
|---|---|---|
| `skills/fankeel-station/SKILL.md` | deleted, the directory with it | implementer, sonnet — five files, each a named edit |
| `skills/fankeel/SKILL.md` | `:600` rewritten; `description` gains four phrases | same task |
| `tests/contract.test.js`, `tests/version.test.js` | eleven becomes ten | same task |
| `README.md` | `:286-289` ten files, eight skills | same task |
| `TODO.md` | `:67` and `:71` removed | same task |
| `docs/station.md` | the four bullets of section 2, the last bullet of section 3 | implementer, sonnet — the plan carries the sentences |
| `scripts/station.js` | `--json` in `parseArgs` and `main` | implementer, sonnet — the plan carries the code |
| `tests/station-cli.test.js` | the two tests below | same task |
| `tests/skills.test.js` | the routing-phrase test below | same task as the skill deletion |

## What proves it done

| test | fails now because |
|---|---|
| `tests/station-cli.test.js` — `--json` prints JSON whose sessions carry `state`, one `live` and one `stale`, and leaves no `station.html` in the config directory | `--json` is an unknown argument, exit 2 |
| `tests/station-cli.test.js` — every `--flag` `parseArgs` accepts appears on `docs/station.md` | `--port`, `--idle` and `--open` are on no page |
| `tests/skills.test.js` — the `fankeel` skill's description carries "監控站" and "clean up old sessions", and no skill names `/fankeel-station` | the phrases live in the retired skill; `skills/fankeel/SKILL.md:600` names it |
| `tests/contract.test.js`, `tests/version.test.js` — green at ten | green at eleven now; red the moment the directory goes, until the count moves |
| end to end — the `N stale` the default form prints on this registry equals the count of `state == "stale"` in `--json`'s output | the artefact checked against itself; there is no `--json` to compare |

## Against the map

`docs/station.md` is listed current and is amended, not contradicted.
`skills/fankeel/SKILL.md` is current and its one sentence naming the skill is
rewritten. The three station plans and the 0.44.0 field report name
`/fankeel-station`; both roles record a moment and are left alone. Nothing here
describes as existing a thing that does not: the page at the `/fankeel` prompt
is `hooks/inject.js:71` today.

## Unverified

Whether a plugin update drops a skill directory the new version no longer
ships. The cache is per version — `plugins/cache/fankeel/fankeel/0.50.0/` —
so 0.52.0 should arrive without it; not tried.
