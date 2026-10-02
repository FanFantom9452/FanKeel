---
name: fankeel-upgrade
description: Bring a project up to what the installed fankeel expects — what changed since the last upgrade, which migrations are pending, and each one asked about before it runs. Use for /fankeel-upgrade, "升級 fankeel", or after updating the plugin.
disable-model-invocation: true
version: 0.92.0
status: current
last_verified: 2026-09-30
source_of_truth: scripts/upgrade.js, scripts/version.js
---

# fankeel-upgrade

After the plugin has been updated, this brings one project up to it. What is
pending is read from the project's own files, never from a version number kept
somewhere, so a project that skipped a release reads the same as one that did
not. Run, adding `--root <dir>` when the project is not the working directory:

    node <plugin>/scripts/upgrade.js

`<plugin>` is two directories up from this file. It exits 1 while a step is
pending and 0 when none is.

1. **Say what changed.** The first lines list what landed in fankeel since the
   newest upgrade report in the project's report bucket, or everything the log
   holds when there is none. `changes unavailable: …` is an installed copy with
   no git history: say so in one line and go on, it is not a failure.
2. **Say each pending step.** The check names them under `pending:` and prints
   the command for the ones a script does not run. Never run a printed command
   yourself; read it to the user and stop there.
3. **Ask once per step marked `run with --apply`.** One `AskUserQuestion` per
   step, options `run it` and `leave it`, naming the step in the question.
4. **On yes to every one, run** `node <plugin>/scripts/upgrade.js --apply` and
   say the report path it prints. On any no, do not run `--apply` — it runs
   every such step at once — and say which step was left.
5. **Say what still needs a person.** `--apply` writes the report with what ran
   and what is left; name what is left in one line and stop.

The old `scope` field needs no step: the registry reads it where it needs to,
and the script says so on every run.
