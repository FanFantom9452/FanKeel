#!/usr/bin/env bash
# docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh
# build and verify under a stage agent, against the same two stages in the
# main session (the 2026-10-09 workflow review's first recommendation). Based
# on 2026-10-05-brain-model-ab/ab.sh — worktree per run, the arm's profile
# committed in it by 2026-09-26-ab-profile-pin/pin.sh, CAP per run, DRY,
# alternating arm order, transcripts copied — with one differing key:
#
#   main:    stage.agents false
#   agents:  stage.agents build,verify
#
# Held: TASK, BASE, the route design,plan,build,verify, SURVEY copied in as
# the survey report, MODEL for the controller in both arms, every flag.
#
# Judged before it runs (README.md beside this file): build and verify go
# back on stage.agents only if the agents arm's controller peak context
# (node scripts/ctx.js <session> --by-stage) is at least 30% below the main
# arm's AND its cost (summary) is at most 1.1x. n=1 per arm by default, so
# the rule leans to "not proven, not opened".
#
# usage: BASE=<sha> TASK="…" SURVEY=<survey.md> [MODEL=opus] [CAP=30] [RUNS=1] [DRY=1] [OUT=<dir>] bash ab.sh
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${BASE:?BASE=<sha> is required}"
TASK="${TASK:?TASK=<one line> is required}"
SURVEY="${SURVEY:?SURVEY=<path to the survey report> is required}"
MODEL="${MODEL:-opus}"
CAP="${CAP:-30}"
RUNS="${RUNS:-1}"
DRY="${DRY:-}"
OUT="${OUT:-$HERE}"
WORK="$REPO/.fankeel/build/2026-10-09-build-verify-ab"
CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PIN="$REPO/docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/pin.sh"
ROUTE="design,plan,build,verify"
STAGES=(design plan build verify)

mkdir -p "$OUT" "$WORK/raw"
cd "$REPO" || exit 1
LOG="$OUT/provenance.txt"
logcmd () { printf '$'; printf ' %q' "$@"; printf '\n'; }
spent () { node -e 'const fs=require("fs");let s=0;for(const f of process.argv.slice(2)){let t;try{t=fs.readFileSync(f,"utf8")}catch(e){continue}try{s=Math.max(s,JSON.parse(t).total_cost_usd||0)}catch(e){fs.appendFileSync(process.argv[1],"unparseable stage json: "+f+"\n")}}console.log(s.toFixed(4))' "$LOG" "$@"; }

{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "BASE: $BASE"
  echo "MODEL: $MODEL  RUNS: $RUNS  CAP per run: $CAP  DRY: ${DRY:-no}"
  echo "ab.sh md5: $(md5sum "$HERE/ab.sh" | cut -d' ' -f1)"
} >> "$LOG"

run () {
  local tag="$1" value="$2"
  local wt="$WORK/wt-$tag"
  local U; U=$(node -e "console.log(require('crypto').randomUUID())")
  echo "--- $tag worktree=$wt session $U" >> "$LOG"
  echo "arm $tag stage.agents=$value" >> "$LOG"

  if [ -z "$DRY" ]; then
    git worktree add --detach "$wt" "$BASE" >> "$LOG" 2>&1 || { echo "$tag: worktree failed" >> "$LOG"; return 1; }
    mkdir -p "$wt/.fankeel/sessions" "$wt/.fankeel/build"
    cp "$SURVEY" "$wt/.fankeel/build/survey.md"
    local pin; pin=$(bash "$PIN" "$wt" "$value" 2>> "$LOG" | tail -n 1)
    [ -n "$pin" ] || { echo "$tag: pin.sh failed — abort" >> "$LOG"; git worktree remove --force "$wt" >> "$LOG" 2>&1; return 1; }
    echo "$tag pin commit: $pin" >> "$LOG"
    (cd "$wt" && node scripts/task.js profile show | grep '^  stage.agents' >> "$LOG")
  fi

  local common=(--setting-sources project --plugin-dir "$wt" --permission-mode bypassPermissions --model "$MODEL" --output-format json)
  local c1=(claude -p "Run this command and report its output, nothing else: node scripts/task.js start --session $U --task \"$TASK\" --route $ROUTE" --session-id "$U" "${common[@]}")
  logcmd "${c1[@]}" >> "$LOG"
  [ -z "$DRY" ] && (cd "$wt" && "${c1[@]}" > "$OUT/$tag-start.json" 2> "$OUT/$tag-start.err")

  local i next left t0 rc prompt
  for i in "${!STAGES[@]}"; do
    next="${STAGES[$((i+1))]:-}"
    prompt="Do the ${STAGES[$i]} stage of this task. There is no user in this run: at the stage's gate do not call AskUserQuestion — take option one yourself"
    if [ -n "$next" ]; then prompt="$prompt, run node scripts/task.js stage $next --session $U, and stop."; else prompt="$prompt and stop."; fi
    left=$(node -e "console.log(Math.max(0, $CAP - $(spent "$OUT/$tag"-*.json)).toFixed(2))")
    if [ -z "$DRY" ] && [ "$(node -e "console.log($left < 1 ? 1 : 0)")" = 1 ]; then
      echo "$tag over budget before ${STAGES[$i]} (left $left)" >> "$LOG"; break
    fi
    local c2=(claude -p "$prompt" --resume "$U" --max-budget-usd "$left" "${common[@]}")
    logcmd "${c2[@]}" >> "$LOG"
    if [ -z "$DRY" ]; then
      t0=$(date +%s)
      (cd "$wt" && "${c2[@]}" > "$OUT/$tag-${STAGES[$i]}.json" 2> "$OUT/$tag-${STAGES[$i]}.err")
      rc=$?
      echo "$t0 $(date +%s)" > "$OUT/$tag-${STAGES[$i]}.wall"
      echo "$tag ${STAGES[$i]} exit=$rc spent so far $(spent "$OUT/$tag"-*.json)" >> "$LOG"
    fi
  done

  if [ -z "$DRY" ]; then
    (cd "$wt" && git log --oneline "$BASE"..HEAD && git diff "$BASE" --stat && git status --porcelain) > "$OUT/$tag-diff.txt" 2>&1
    mkdir -p "$WORK/raw/$tag"
    local tr; tr=$(ls "$CFG"/projects/*/"$U".jsonl 2>/dev/null | head -1)
    if [ -n "$tr" ]; then
      cp "$tr" "$WORK/raw/$tag/"
      [ -d "${tr%.jsonl}" ] && cp -r "${tr%.jsonl}" "$WORK/raw/$tag/"
      (cd "$REPO" && node scripts/ctx.js "$U" --by-stage --claude-dir "$CFG") > "$OUT/$tag-ctx.txt" 2>> "$LOG"
    else
      echo "$tag: no transcript for session $U under $CFG/projects" >> "$LOG"
    fi
    [ -d "$wt/.fankeel/build" ] && cp -r "$wt/.fankeel/build" "$WORK/raw/$tag/build"
    git worktree remove --force "$wt" >> "$LOG" 2>&1 || echo "$tag: worktree remove failed, left at $wt" >> "$LOG"
  fi
}

for r in $(seq 1 "$RUNS"); do
  if [ $((r % 2)) -eq 1 ]; then order=(main agents); else order=(agents main); fi
  for a in "${order[@]}"; do
    if [ "$a" = main ]; then run "r$r-main" false; else run "r$r-agents" build,verify; fi
  done
done

[ -z "$DRY" ] && node "$REPO/docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/tally.js" "$OUT" "$WORK/raw" > "$OUT/summary.json" 2>> "$LOG"
echo "porcelain after: $(git status --porcelain | wc -l) lines" >> "$LOG"
echo "done" >> "$LOG"
