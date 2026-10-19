---
status: current
last_verified: 2026-10-19
source_of_truth: scripts/verify-map.js
---

# The verification map

`.fankeel/render.json` says which pages to photograph. This directory says how a person reaches a feature, drives it, and what misleads them along the way. Each feature has one file: a short header that a script reads, then prose. [station.md](station.md) is the worked example.

## A feature file

`.fankeel/verify/<feature>.md`, named after the feature. Its frontmatter:

| key | what it holds |
|---|---|
| `feature` | the file name without `.md` |
| `kind` | `page` for something a browser shows, `cli` for a command, `hook` for a Claude Code hook |
| `src` | the globs of the files the feature is made of, written `[a, b]`, relative to the repository root and matched the way render.json's `src` is |
| `render` | `page` only: the render.json page names this feature covers. Their `src` counts as this file's `src`, so a page render.json already declares is not declared twice. Leave `src` off when `render` covers it, and give `src` when render.json does not declare the page |
| `last_checked` | the day a reader last checked the file against its source, `YYYY-MM-DD` |
| `status` | the result of that check: `clean`, `changed` or `blocked` |

The body has five `##` sections. Every one is required:

- **Sub-features**: what the feature does, one bullet each, so a verifier can say which ones a change reached.
- **Reach**: the command or url that gets to the feature, and what it prints.
- **Drive**: numbered steps, each saying what it must show. A verifier's evidence row cites the file and the step number.
- **Gotchas**: what can make a drive pass or fail for the wrong reason.
- **Doctor**: the checks that decide whether driving is worth doing at all. When a check fails, the row is `blocked`, not a pass. For `cli` and `hook` the Doctor is an exit-code check: the command, followed by `exits 0` or whatever code it should exit with.

## Evidence and cleanup

Evidence goes under `.fankeel/build/task-<started>/verify/<feature>/`: screenshots and command output. Cleanup stops whatever Reach started and deletes the temporary directories it made. It never deletes evidence. Evidence is kept and moved, never cleaned up.

## Who reads it

- verify: `node scripts/verify-map.js --range <a>..<b>` prints the feature files whose globs the change matches, matched through `pagesTouched()` in `lib/shots.js`. The verifier runs each file's Doctor, then its Drive.
- audit: one reader per file checks it against its source and answers `clean`, `changed` or `blocked`.
- `node scripts/verify-map.js` lints this directory: one `warn:` line per problem, and it always exits 0.
