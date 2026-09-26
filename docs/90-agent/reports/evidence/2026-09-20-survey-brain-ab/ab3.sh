#!/usr/bin/env bash
# ab2.sh again, after 577f3e1 told the stage agent to put independent commands in
# one Bash call (report §6). The copy is taken from HEAD, so the nor arms carry that
# line; the arms alternate old, nor, old, nor in one loop.
#
#   old: --model opus,   stage.agents false, --plugin-dir the working tree
#   nor: --model sonnet, stage.agents true,  --plugin-dir a copy of HEAD whose
#        fankeel-brain has no Agent tool and whose brief says to read itself
#        (noreader-patch.js; the diff goes into provenance.txt)
#
# Everything else is ab.sh's: the task text, the route, the stage prompt, the
# flags, the side effects and how each is undone. The copy lives in the
# scratchpad, outside the repository, so the brain's own Grep and Glob in the
# nor arm cannot land on a second copy of the code.
set -u

REPO="F:/ymlab/fankeel"
BUILD="$REPO/.fankeel/build/2026-09-19-survey-brain"
OUT="$BUILD/ab3"
COPY="C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/9e36bfd6-a380-425d-82ca-5d9c22f28a4f/scratchpad/noreader-plugin-$(date +%s)"
PARENT="9e36bfd6-a380-425d-82ca-5d9c22f28a4f"
TASK="survey only: which code reads the registry's started field, and what each reader does with it"
STAGE_PROMPT="Do the survey stage for this task, up to its gate."

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

mkdir -p "$(cygpath -u "$COPY")" || exit 1
git archive HEAD | tar -x -C "$(cygpath -u "$COPY")" || { echo "archive failed" >> "$LOG"; exit 1; }
node "$BUILD/noreader-patch.js" "$COPY" >> "$LOG" 2>&1 || { echo "patch failed" >> "$LOG"; exit 1; }
{
  echo "copy: $COPY, from HEAD $(git rev-parse HEAD)"
  diff -u --strip-trailing-cr agents/fankeel-brain.md "$COPY/agents/fankeel-brain.md"
  diff -u --strip-trailing-cr lib/render.js "$COPY/lib/render.js"
  echo "every other file identical: $(diff -rq --strip-trailing-cr -x .git -x .fankeel -x node_modules "$REPO" "$COPY" 2>&1 | grep -v -e 'fankeel-brain.md' -e 'lib/render.js' -e '^Only in' | wc -l) differing"
} >> "$LOG"

arm () {
  local name="$1" model="$2" agents="$3" plugin="$4"
  local U; U=$(node -e "console.log(require('crypto').randomUUID())")
  echo "--- $name  model=$model stage.agents=$agents plugin=$plugin session $U" >> "$LOG"
  local common=(--setting-sources project --plugin-dir "$plugin" --permission-mode bypassPermissions)

  local c0=(node scripts/task.js profile set stage.agents "$agents" --default)
  logcmd "${c0[@]}" >> "$LOG"; "${c0[@]}" >> "$LOG" 2>&1

  local c1=(claude -p "Run this command and report its output, nothing else: node $REPO/scripts/task.js start --session $U --task \"$TASK\" --route survey,design" --session-id "$U" --model "$model" --output-format json "${common[@]}")
  logcmd "${c1[@]}" >> "$LOG"
  "${c1[@]}" > "$OUT/$name-start.json" 2> "$OUT/$name-start.err"
  echo "start exit=$?" >> "$LOG"

  local c2=(claude -p "$STAGE_PROMPT" --resume "$U" --model "$model" --output-format json "${common[@]}")
  logcmd "${c2[@]}" >> "$LOG"
  local t0; t0=$(date +%s)
  "${c2[@]}" > "$OUT/$name-survey.json" 2> "$OUT/$name-survey.err"
  echo "survey exit=$? shell_seconds=$(( $(date +%s) - t0 ))" >> "$LOG"

  local c3=(node scripts/task.js clear "$U" --force --session "$PARENT")
  logcmd "${c3[@]}" >> "$LOG"; "${c3[@]}" >> "$LOG" 2>&1
  echo "porcelain after $name:" >> "$LOG"; git status --porcelain >> "$LOG"
}

arm old5 opus   false "$REPO"
arm nor3 sonnet true  "$COPY"
arm old6 opus   false "$REPO"
arm nor4 sonnet true  "$COPY"

c4=(node scripts/task.js profile set stage.agents false --default)
logcmd "${c4[@]}" >> "$LOG"; "${c4[@]}" >> "$LOG" 2>&1
echo "HEAD after: $(git rev-parse HEAD)" >> "$LOG"
echo "done" >> "$LOG"
