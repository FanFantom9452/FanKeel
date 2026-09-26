#!/usr/bin/env bash
# Does a model follow the relative link out of a SKILL.md to rationale.md?
#
# docs/decisions/2026-09-05-skill-split-design.md:158 wrote the method down and
# nobody ran it: invoke fankeel-build and ask for one fact that lives only in
# rationale.md. skills/fankeel-verify/ has no rationale.md at all, so build is
# the only skill this can be asked of.
#
# Two needles, each a word unique to its file within skills/, docs/ and lib/:
#   predating  — skills/fankeel-build/SKILL.md     the control
#   triples    — skills/fankeel-build/rationale.md the question
# The control cell has to hit. If the model cannot find a word that is in the
# SKILL.md it was just given, the skill did not load and the other cell says
# nothing about links.
#
# Each cell runs twice: a model asked whether its context mentions something
# answers differently between runs, so one hit and one miss is a result too.
#
# Writes are removed with --disallowedTools, which this probe's neighbour
# (probe-dispatch.sh) showed is the flag that actually removes a tool —
# --allowedTools does not. cwd is the repo because the link resolves inside
# the plugin tree.
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$DIR/../../.." && pwd)"
MODEL="claude-haiku-4-5-20251001"

cd "$REPO" || exit 1

ask () {
  local cell="$1" needle="$2" run="$3"
  local out="$DIR/link-$cell-$run.jsonl"
  echo "=== $cell run $run (needle: $needle) ===" >&2
  claude -p "Invoke the fankeel:fankeel-build skill. Then, using only material that skill made available to you, find the word \`$needle\` and quote the complete sentence that contains it. If it is not there, say exactly: NEEDLE NOT FOUND." \
    --setting-sources project \
    --plugin-dir "$REPO" \
    --permission-mode bypassPermissions \
    --disallowedTools "Edit,Write,NotebookEdit,Agent" \
    --max-turns 6 \
    --model "$MODEL" \
    --output-format stream-json --verbose \
    > "$out" 2> "$DIR/link-$cell-$run.err"
  echo "exit=$? lines=$(wc -l < "$out")" >&2
}

ask control predating 1
ask control predating 2
ask linked  triples   1
ask linked  triples   2

echo >&2
node "$DIR/grade-link.js" "$DIR"
