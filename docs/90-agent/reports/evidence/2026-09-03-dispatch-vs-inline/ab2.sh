#!/usr/bin/env sh
# Pair 2. The single variable against pair 1 (ab.sh) is the QUESTION text: the
# seven files are named, so neither arm has to search for them. Flags, model,
# forced method shape and the checked-out tree are ab.sh verbatim.
SP="C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/e3b238dc-7170-42cb-bc5f-7736139219d4/scratchpad"
REPO="F:/ymlab/fankeel"
cd "$REPO" || exit 1

git checkout --quiet 86a104e || exit 1

QUESTION='In the repository at F:/ymlab/fankeel, read exactly these seven files and nothing else: hooks/brief.js, hooks/carry.js, hooks/gate.js, hooks/guard.js, hooks/inject.js, hooks/resume.js, hooks/touch.js. Answer one question: which of them read the session record, which of them write it, and which do neither? Answer in at most 7 lines, one line per file, every line anchored with a file:line. No preamble, no summary.'

M_DISPATCH=' Method you must use: dispatch four subagents in ONE response with the Agent tool, model sonnet, splitting the seven named files between them; each returns at most 3 anchored lines. Then judge their returns and write the answer. Do not read the files yourself.'

M_INLINE=' Method you must use: read the files yourself in this session. Do not delegate any of the reading.'

LOG="$SP/ab2-provenance.txt"
{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
} > "$LOG"

echo "--- arm A: dispatch" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_DISPATCH" --output-format json --model opus --permission-mode bypassPermissions --disallowedTools "Edit Write NotebookEdit" > "$SP/arm2-dispatch.json" 2>"$SP/arm2-dispatch.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

echo "--- arm B: inline" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_INLINE" --output-format json --model opus --permission-mode bypassPermissions --disallowedTools "Edit Write NotebookEdit Agent" > "$SP/arm2-inline.json" 2>"$SP/arm2-inline.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

git checkout --quiet main
echo "restored: $(git rev-parse --abbrev-ref HEAD)" >> "$LOG"
echo "done" >> "$LOG"
