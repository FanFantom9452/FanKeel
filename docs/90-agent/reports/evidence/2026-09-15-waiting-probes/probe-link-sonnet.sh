#!/usr/bin/env bash
# The linked cell of probe-link.sh again, on sonnet.
#
# haiku answered NEEDLE NOT FOUND twice without opening rationale.md. One model
# is not "models do not follow the link" — it is "this one did not". A second
# model decides whether the finding is about the harness or about haiku, and
# that is the difference between a report that can be acted on and one that
# can be waved away.
#
# Same flags, same needle, same grader naming so the two land in one table.
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$DIR/../../.." && pwd)"
MODEL="sonnet"
NEEDLE="triples"

cd "$REPO" || exit 1

for run in 1 2; do
  out="$DIR/link-sonnet-$run.jsonl"
  echo "=== sonnet run $run (needle: $NEEDLE) ===" >&2
  claude -p "Invoke the fankeel:fankeel-build skill. Then, using only material that skill made available to you, find the word \`$NEEDLE\` and quote the complete sentence that contains it. If it is not there, say exactly: NEEDLE NOT FOUND." \
    --setting-sources project \
    --plugin-dir "$REPO" \
    --permission-mode bypassPermissions \
    --disallowedTools "Edit,Write,NotebookEdit,Agent" \
    --max-turns 6 \
    --model "$MODEL" \
    --output-format stream-json --verbose \
    > "$out" 2> "$DIR/link-sonnet-$run.err"
  echo "exit=$? lines=$(wc -l < "$out")" >&2
done

echo >&2
node "$DIR/grade-link.js" "$DIR"
