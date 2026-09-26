#!/usr/bin/env bash
# `docs/reports/evidence/2026-09-26-ab-profile-pin/ab.sh`
# docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh with one change:
# each arm's stage.agents is committed in its worktree by pin.sh, not only
# written. On 09-25 the value was written and never committed, and the sonnet
# arm's self-dispatched brain ran `git stash push -u` / `git stash drop`, which
# took it back to BASE's mid-run. The old script stays where it is: its
# directory is a report's evidence, written once.
#
#   opus:   --model opus
#   sonnet: --model sonnet
#
# Held: the task (TODO's todo-check line-number entry), the start sha, the route
# design,plan,build,verify, stage.agents false in both worktrees (committed),
# the survey report as input, and every flag. Each arm is capped at CAP dollars
# through --max-budget-usd on every call, the cap shrinking by what the arm has
# spent. DRY=1 prints the commands and runs no claude.
# Not re-run yet: a run waits on the user approving its cost (TODO.md, ## Waiting).
set -u

REPO="F:/ymlab/fankeel"
BASE="9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4"
EVID="$REPO/docs/reports/evidence/2026-09-26-ab-profile-pin"
OLD="$REPO/docs/reports/evidence/2026-09-25-controller-multiplier"
WORK="$REPO/.fankeel/build/2026-09-26-ab-profile-pin"
SURVEY="$REPO/.fankeel/build/task-20260925T000100/survey.md"
CAP="${CAP:-62.50}"
DRY="${DRY:-}"
TASK="todo-check 不驗 path:line 的行號：改成不存在的行仍然 exit 0（scripts/todo-check.js）。survey 已做完，報告在 .fankeel/build/survey.md。"
ROUTE="design,plan,build,verify"
STAGES=(design plan build verify)

mkdir -p "$EVID" "$WORK"
cd "$REPO" || exit 1
LOG="$EVID/provenance.txt"
logcmd () { printf '$'; printf ' %q' "$@"; printf '\n'; }
spent () { node -e 'let s=0;for(const f of process.argv.slice(1)){try{s+=JSON.parse(require("fs").readFileSync(f,"utf8")).total_cost_usd||0}catch{}}console.log(s.toFixed(4))' "$@"; }

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "BASE: $BASE"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
  echo "ab.sh md5: $(md5sum "$EVID/ab.sh" | cut -d' ' -f1)"
  echo "pin.sh md5: $(md5sum "$EVID/pin.sh" | cut -d' ' -f1)"
  echo "CAP per arm: $CAP  DRY: ${DRY:-no}"
} > "$LOG"

arm () {
  local name="$1" model="$2"
  local wt="$WORK/wt-$name"
  local pin=""
  local U; U=$(node -e "console.log(require('crypto').randomUUID())")
  echo "--- $name model=$model worktree=$wt session $U" >> "$LOG"

  if [ -z "$DRY" ]; then
    git worktree add --detach "$wt" "$BASE" >> "$LOG" 2>&1 || { echo "worktree failed" >> "$LOG"; return 1; }
    mkdir -p "$wt/.fankeel/sessions"
    mkdir -p "$wt/.fankeel/build" && cp "$SURVEY" "$wt/.fankeel/build/survey.md"
    pin=$(bash "$EVID/pin.sh" "$wt" false 2>> "$LOG" | tail -n 1)
    [ -n "$pin" ] \
      || { echo "pin.sh failed in $wt — abort" >> "$LOG"; git worktree remove --force "$wt" >> "$LOG" 2>&1; return 1; }
    echo "pinned: stage.agents false at $pin" >> "$LOG"
    (cd "$wt" && node scripts/task.js profile show | grep '^  stage.agents' >> "$LOG")
    (cd "$wt" && node scripts/task.js profile show | grep -q '^  stage.agents  *false ') \
      || { echo "stage.agents is not false in $wt — abort" >> "$LOG"; git worktree remove --force "$wt" >> "$LOG" 2>&1; return 1; }
  fi

  local common=(--setting-sources project --plugin-dir "$wt" --permission-mode bypassPermissions --model "$model" --output-format json)
  local c1=(claude -p "Run this command and report its output, nothing else: node scripts/task.js start --session $U --task \"$TASK\" --route $ROUTE" --session-id "$U" "${common[@]}")
  logcmd "${c1[@]}" >> "$LOG"
  [ -z "$DRY" ] && (cd "$wt" && "${c1[@]}" > "$EVID/$name-start.json" 2> "$EVID/$name-start.err")

  local i next left
  for i in "${!STAGES[@]}"; do
    next="${STAGES[$((i+1))]:-}"
    local prompt="Do the ${STAGES[$i]} stage of this task. There is no user in this run: at the stage's gate do not call AskUserQuestion — take option one yourself"
    if [ -n "$next" ]; then prompt="$prompt, run node scripts/task.js stage $next --session $U, and stop."; else prompt="$prompt and stop."; fi
    left=$(node -e "console.log(Math.max(0, $CAP - $(spent "$EVID/$name"-*.json)).toFixed(2))")
    if [ -z "$DRY" ] && [ "$(node -e "console.log($left < 1 ? 1 : 0)")" = 1 ]; then
      echo "$name over budget before ${STAGES[$i]} (left $left)" >> "$LOG"; break
    fi
    local c2=(claude -p "$prompt" --resume "$U" --max-budget-usd "$left" "${common[@]}")
    logcmd "${c2[@]}" >> "$LOG"
    if [ -z "$DRY" ]; then
      (cd "$wt" && "${c2[@]}" > "$EVID/$name-${STAGES[$i]}.json" 2> "$EVID/$name-${STAGES[$i]}.err")
      echo "${STAGES[$i]} exit=$? spent so far $(spent "$EVID/$name"-*.json)" >> "$LOG"
    fi
  done

  if [ -z "$DRY" ]; then
    (cd "$wt" && git diff "$pin" --stat && git status --porcelain) > "$EVID/$name-diff.txt" 2>&1
    (cd "$wt" && git diff "$pin") > "$EVID/$name.patch" 2>&1
    git worktree remove --force "$wt" >> "$LOG" 2>&1
  fi
}

arm opus   opus
arm sonnet sonnet

[ -z "$DRY" ] && node "$OLD/summarise.js" "$EVID" > "$EVID/summary.json" 2>> "$LOG"
echo "porcelain after: $(git status --porcelain | wc -l) lines" >> "$LOG"
echo "done" >> "$LOG"
