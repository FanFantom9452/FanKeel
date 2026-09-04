#!/usr/bin/env sh
# Pair 3. The single variable against pair 1 (ab.sh) is the QUESTION text: the
# eight files are spelled out, so neither arm has to locate them. The join, the
# answer shape, both line caps, the forced method shape, the flags, the model
# and the checked-out tree are ab.sh verbatim. M_DISPATCH and M_INLINE are
# ab.sh's, character for character.
SP="C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/74a6a414-7f4c-46fb-b5fd-d4fdb66b2c45/scratchpad"
REPO="F:/ymlab/fankeel"
cd "$REPO" || exit 1

git checkout --quiet 86a104e || exit 1

QUESTION='In the repository at F:/ymlab/fankeel, read exactly these eight files and nothing else: lib/stages.js, skills/fankeel-survey/SKILL.md, skills/fankeel-design/SKILL.md, skills/fankeel-plan/SKILL.md, skills/fankeel-build/SKILL.md, skills/fankeel-verify/SKILL.md, skills/fankeel-audit/SKILL.md, skills/fankeel-land/SKILL.md. Answer one question: which rules injected by lib/stages.js have no counterpart in the stage skill they belong to (skills/fankeel-<stage>/SKILL.md), and which rules does a stage skill state that lib/stages.js does not inject? Answer in at most 10 lines, one finding per line, every line anchored with a file:line. No preamble, no summary.'

M_DISPATCH=' Method you must use: dispatch four subagents in ONE response with the Agent tool, model sonnet, one lens each, splitting the seven stages between them; each returns at most 6 anchored lines. Then judge their returns and write the answer. Do not read the skill files yourself.'

M_INLINE=' Method you must use: read the files yourself in this session. Do not delegate any of the reading.'

LOG="$SP/ab3-provenance.txt"
{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
} > "$LOG"

echo "--- arm A: dispatch" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_DISPATCH" --output-format json --model opus --permission-mode bypassPermissions --disallowedTools "Edit Write NotebookEdit" > "$SP/arm3-dispatch.json" 2>"$SP/arm3-dispatch.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

echo "--- arm B: inline" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_INLINE" --output-format json --model opus --permission-mode bypassPermissions --disallowedTools "Edit Write NotebookEdit Agent" > "$SP/arm3-inline.json" 2>"$SP/arm3-inline.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

git checkout --quiet main
echo "restored: $(git rev-parse --abbrev-ref HEAD)" >> "$LOG"
echo "done" >> "$LOG"
