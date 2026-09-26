#!/usr/bin/env bash
# Task 7 Step 3: the survey stage under both modes, two pairs, arms alternating
# old, new, old, new in one loop (a context arm drifts between batches).
#
#   old: --model opus,   stage.agents false  (the main session does the survey)
#   new: --model sonnet, stage.agents true   (a controller dispatches fankeel-brain)
#
# Held constant: the task text, the route, --setting-sources project and
# --plugin-dir F:/ymlab/fankeel (the working tree, not the installed copy),
# --permission-mode bypassPermissions, --output-format json, the stage prompt.
#
# Side effects outside this directory, each undone or bounded here:
#   - `task.js profile set stage.agents ... --default` writes the machine-wide
#     profile; the script ends by setting it back to false.
#   - each arm's `task.js start` writes one registry entry; the script clears it
#     (`task.js clear`) from the parent session once the arm has run.
#   - the new arm's handoff lands under .fankeel/build/task-<stamp>/ (gitignored).
set -u

REPO="F:/ymlab/fankeel"
OUT="$REPO/.fankeel/build/2026-09-19-survey-brain/ab"
PARENT="9e36bfd6-a380-425d-82ca-5d9c22f28a4f"
TASK="survey only: which code reads the registry's started field, and what each reader does with it"
STAGE_PROMPT="Do the survey stage for this task, up to its gate."
COMMON=(--setting-sources project --plugin-dir "$REPO" --permission-mode bypassPermissions)

mkdir -p "$OUT"
cd "$REPO" || exit 1
LOG="$OUT/provenance.txt"

logcmd () { printf '$'; printf ' %q' "$@"; printf '\n'; }

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
} > "$LOG"

arm () {
  local name="$1" model="$2" agents="$3"
  local U; U=$(node -e "console.log(require('crypto').randomUUID())")
  echo "--- $name  model=$model stage.agents=$agents session $U" >> "$LOG"

  local c0=(node scripts/task.js profile set stage.agents "$agents" --default)
  logcmd "${c0[@]}" >> "$LOG"; "${c0[@]}" >> "$LOG" 2>&1

  local c1=(claude -p "Run this command and report its output, nothing else: node $REPO/scripts/task.js start --session $U --task \"$TASK\" --route survey,design" --session-id "$U" --model "$model" --output-format json "${COMMON[@]}")
  logcmd "${c1[@]}" >> "$LOG"
  "${c1[@]}" > "$OUT/$name-start.json" 2> "$OUT/$name-start.err"
  echo "start exit=$?" >> "$LOG"

  local c2=(claude -p "$STAGE_PROMPT" --resume "$U" --model "$model" --output-format json "${COMMON[@]}")
  logcmd "${c2[@]}" >> "$LOG"
  local t0; t0=$(date +%s)
  "${c2[@]}" > "$OUT/$name-survey.json" 2> "$OUT/$name-survey.err"
  echo "survey exit=$? shell_seconds=$(( $(date +%s) - t0 ))" >> "$LOG"

  local c3=(node scripts/task.js clear "$U" --force --session "$PARENT")
  logcmd "${c3[@]}" >> "$LOG"; "${c3[@]}" >> "$LOG" 2>&1
  echo "porcelain after $name:" >> "$LOG"; git status --porcelain >> "$LOG"
}

arm old1 opus   false
arm new1 sonnet true
arm old2 opus   false
arm new2 sonnet true

c4=(node scripts/task.js profile set stage.agents false --default)
logcmd "${c4[@]}" >> "$LOG"; "${c4[@]}" >> "$LOG" 2>&1
echo "HEAD after: $(git rev-parse HEAD)" >> "$LOG"
echo "done" >> "$LOG"
