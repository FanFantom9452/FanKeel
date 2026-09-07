---
status: design-intent
last_verified: 2026-09-07
---

# The thirteen TODO entries — design

`## Ready` had one entry and `## Needs a decision` had twelve. This closes all
thirteen. The survey that preceded it read every file each entry names and
reopened every cited line, and **four of the thirteen turned out to be wrong as
filed** — so a third of this work is correcting the index rather than the code.

## What the survey found

| entry | filed as | what is actually there |
|---|---|---|
| 09-04 plan | 18 files named, all present | 17 present; `skills/fankeel-station/SKILL.md` was deleted by the later `2026-09-07-station-skill-retired.md` (85b5a24) |
| `--root` | five scripts raw, three resolve | not a raw-vs-resolved split at all — see below |
| `## groups` | a question | already behaves exactly as the entry describes it should |
| 08-30 plan | two prose filenames read as missing | confirmed: `lib/a.js` and `lib/b.js`, test fixtures inside code blocks |
| reviewer per task | measure the next build | this task's own build is that build |
| roots forever | no expiry, `--forget` only | confirmed, and it is a **documented decision** (`lib/station.js:46-53`) |
| docs-check counts | compares counts, not lists | `report()` already prints every finding (`:426`); `--quiet` only suppresses a clean run (`:460`) |
| join fourth pair | a shape no pair measured | confirmed — the 1.5x run was one dispatch over seven named files, one joint question |
| subprocess count | in `tests/contract.test.js` | not in that file; it is `README.md:255` and `tests/hook.test.js:3-4`, both already pinned by `eight` |
| `.claude/agents/` | uncovered by any bucket | confirmed: seven buckets, none names `.claude` |
| `3 of 5 pair readers` | citation points at nothing | confirmed — the phrase exists only in `TODO.md:87` and in a plan naming it as a bullet to leave alone. **No page claims the figure.** |
| 1.85x at a higher main price | unmeasured | unmeasured; the harness to measure it exists |
| output style to a subagent | unknown | `style` is a zero-match in `lib/render.js` and `hooks/brief.js`, so fankeel does not forward one. Whether Claude Code does is still open. |

## The `--root` finding, in full

The entry claimed a 5-vs-3 split. There is a split, but it is a different one.

| script | what happens to `--root` | base |
|---|---|---|
| `survey.js:461` | `path.resolve(findStateRoot(cwd) || cwd, value)` | the registry root |
| `docs-check.js:446` | same idiom, copy-pasted | the registry root |
| `docs-audit.js:825` | same idiom, copy-pasted | the registry root |
| `layout.js:31` | `path.resolve(value)` inside `parseArgs` | plain `cwd` |
| `map.js:22` | `path.resolve(value)` inside `parseArgs` | plain `cwd` |
| `orient.js:538` | raw for one hop; `scan()` resolves at `:290` | plain `cwd` |
| `residue.js:342` | never resolved anywhere | plain `cwd`, implicitly |
| `todo-check.js:383` | only the composed `at` path is resolved, never `root` | plain `cwd`, implicitly |

So it is not raw-vs-resolved. It is **which directory a relative `--root` is
relative to**, and it splits 3 against 5. `lib/argv.js` exports only
`splitAtVerb` and `splitAroundVerb` — there is no shared helper, and the
state-root idiom is three inline copies.

This only bites when the working directory is not the registry root. From inside
`Waypoint/`, `survey.js --root KB` scans `KB`, and `map.js --root KB` looks for
`Waypoint/KB`. The fankeel skill documents the first meaning
(*"Pass the project as `--root`"*), so the second is the one that is wrong.

`scripts/station.js` also takes `--root`, but it is a different flag — a
repeatable list of registries to scan (`:42`). **It is not part of this change.**

## The approach

One helper, six closures, two measurements, four index corrections. In that
order, because the helper is the only piece that can break anything else.

### 1. `resolveRoot`, in `lib/registry.js`

Next to `findStateRoot`, which it wraps:

```js
function resolveRoot(value, from) {
    const cwd = from || process.cwd();
    if (value === undefined || value === null || value === '') return cwd;
    return path.resolve(findStateRoot(cwd) || cwd, value);
}
```

Exported alongside `findStateRoot` at `lib/registry.js:695`. The three scanners
replace their inline copies with it; the five plain-`cwd` scripts adopt it, which
is the behaviour change. A **drive-qualified** absolute `--root` is unaffected by
either base, so the change reaches a relative `--root` typed from a subdirectory
— and a POSIX-absolute one carrying no drive letter, which on Windows picks up
the base's drive under either scheme. That distinction is not new here: it was
established today at `docs/plans/2026-09-07-ready-fourteen.md:597`, in the plan
that made the three scanners registry-relative in the first place.

`residue.js` additionally has to start resolving at all — today it hands the raw
string to every `fs` and `git` call.

### 2. Gone roots that no longer exist

`lib/station.js:46-53` says a gone root keeps its stamp forever because
*"forgetting it too would mean the page silently stops mentioning a registry the
user may still be looking for."* That reasoning covers a directory that still
exists and lost its `sessions/`. It does not cover a scratch directory that has
been deleted — which is what landed twice on 2026-09-06.

So `rememberRoots` drops a gone root only when `fs.existsSync(root)` is false.
The documented case is untouched.

### 3. `## groups` — pin it, change nothing

`scripts/ledger.js:248` is `SCAN_HEADING = '## groups'` and `:259` is
`lines.findIndex((l) => l === SCAN_HEADING)` — literal equality. No match takes
the append branch at `:260`, which writes a fresh block and leaves everything
else alone. That is exactly what the entry asks for, so the code does not change;
a test pins it, and the entry closes.

**This test passes the moment it is written.** It is a characterization test, not
a red-green one, and saying otherwise would be a false claim of a fix.

### 4. `docs-check` — document, do not build

`report()` at `:426` already emits `f.tag: f.file:f.line  f.what` for every
finding, alongside the role counts at `:404-405` rather than instead of them, and
`--quiet` at `:460` returns `''` only when the run is clean. Nothing hides a list.

What is missing is comparing two runs, and `diff` does that on output that is
already a list. No `--since` flag. The `README.md` scanner section gains the
one-line recipe.

### 5. The two archives, the bucket, and the index

- `docs/plans/2026-09-04-session-station.md` to `docs/archive/` — its work landed
  and a later plan already retired part of it.
- `docs/plans/2026-08-30-parallel-build.md` to `docs/archive/` — `lib/a.js` and
  `lib/b.js` are fixtures inside code blocks, not deliverables.
- `.fankeel/docs.json` gains a `.claude/agents` bucket with role `reference`,
  which files `brief-probe.md`, today the only undeclared markdown file.
- `TODO.md` loses the four wrong-premise entries and every entry this closes.

### 6. The two A/B pairs

`docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab3.sh` is the template, and
its provenance records 324s + 120s of shell time for a pair. Two more:

- **ab4** — the 1.85x residue advantage with the main model priced above the
  subagent's. Every main-loop turn re-reads the parent context at the main rate,
  so a wider gap should move the money figure and not the residue one.
- **ab5** — the two-source join: one reader per page, each also given the path to
  a diff. This is the shape `skills/fankeel-verify/SKILL.md:99` cites and no pair
  has run.

### 7. The citation, either way

`skills/fankeel-verify/SKILL.md:99` and `docs/subagents.md:81-85` attribute
1.5x / 1.59x / 2.77x to *"one reader per page the change plausibly touched, each
given the path to a diff file"*. The run behind those numbers
(`docs/reports/2026-09-03-dispatch-vs-inline-named.md`, its line 35) was **one**
dispatch reading seven named hook files and answering one joint classification
question — no diff, no per-page reader.

That is wrong whatever ab5 returns, so it is corrected to describe the run that
produced the figures. If ab5 measures the page-plus-diff shape, its own figure is
added as a separate citation rather than replacing this one.

### 8. The output style probe

`.claude/agents/brief-probe.md` exists to report what a subagent was handed.
Set `outputStyle` in `.claude/settings.json`, dispatch the probe, read whether
the style text appears in what it reports, revert the setting.

**Unverified:** whether Claude Code reads `outputStyle` per request or pins it at
process start. If it pins it, the probe returns a false negative and the answer
needs a fresh terminal — which the run will say rather than conclude.

## Proves it done

| piece | fails now | passes after |
|---|---|---|
| `resolveRoot` | a test invoking all eight scripts with a relative `--root` from a subdirectory of the registry root, asserting one target directory | all eight agree |
| gone roots | `rememberRoots` keeps a gone root whose directory was deleted | it drops that one and keeps a gone root that still exists |
| `## groups` | (characterization — passes on arrival) | a block under another heading survives `withScan` |
| archives, bucket, index | `docs-audit` lists both plans as landed; `map.js` reports one undeclared markdown file | both archived, and `undeclared` is zero |
| the citation | `SKILL.md:99` describes a shape no report contains | it describes the run that produced its figures |
| the whole thing | — | `npm test` green, `docs-check` exit 0, `todo-check` exit 0 |

## Against the map

`.fankeel/map.md` lists **0 pages as planned-but-not-built**, so nothing here is
designed against an intention mistaken for code.

Two current pages are contradicted by this change and are edited by it rather
than around it: `docs/subagents.md` (the 1.5x attribution) and `README.md` (the
scanner section, gaining the `diff` recipe). `docs/station.md` describes the
roots file and needs re-reading once `rememberRoots` changes — listed for
`audit`, not assumed clean.

## Scope this does not take

The 08-30 plan is unarchived because `docs-audit` reads fixture paths inside code
blocks as deliverables. **Fixing that scanner is not in this task.** Archiving
the plan closes the entry; the scanner behaviour is a separate deferral, and it
goes back into `TODO.md` as one rather than being silently carried.
