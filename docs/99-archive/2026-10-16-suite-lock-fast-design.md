---
status: current
last_verified: 2026-10-16
---

# One suite at a time on a machine, and a fast set for build and verify

On 2026-10-16 one land needed the full suite eight or nine times, because
several sessions ran `scripts/suite.js` at once on this Windows machine and a
different handful of tests failed each run — every one green alone. The full
suite is about 320 s alone. `task.js land` refuses without a green record, so
contention blocks landing directly. Two changes: suite.js runs one at a time
per machine, and the slow tests carry a tag that build and verify's run skips.

## 1. A machine-wide lock around suite.js

- `lib/suitelock.js` exports `acquire({ file, owner, onWait, pollMs, maxAgeMs })`
  and `lockFile(env)`. `lockFile` is `FANKEEL_SUITE_LOCK` when set, else
  `os.tmpdir()/fankeel-suite.lock` — one per user, and every session on this
  machine runs as that user.
- `acquire` creates the file with `fs.openSync(file, 'wx')`, writing
  `{ pid, at, tree, session, command }`, and returns a `release()` that
  deletes it only while it still holds this pid.
- When the file exists and its holder is live, `acquire` calls `onWait(holder)`
  once and retries every `pollMs` (default 2000), sleeping with `Atomics.wait`
  so the script stays synchronous.
- A holder is stale — the file is removed and the create retried — when its
  pid is not running (`process.kill(pid, 0)` throws `ESRCH`), when the file
  has not parsed for 5 s (a writer between its create and its write leaves it
  empty for a moment), or when `at` is older than `maxAgeMs` (default 60 minutes:
  a reused Windows pid must not hold the lock forever; the full suite alone is
  about 5½ minutes).
- `scripts/suite.js` takes the lock before `runSuite` and releases it in a
  `finally`; `--check` takes none. While waiting it prints one line:
  `suite: waiting — pid <pid> (session <id>) has run the suite in <tree> since <HH:MM>; lock <file>`.
- The test command runs with `FANKEEL_SUITE_HELD=<lock file>` in its env, and
  a suite.js whose lock file equals `FANKEEL_SUITE_HELD` takes no lock. Without
  this, the suite's own tests that call suite.js would wait on the run that
  spawned them, forever.
- `npm test` run by hand takes no lock; the docs say to run through suite.js.

## 2. Slow tests carry `@slow`; `test:fast` skips them

- A test, or a `describe`, whose name contains `@slow` is slow.
  `package.json` gains `"test:fast": "node --test --test-skip-pattern=@slow"`;
  `"test"` stays `node --test`, which runs everything.
- Slow means 10 s or more alone, measured from one full TAP run's
  `duration_ms` on this machine; the bench check.sh tests and the git-heavy ones
  the 2026-10-16 timings name are the expected set. The tag goes on the test
  where it is, no file moves.
- `scripts/suite.js --fast` runs package.json's `test:fast` where there is one,
  and the record carries `fast: true`. Where there is none it runs `test`,
  says so on its line, and records no `fast` — it ran everything.
- `lib/suite.js`'s `blocker` refuses a record with `fast: true`:
  `suite ran the fast set at <sha8> — land runs everything: node scripts/suite.js --session <id>`.
- A row in tests/suite.test.js pins package.json's `test` and `test:fast`
  to their literal strings, so neither changes without a red test.

## 3. Which stage runs which

- build's close and the parent's pre-commit run, verify's test row, and plan's
  brief footer run `suite.js --fast`; land runs `suite.js` with no flag, and
  `--check` refuses a fast record, so land always ends on the full set.
- `skills/fankeel-build`, `fankeel-verify`, `fankeel-plan`, `fankeel-land`,
  `lib/stages.js`'s build-close and land rules, `lib/ledger` brief footer
  where it names the suite, `docs/01-guide/development.md` and README's suite
  section say so; the 77–87 s figure there is replaced with the dated
  measurement this build makes.

## Testing

- Lock, red then green: with `FANKEEL_SUITE_LOCK` pointing at a scratch file
  held by a live pid, suite.js prints `waiting` and has not finished after
  1 s; deleting the file lets it finish green. A held file naming a dead pid,
  or `at` past `maxAgeMs`, lets it run at once. `FANKEEL_SUITE_HELD` equal to
  the lock file skips the wait.
- Fast, red then green: in a fixture whose package.json has `test` and
  `test:fast`, `suite.js --fast` runs `test:fast` and records `fast: true`;
  `blocker` refuses that record and accepts the next full one.
- `npm test` green with `FANKEEL_BROWSER` set to chrome.exe's full path.
