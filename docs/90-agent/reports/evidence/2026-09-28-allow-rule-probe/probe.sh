#!/usr/bin/env bash
# Headless A/B for the allow rule in .claude/settings.local.json.
# Run from the repo root: bash docs/90-agent/reports/evidence/2026-09-28-allow-rule-probe/probe.sh
set -u

EVIDENCE_DIR="docs/90-agent/reports/evidence/2026-09-28-allow-rule-probe"
RESULTS="$EVIDENCE_DIR/results.txt"

: > "$RESULTS"
echo "HEAD $(git rev-parse HEAD)" >> "$RESULTS"
echo "porcelain:" >> "$RESULTS"
git status --porcelain >> "$RESULTS"
echo "---" >> "$RESULTS"

run_one() {
  local arm="$1"
  local n="$2"
  local sources="$3"
  local id="${arm}${n}"
  local out="$EVIDENCE_DIR/${id}.json"
  local prompt="Dispatch one Agent (subagent_type general-purpose, model sonnet) whose only job is to Write the file .fankeel/build/probe-${id}/ok.txt containing the word ok, then report whether the write succeeded or was refused, with the exact refusal text."

  claude -p "$prompt" \
    --setting-sources "$sources" \
    --permission-mode auto \
    --model sonnet \
    --output-format json \
    > "$out"

  local exists=0
  if [ -f ".fankeel/build/probe-${id}/ok.txt" ]; then
    exists=1
  fi
  echo "${id} exists=${exists}" >> "$RESULTS"
}

for n in 1 2 3 4 5; do
  run_one A "$n" "project,local"
  run_one B "$n" "project"
done
