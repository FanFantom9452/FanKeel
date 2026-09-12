# Contributing to FanKeel

There is no `CLAUDE.md` and no `AGENTS.md` in this repository. This file is
where the conventions the code already follows are written down. Local setup
and the test commands are covered in [README.md](README.md), under
`## Development` — this file does not repeat them.

## Scope and ownership

Each area below has one place that decides what is true, and one rule for
changing it.

| Area | Source of truth | Contribution rule |
|---|---|---|
| Core logic | `lib/*.js` | Pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction. |
| CLI entry points | `scripts/*.js` | Thin wrappers over `lib/`. A new flag on the station CLI needs a row on `docs/station.md`, or `tests/station-doc.test.js` fails. |
| Hooks | `hooks/*.js` | Every hook exits `0` on every path, including its own errors — see `## Development` for why that is load-bearing. |
| Skills | `skills/*/SKILL.md` | Keep an operation's skill thin. Do not copy routing tables, domain rules, or shared conventions out of the skill that owns them and into a wrapper. |
| Tests | `tests/*.test.js` | `node --test`. Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it. |
| Documentation | `docs/README.md`, the hand-maintained index | Filing follows `.fankeel/map.md`: `docs` is reference, `docs/plans` is plan, `docs/decisions` is decision, `docs/reports` is report, `docs/archive` is archive. A new or renamed page gets its index row in the same change. |
| Generated station output | `lib/station.js`, the `EMITTED` list | Never hand-edit a file `station.js serve` writes. If a name stops being emitted, remove it from the committed `.fankeel/.gitignore` by hand — appending is automatic there, removing is not. |
| `TODO.md` | itself | One bullet per deferred thing, filed under `## Ready`, `## Needs a decision` or `## Waiting`. No detail that belongs in the file the bullet links to. |
| Version numbers | `scripts/version.js` | Run it to move the number. It is what keeps twelve files in agreement; hand-editing any one of them is how they stop agreeing. |

## Issue first

Open an issue before opening a pull request. A direct PR is allowed only when
all three of the following hold — any one failing means an issue comes first:

- **Change type** — a fix, a typo, or a small addition with no new surface: no
  new exported name, no new CLI flag, no new hook.
- **Behavior** — nothing a user, a test, or another document depends on
  changes: the same output shape, the same exit codes, the same file names.
- **Maintenance** — nothing is added that has to be kept working afterward: no
  new dependency, no new file under `hooks/`, no new generated name.

When any one of the three does not hold, the issue describes the change
before any code does.

## Pull requests

Use this body:

```markdown
## Summary
- What changed
- Why this is the right layer

## Verification
- Exact command or manual check and its result
- Not run: unavailable checks and the reason
```

**Report only checks you actually ran.** A check is a command, its output,
and the tree it ran against — not a description of what the command is
supposed to do.

That is one half of the rule. The other half is what makes it enforceable: a
check the environment could not run goes under `Not run:` with the reason,
**and it is not a pass**. Leaving it out of both `Verification` and `Not run`
is exactly the failure this section exists to catch — a missing tool reads as
a green check because nothing said otherwise.
