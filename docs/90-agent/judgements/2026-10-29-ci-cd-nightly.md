---
judged: 2026-10-29T18:29:21.944Z
model: fable
agent: fankeel-judge
task: "評估 fankeel 是否支援 CI/CD 與 Gitea nightly build"
session: bbac9d48-ff67-4add-a917-0716b477e67e
stage: survey
---

# Brief 45 — should fankeel support CI/CD or a Gitea nightly build?

## Question

# Brief 45 — should fankeel support CI/CD or a Gitea nightly build?

## The question

The user's professors (the lab fankeel is used in) habitually run CI/CD or a
nightly build on a self-hosted Gitea. The user personally does not like
working that way. Should fankeel add something for it — and if so, what is
the smallest thing worth adding?

The user's words: 「這個 SKILL 是不是可以走 CI CD? 因為我們教授習慣走 CI CD 或是
NIGHTLY BUILD 在 GITEA 上面那種感覺 但是我自己不喜歡這樣 我們要加入這個功能嘛?」

There are two readings; answer both, then pick:

- **Reading 1 — fankeel's own repository gets CI.** A Gitea Actions (or
  Drone/Woodpecker) workflow that runs fankeel's test suite on push or nightly.
- **Reading 2 — fankeel supports the projects it manages having CI.** For a
  lab project whose professor runs Gitea CI or a nightly build, fankeel's
  stages would know about it: e.g. land reads the CI result for the pushed
  commit, or `fankeel-init` writes a workflow file, or a nightly job runs the
  suite and files a report.

## Options

- **A — add nothing.** The local `suite.js` gate at land already is the CI;
  a lab project that wants Gitea CI writes its own workflow file, fankeel
  stays out of it.
- **B — fankeel's own repo only.** A workflow under `.gitea/workflows/`
  running `npm test` (fast suite) nightly or on push; nothing in the skills
  changes.
- **C — a thin hook for managed projects.** Land, when the profile has
  `land.push` true and the remote is Gitea/GitHub, reads the CI status of
  the pushed sha and puts it on the report's `suite:` line — read-only, never
  generates workflows.
- **D — full support.** `fankeel-init` offers to write a CI workflow, land
  waits on CI, a nightly job runs suite + evals and files a report.

## Background

- fankeel is a Claude Code plugin (Node, `node --test`, no dependencies) that
  runs tasks through survey/design/plan/build/verify/land. It is used by one
  person on one Windows machine; `land.push` is false in this repo's profile
  and there is no remote CI today (no `.github/` or `.gitea/` directory).
- The suite gate lives in `scripts/suite.js` / `lib/suite.js`: land refuses
  to record an integration without a green suite record at a sha no code has
  changed since. Some tests need a real Chrome (`FANKEEL_BROWSER`), which a
  CI runner may not have.
- Evals (`docs/90-agent/reference/evals.md`) cost money per run and are
  deliberately never run in CI.
- Land's integration options are merge / pr / keep (`skills/fankeel-land/SKILL.md`
  section 6–7); `pr` pushes.
- The user dislikes CI/CD workflows personally, but the professors expect to
  see something like it. A weekly report for the professors already exists
  (`skills/fankeel-weekly/SKILL.md`) — it may already be the thing the
  professors actually want to see.

## Paths to read

- `package.json` (test scripts)
- `scripts/suite.js`, `lib/suite.js` (the local gate)
- `skills/fankeel-land/SKILL.md` (sections 1, 6, 7)
- `skills/fankeel-weekly/SKILL.md`
- `skills/fankeel-init/SKILL.md`
- `docs/01-guide/development.md`
- `docs/90-agent/reference/evals.md`
- `docs/02-architecture/pipeline.md`
- `.fankeel/profile.json` and `lib/profile*.js` (land.push, land.integration)

## What counts as an answer

A pick among A–D (or a narrower variant), with: what the professors would
actually see under it, what it costs the user day to day given they dislike
CI, which tests could not run on a stock Gitea runner (Chrome-dependent ones),
and the files it would touch. If the honest answer is "the weekly report
already covers what the professors want", say so.

## Shape

The six fields, then `## 白話` (≤600 characters, 繁體中文), then `## Summary`.

html: yes

## Answer

pick: A — add nothing to fankeel; the land suite gate already is the CI, and the weekly report already is the artifact the professors read. (If a professor later asks for a green light, the lab project writes its own ~15-line workflow; fankeel stays out.)
why: Land refuses to integrate without a green, full, current-sha suite record (lib/suite.js:251-266; skills/fankeel-land/SKILL.md:95-99) — earlier and stricter than a nightly re-run.
The professors never see the land report; their one artifact is the weekly HTML (skills/fankeel-weekly/SKILL.md:12-13, :154-155), so C's `suite:` line (SKILL.md:439) would reach only the user.
fankeel's remote is GitHub, not Gitea, `land.push` is false (.fankeel/profile.json:2-3), no `.gitea/`/`.github/` exists; the suite is measured only on Windows with FANKEEL_BROWSER set (docs/01-guide/development.md:21-25).
Browser tests self-skip without Chromium (tests/render-cli.test.js:82-84), so B/D would run — but evals are barred from CI by design (docs/90-agent/reference/evals.md:61-65), which caps D, and every option but A adds a red-mail stream the user dislikes triaging.
would flip if: a professor asks for a per-commit green signal on a fankeel-managed lab project, not the narrative — then the narrower C: one read-only line after the PR push (skills/fankeel-land/SKILL.md:410) or a "tests passing @ sha" line in the weekly collector.
unread: nothing the brief named; not opened: scripts/weekly.js and lib/weekly-collect.js (not named), tests/tour-page.test.js's skip path, and no Linux run of the suite exists to check.
delegated: package.json + docs/01-guide/development.md (sonnet); scripts/suite.js + lib/suite.js (sonnet); skills/fankeel-land/SKILL.md §1/6/7 (opus); skills/fankeel-weekly/SKILL.md (opus); skills/fankeel-init/SKILL.md (sonnet); docs/90-agent/reference/evals.md + docs/02-architecture/pipeline.md (sonnet); .fankeel/profile.json + lib/profile.js + git remote/dir checks (sonnet).
checklist: 1 package.json test scripts — answered (two tiers, :11-12). 2 development.md tiers/Chrome/CI — answered (no CI mention; Chrome only in the timing note :22). 3 scripts/suite.js record and flags — answered (:6, :23-25, :61-65). 4 lib/suite.js blocker and browser handling — answered (:251-266; never names FANKEEL_BROWSER). 5 land SKILL §1/6/7 — answered (:66-68, :346-348, :361-363, :410-411, :439). 6 weekly SKILL audience and content — answered (:12-13, :68-79, :154-155; no test line). 7 init SKILL writes/CI — answered (no CI; `gh repo view` only, :138-140). 8 evals.md never-in-CI — answered (:61-65). 9 pipeline.md stage order and suite placement — answered (:106, :765-767). 10 profile.json + lib/profile.js land.* and remote — answered (:2-4; lib/profile.js:20-21, :482-486; remote = GitHub; no CI dirs).

## 白話

建議不加：fankeel 本身不用為此多做任何功能，教授那邊靠現有的週報就夠。
打個比方：教授習慣的做法是「每晚派人把整間房重新巡一遍」；fankeel 則是「每次要把東西搬進屋前，當場整套檢查完，有一處紅燈就不准搬」，比夜巡更早、也更嚴。再架一條夜間流程，只是把同一份考卷拿到一台沒裝 Chrome 的機器上重考，考壞了還半夜寄信給您——正是您不喜歡的那種負擔。
教授真正想知道的是「這週做了什麼、專案健不健康」：週報已經用中文寫給他們，只差一句「測試全綠」。哪天教授真的要看綠燈，最省的做法是在實驗室專案自己放一個十來行的 Gitea workflow 跑快速測試（要瀏覽器的測試會自動略過），fankeel 一行都不必改。
至於要花錢、要登入的評測，文件本來就寫明不進 CI。

## Summary

### What each reader found

**package.json + development.md (sonnet).** Two test tiers only: `test` (everything) and `test:fast` (`--test-skip-pattern=@slow`), F:/ymlab/fankeel/package.json:11-12. No script names a browser. F:/ymlab/fankeel/docs/01-guide/development.md:21-25 gives the only timing: 274 s / 4416 tests for the whole suite, 216 s / 4289 for fast, measured on Windows 11 with `FANKEEL_BROWSER` set; :27-31 says `@slow` marks 129 test points of 10 s or more; :35-37 says build and verify run `suite.js --fast` and land refuses a fast record. CI, nightly, Gitea, GitHub Actions: not mentioned anywhere on the page. `git grep -l FANKEEL_BROWSER -- tests lib scripts` lists 6 test files and 2 scripts (render.js, tour-record.js), none in lib/.

**scripts/suite.js + lib/suite.js (sonnet).** The record is `{ sha, at, command, pass, fail, failed, ok, ms, runs }` plus `fast: true` under `--fast`, written to `.fankeel/build/task-<started>/suite.json` (F:/ymlab/fankeel/lib/suite.js:6-10, :183, :209). `blocker()` is what `task.js land` consults: no record, a red record, a fast record, or any non-`.md` file changed since the record's sha each stop land (lib/suite.js:245-266). Neither file mentions FANKEEL_BROWSER, CI, nightly, GitHub, Gitea or a remote runner; the only coordination is the machine-wide local lock (scripts/suite.js:25-28). Usage: `node scripts/suite.js --session <id> [--command] [--root] [--tree] [--check] [--fast] [--coverage]` (scripts/suite.js:6) — `--session` is mandatory and an active entry must exist (:55, :59), which matters: the gate is built to run inside a fankeel session, not from a cron.

**skills/fankeel-land/SKILL.md (opus).** §1: `suite: record stands @ <sha>` is the `suite:` line (:66-68); "Red stops everything … `task.js land` in step 6 will not record an integration without a green record at a sha no code has changed since" (:95-99); a fast record is refused (:77-78). §6: menu is merge / "Push and create a Pull Request" / keep (:346-348); `task.js land merge|pr|keep [--push|--no-push]`, "`pr` … always pushes" (:361-363). §7: merge re-runs the suite on the merged result before any push (:377-380); PR is "push, open it against the base, report the URL" (:410-411). The Output block carries `suite: <suite.js line>` (:439, :444-445). No mention of CI, check run, pipeline, GitHub or Gitea anywhere in the file; `land.integration` / `land.push` only pick the menu answer (:338-341, :372-373). Headings: §1 :39, §6 :336, §7 :375, Output :428.

**skills/fankeel-weekly/SKILL.md (opus).** "A report for two professors: what was done in a date range, across the repositories the user picks, as one HTML page that can be mailed on its own" (:12-13); "the report is the professors' only" (:154-155). Content is projects, taglines, events (title/repo/status/did/why/next/evidence), an architecture paragraph, a 2-3 thread summary, carry-over verdicts and next week's list (:68-79, :85-127). Evidence is record dates or a commit range (:117-118). No suite/test result, pass count or "green at sha" anywhere; no CI/nightly/Gitea/GitHub/push/remote. Triggered by hand (:3), written in plain Traditional Chinese (:14-15, :97-99), internal words banned (:100-101).

**skills/fankeel-init/SKILL.md (sonnet).** Init writes the profile through presets, `.fankeel/sensitive.txt`, `docs.json`, moved docs pages, a TODO bucket, the directory tree, and CLAUDE.md edits after approval (:48-66, :141-142, :157-164, :171-192, :199-202). No CI workflow, `.gitea/`, `.github/`, nightly or runner config is mentioned. The only remote-aware line is `gh repo view --json visibility` for the sensitive-word recommendation (:138-140) — GitHub-only, not stored. `land.*` come from the preset or from history (:55-57, :61-62).

**evals.md + pipeline.md (sonnet).** "## Not run in CI" — "Every run here spends real money through `claude -p`, and a CI job would need a login credential of its own to make that call. So these run only by hand, before a release — never wired into CI" (F:/ymlab/fankeel/docs/90-agent/reference/evals.md:61-65); no dollar figure, cost read off `total_cost_usd` per run (:43). Pipeline: seven stages, `land` last (F:/ymlab/fankeel/docs/02-architecture/pipeline.md:106, :891); the suite is land's first step, "the menu comes after a green run" (:765-767), re-run after merge (:776); nothing after land but the record write and the phone hold (:814-820, :284); "a push to a shared branch, a publish" is a stop-and-ask (:640); the weekly report is not in the pipeline at all.

**profile.json + lib/profile.js + repo checks (sonnet).** F:/ymlab/fankeel/.fankeel/profile.json:2-4 — `land.integration: merge`, `land.push: false`, `land.archivePlan: true`; no ci/nightly/schedule key. F:/ymlab/fankeel/lib/profile.js:20-21 — `land.integration` takes merge|pr|keep, `land.push` true|false, builtin null (menu asked when unset); :482-486 infers `land.push` false when there is no remote or 3+ unpushed commits, true when a remote exists and 0 unpushed. No CI key; `station.remote` (:47-48) is Tailscale, unrelated. `git remote -v`: origin = https://github.com/FanFantom9452/FanKeel.git — GitHub, not Gitea. `.github`, `.gitea`, `.woodpecker*`, `.drone*`: none exist. 26 files match gitea/github actions/nightly case-insensitively, 18 of them archive or evidence JSON; the reader did not open the 8 live hits, so whether any discusses CI is unchecked.

### Spot-checks

Every cited span said what its reader said: package.json:11-12; development.md:21-37; lib/suite.js:244-267; land SKILL.md:408-413 and :436-445; weekly SKILL.md:10-15 and :152-155; init SKILL.md:136-141; evals.md:60-65; lib/profile.js:480-487. One gap the readers flagged — what browser tests do when Chrome is absent — I closed with a grep: F:/ymlab/fankeel/tests/render-cli.test.js:82-84, :106-108, :152-154 call `t.skip('no Chromium-family browser on this machine …')` when `findBrowser()` returns nothing; the other FANKEEL_BROWSER references in render-cli/render-act/render-look point the variable at a fake path or at node itself with `FANKEEL_NO_FALLBACK=1`, so they run without a browser. memory-check.test.js:288-289 only seeds a note string. I did not open tour-page.test.js or tour-promo30-page.test.js to confirm they skip the same way.

### Answering the brief's four parts

**Reading 1 — fankeel's own repo gets CI (option B).** Feasible: `npm run test:fast` on a stock Linux runner would run with the Chromium tests skipped. But fankeel's remote is GitHub, so a `.gitea/workflows/` file does nothing unless the repo is mirrored to the lab Gitea; the professors would see a run log on a repository they do not otherwise read; the suite has never been run on Linux (the only measurement is Windows, development.md:21-22), so the first weeks would be red for platform reasons rather than defects; and every red run becomes a mail the user must open. Files: one `.github/workflows/test.yml` (or `.gitea/…` after a mirror), optionally a paragraph in development.md. Worth adding only when someone asks for it; not worth adding unasked.

**Reading 2 — fankeel supports managed projects having CI (C / D).** Today fankeel is host-blind: the only host-specific call in any skill is `gh repo view` in init (SKILL.md:138), and land's PR step says "push, open it against the base" without naming a host (SKILL.md:410). C would mean teaching fankeel the Gitea and GitHub status APIs, inserting a read after the push at SKILL.md:410 (PR) or :384 (merge with push), and widening the `suite:` line at :439 — plus tests. Its output lands on a report only the user reads, and in this repo `land.push` is false, so the hook would never fire here. D adds an init step, profile keys, a land wait, and a nightly job — and the nightly's most valuable half, the evals, is barred by evals.md:61-65 (cost and credential). D also makes land wait on a remote, which is the workflow the user said they dislike.

**What the professors would actually see.** Under A: the weekly HTML, in Chinese, listing what landed and why — the narrative half of what a CI dashboard gives. Under B: a badge/run log on GitHub (not their Gitea). Under C: nothing — the `suite:` line is in the user's land report. Under D: a workflow file in their project, a nightly report file, and a land that waits. The thing a nightly build gives a professor that the weekly lacks is the one line "tests green at <sha>". If that is ever asked for, the cheapest place to put it is the weekly report (whose inputs are already fankeel records per repo, weekly SKILL.md:56-61) or the lab project's own workflow — not fankeel's stages.

**Cost to the user.** A: zero. B: one file, one runner to keep alive, plus red-mail triage for Linux-only failures. C: Gitea+GitHub API code, a token per host, and a read that in this repo never fires. D: all of C plus an init step, a scheduler, and a land that blocks on a remote.

**Tests a stock Gitea runner could not run.** The Chromium-needing cases in tests/render-cli.test.js (:81, :105, :151 and siblings) skip cleanly; render-act, render-look, tour-page and tour-promo30-page reference FANKEEL_BROWSER and presumably follow the same `findBrowser()` pattern, unverified for the two tour files. The `@slow` bench `check.sh` tests need a POSIX shell (fine on Linux). Unknown and unverifiable from here: Windows-path assumptions elsewhere in 4416 tests — no Linux run exists.

**Verdict.** fankeel already runs a full-suite gate at the exact moment integration happens and refuses on red, fast, or stale — a stricter guarantee than a nightly. The professors' artifact already exists and is deliberately theirs alone. Adding CI plumbing to fankeel would duplicate the gate on a machine without Chrome, cannot include the evals, would be invisible to the professors under C, and runs against the user's own stated preference. A.

Not done: no `context.js add` (no session id was given in the brief or dispatch); no chartroom board (format not checked, and the pick does not turn on a figure).
