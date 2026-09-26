#!/usr/bin/env sh
# Pair 1 re-run with haiku on both arms. Copied from
# docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab.sh with three changes
# and no others: `--model opus` becomes `--model haiku` on both arms, the output
# directory is this one rather than a scratchpad, and the provenance file is
# named for this pair. The question, both method sentences and the
# `model sonnet` the dispatch arm tells its readers to use are unchanged — the
# single variable is the parent model.
SP="F:/ymlab/fankeel/docs/reports/evidence/2026-09-09-haiku-pair"
REPO="F:/ymlab/fankeel"
cd "$REPO" || exit 1

QUESTION='In the repository at F:/ymlab/fankeel, answer one question: which rules injected by lib/stages.js have no counterpart in the stage skill they belong to (skills/fankeel-<stage>/SKILL.md), and which rules does a stage skill state that lib/stages.js does not inject? Answer in at most 10 lines, one finding per line, every line anchored with a file:line. No preamble, no summary.'

M_DISPATCH=' Method you must use: dispatch four subagents in ONE response with the Agent tool, model sonnet, one lens each, splitting the seven stages between them; each returns at most 6 anchored lines. Then judge their returns and write the answer. Do not read the skill files yourself.'

M_INLINE=' Method you must use: read the files yourself in this session. Do not delegate any of the reading.'

LOG="$SP/ab-haiku-provenance.txt"
{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
  echo "note: pair 1 was pinned at HEAD 86a104e1bc87f7e82eec45cb84b6e32459a32402 and claude 2.1.259."
  echo "note: both arms are haiku here; pair 1 ran both arms on opus."
} > "$LOG"

echo "--- arm A: dispatch" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_DISPATCH" --output-format json --model haiku \
  --permission-mode bypassPermissions \
  --disallowedTools "Edit Write NotebookEdit" > "$SP/arm-haiku-dispatch.json" 2>"$SP/arm-haiku-dispatch.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

echo "--- arm B: inline" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_INLINE" --output-format json --model haiku \
  --permission-mode bypassPermissions \
  --disallowedTools "Edit Write NotebookEdit Agent" > "$SP/arm-haiku-inline.json" 2>"$SP/arm-haiku-inline.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

echo "done" >> "$LOG"
