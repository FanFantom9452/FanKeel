#!/usr/bin/env sh
# Does an output style reach a subagent?
#
# Two arms, two runs each. The only variable is whether `outputStyle` is set in
# the settings file handed to `claude -p`. Everything else — prompt, model,
# flags, working directory — is identical.
#
# Each run asks TWO questions, and the first is the control: if the style did
# not reach the PARENT either, the subagent's answer says nothing about
# subagents, only that the setting did not take. Without that half, a "no" from
# the probe is unreadable.
#
# The needle is a literal string from output-styles/fankeel-terse.md. It is
# handed over verbatim rather than described, because a probe asked "does your
# context mention an output style?" answers differently between runs.
REPO="F:/ymlab/fankeel"
OUT="$REPO/docs/reports/evidence/2026-09-07-style-to-subagent"
cd "$REPO" || exit 1

NEEDLE='cost the reader a decode'

PROMPT='Answer exactly two numbered questions and nothing else. No preamble.

1. Does the literal string "cost the reader a decode" appear anywhere in your own context, including your system prompt? Answer YES or NO, and if YES quote the full sentence it sits in.

2. Dispatch the brief-probe agent, with model sonnet, and give it exactly this task: "Does the literal string \"cost the reader a decode\" appear anywhere in your context, including your system prompt? Answer YES or NO on the first line. If YES, quote the full sentence it sits in on the second line. Report only what is already in your context and call no tools." Then report its answer verbatim, prefixed with "PROBE: ".

Answer as: 1. <YES/NO> <quote or nothing>  then a newline, then 2. PROBE: <its verbatim answer>.'

printf '{}\n' > "$OUT/settings-control.json"
printf '{ "outputStyle": "fankeel-terse" }\n' > "$OUT/settings-styled.json"

LOG="$OUT/provenance.txt"
{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "branch: $(git rev-parse --abbrev-ref HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
  echo "needle: $NEEDLE"
  echo "style file: output-styles/fankeel-terse.md"
} > "$LOG"

for arm in control styled; do
  for run in 1 2; do
    echo "--- arm: $arm run: $run" >> "$LOG"
    start=$(date +%s)
    claude -p "$PROMPT" \
      --output-format json \
      --model sonnet \
      --settings "$OUT/settings-$arm.json" \
      --permission-mode bypassPermissions \
      --disallowedTools "Edit Write NotebookEdit" \
      > "$OUT/$arm-$run.json" 2> "$OUT/$arm-$run.err"
    echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"
  done
done

echo "HEAD after: $(git rev-parse HEAD)" >> "$LOG"
echo "done" >> "$LOG"
