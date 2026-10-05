#!/usr/bin/env bash
# docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh
# The fankeel-brain stage agent on opus against sonnet (TODO model-3).
#
# Held: the task (plain-1's three items), the start sha BASE, the route
# plan,build,verify, the project profile at BASE, the controller's model and
# every flag. The one difference: `agent.fankeel-brain.model`, set with
# `task.js profile set` and committed in each run's own worktree before the
# run, so the brain on build and verify runs on the arm's model. The plan
# stage's brain is sent `model: opus` by the controller rule in lib/stages.js
# in both arms, so plan is held as well. tally.js checks, run by run, that the
# brains really ran on the arm's model.
#
# RUNS rounds of both arms, opus first in odd rounds and sonnet first in even
# ones. Each run is capped at CAP dollars through --max-budget-usd, the cap
# shrinking by what the run has spent (the largest cumulative total so far).
# Transcripts are copied to $WORK/raw, which is gitignored; summary.json and
# the per-stage json go in this directory.
#
# usage: BASE=<sha> [RUNS=3] [CAP=25] [DRY=1] bash ab.sh   (DRY=1 runs no claude)
set -u

REPO="F:/ymlab/fankeel"
BASE="${BASE:?BASE=<the plan commit sha> is required}"
RUNS="${RUNS:-3}"
CAP="${CAP:-25}"
DRY="${DRY:-}"
EVID="$REPO/docs/90-agent/reports/evidence/2026-10-05-brain-model-ab"
WORK="$REPO/.fankeel/build/2026-10-05-brain-model-ab"
CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
TASK="做 docs/90-agent/todo/plain-1.md 列的三項：讀 TODO 失敗要出聲、2800 毫秒門檻要有測試固定、四組新測試要有回復修改後變紅的證明。"
ROUTE="plan,build,verify"
STAGES=(plan build verify)

mkdir -p "$EVID" "$WORK/raw"
cd "$REPO" || exit 1
LOG="$EVID/provenance.txt"
logcmd () { printf '$'; printf ' %q' "$@"; printf '\n'; }
spent () { node -e 'const fs=require("fs");let s=0;for(const f of process.argv.slice(2)){let t;try{t=fs.readFileSync(f,"utf8")}catch(e){continue}try{s=Math.max(s,JSON.parse(t).total_cost_usd||0)}catch(e){fs.appendFileSync(process.argv[1],"unparseable stage json: "+f+"
")}}console.log(s.toFixed(4))' "$LOG" "$@"; }

{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "BASE: $BASE"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
  echo "ab.sh md5: $(md5sum "$EVID/ab.sh" | cut -d' ' -f1)"
  echo "tally.js md5: $(md5sum "$EVID/tally.js" | cut -d' ' -f1)"
  echo "RUNS: $RUNS  CAP per run: $CAP  DRY: ${DRY:-no}"
} >> "$LOG"

run () {
  local tag="$1" model="$2"
  local wt="$WORK/wt-$tag"
  local U; U=$(node -e "console.log(require('crypto').randomUUID())")
  echo "--- $tag model=$model worktree=$wt session $U" >> "$LOG"

  if [ -z "$DRY" ]; then
    git worktree add --detach "$wt" "$BASE" >> "$LOG" 2>&1 || { echo "$tag: worktree failed" >> "$LOG"; return 1; }
    mkdir -p "$wt/.fankeel/sessions"
    (cd "$wt" && node scripts/task.js profile set agent.fankeel-brain.model "$model" >> "$LOG" 2>&1)
    grep -q "^model: $model\$" "$wt/.claude/agents/fankeel-brain.md" \
      || { echo "$tag: .claude/agents/fankeel-brain.md does not pin $model — abort" >> "$LOG"; git worktree remove --force "$wt" >> "$LOG" 2>&1; return 1; }
    (cd "$wt" && git add -f .claude/agents/fankeel-brain.md && { git add -f .fankeel/profile.json 2>/dev/null; true; } \
      && git -c user.name=ab -c user.email=ab@localhost commit -q -m "ab: pin fankeel-brain to $model") >> "$LOG" 2>&1
    echo "$tag pin commit: $(git -C "$wt" rev-parse HEAD)" >> "$LOG"
  fi

  local common=(--setting-sources project --plugin-dir "$wt" --permission-mode bypassPermissions --model opus --output-format json)
  local c1=(claude -p "Run this command and report its output, nothing else: node scripts/task.js start --session $U --task \"$TASK\" --route $ROUTE" --session-id "$U" "${common[@]}")
  logcmd "${c1[@]}" >> "$LOG"
  [ -z "$DRY" ] && (cd "$wt" && "${c1[@]}" > "$EVID/$tag-start.json" 2> "$EVID/$tag-start.err")

  local i next left t0 rc prompt
  for i in "${!STAGES[@]}"; do
    next="${STAGES[$((i+1))]:-}"
    prompt="Do the ${STAGES[$i]} stage of this task. There is no user in this run: at the stage's gate do not call AskUserQuestion — take option one yourself"
    if [ -n "$next" ]; then prompt="$prompt, run node scripts/task.js stage $next --session $U, and stop."; else prompt="$prompt and stop."; fi
    left=$(node -e "console.log(Math.max(0, $CAP - $(spent "$EVID/$tag"-*.json)).toFixed(2))")
    if [ -z "$DRY" ] && [ "$(node -e "console.log($left < 1 ? 1 : 0)")" = 1 ]; then
      echo "$tag over budget before ${STAGES[$i]} (left $left)" >> "$LOG"; break
    fi
    local c2=(claude -p "$prompt" --resume "$U" --max-budget-usd "$left" "${common[@]}")
    logcmd "${c2[@]}" >> "$LOG"
    if [ -z "$DRY" ]; then
      t0=$(date +%s)
      (cd "$wt" && "${c2[@]}" > "$EVID/$tag-${STAGES[$i]}.json" 2> "$EVID/$tag-${STAGES[$i]}.err")
      rc=$?
      echo "$t0 $(date +%s)" > "$EVID/$tag-${STAGES[$i]}.wall"
      echo "$tag ${STAGES[$i]} exit=$rc spent so far $(spent "$EVID/$tag"-*.json)" >> "$LOG"
    fi
  done

  if [ -z "$DRY" ]; then
    (cd "$wt" && git log --oneline "$BASE"..HEAD && git diff "$BASE" --stat && git status --porcelain) > "$EVID/$tag-diff.txt" 2>&1
    mkdir -p "$WORK/raw/$tag"
    local tr; tr=$(ls "$CFG"/projects/*/"$U".jsonl 2>/dev/null | head -1)
    if [ -n "$tr" ]; then
      cp "$tr" "$WORK/raw/$tag/"
      [ -d "${tr%.jsonl}" ] && cp -r "${tr%.jsonl}" "$WORK/raw/$tag/"
    else
      echo "$tag: no transcript for session $U under $CFG/projects" >> "$LOG"
    fi
    [ -d "$wt/.fankeel/build" ] && cp -r "$wt/.fankeel/build" "$WORK/raw/$tag/build"
    git worktree remove --force "$wt" >> "$LOG" 2>&1 || echo "$tag: worktree remove failed, left at $wt" >> "$LOG"
  fi
}

for r in $(seq 1 "$RUNS"); do
  if [ $((r % 2)) -eq 1 ]; then order=(opus sonnet); else order=(sonnet opus); fi
  for m in "${order[@]}"; do run "r$r-$m" "$m"; done
done

[ -z "$DRY" ] && node "$EVID/tally.js" "$EVID" "$WORK/raw" > "$EVID/summary.json" 2>> "$LOG"
echo "porcelain after: $(git status --porcelain | wc -l) lines" >> "$LOG"
echo "done" >> "$LOG"
