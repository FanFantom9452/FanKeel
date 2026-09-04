#!/usr/bin/env sh
# dispatch vs inline, one pair. The single variable is the method sentence,
# enforced for the inline arm by removing the Agent tool from the session.
SP="C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/39b77b4d-0487-4b69-aadd-ee77a17a45e6/scratchpad"
REPO="F:/ymlab/fankeel"
cd "$REPO" || exit 1

QUESTION='In the repository at F:/ymlab/fankeel, answer one question: which rules injected by lib/stages.js have no counterpart in the stage skill they belong to (skills/fankeel-<stage>/SKILL.md), and which rules does a stage skill state that lib/stages.js does not inject? Answer in at most 10 lines, one finding per line, every line anchored with a file:line. No preamble, no summary.'

M_DISPATCH=' Method you must use: dispatch four subagents in ONE response with the Agent tool, model sonnet, one lens each, splitting the seven stages between them; each returns at most 6 anchored lines. Then judge their returns and write the answer. Do not read the skill files yourself.'

M_INLINE=' Method you must use: read the files yourself in this session. Do not delegate any of the reading.'

LOG="$SP/ab-provenance.txt"
{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
} > "$LOG"

echo "--- arm A: dispatch" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_DISPATCH" --output-format json --model opus \
  --permission-mode bypassPermissions \
  --disallowedTools "Edit Write NotebookEdit" > "$SP/arm-dispatch.json" 2>"$SP/arm-dispatch.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

echo "--- arm B: inline" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_INLINE" --output-format json --model opus \
  --permission-mode bypassPermissions \
  --disallowedTools "Edit Write NotebookEdit Agent" > "$SP/arm-inline.json" 2>"$SP/arm-inline.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

echo "done" >> "$LOG"
