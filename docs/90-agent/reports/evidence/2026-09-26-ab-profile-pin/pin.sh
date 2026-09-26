#!/usr/bin/env bash
# `docs/reports/evidence/2026-09-26-ab-profile-pin/pin.sh`
# Pin stage.agents in an A/B worktree by committing it, not only writing it.
# On 09-25 the value was written and never committed, and a self-dispatched
# stage agent's `git stash push -u` / `git stash drop` took it back to BASE's.
#
#   pin.sh <worktree> <value>    prints, last, the sha that holds the pin
#
# TASK_JS names the task.js to run; the worktree's own copy by default.
set -eu
wt="${1:?usage: pin.sh <worktree> <value>}"
value="${2:?usage: pin.sh <worktree> <value>}"
task="${TASK_JS:-$wt/scripts/task.js}"

node "$task" profile set stage.agents "$value" --root "$wt" >&2
git -C "$wt" add .fankeel/profile.json
git -C "$wt" diff --cached --quiet -- .fankeel/profile.json \
  || git -C "$wt" commit -q -m "ab: pin stage.agents $value" -- .fankeel/profile.json
git -C "$wt" rev-parse HEAD
