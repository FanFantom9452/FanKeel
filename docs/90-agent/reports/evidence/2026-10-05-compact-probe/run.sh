#!/usr/bin/env bash
# Usage: run.sh test|control — test sets FANKEEL_COMPACT_AT=1 so the mod
# compacts after the first turn; control leaves it unset (450k), so it never does.
set -u
ARM="$1"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
OUT="F:/ymlab/fankeel/.fankeel/build/compact-probe/$ARM"
PROJ="$OUT/proj"
ID="$(node -e "console.log(crypto.randomUUID())")"
mkdir -p "$PROJ/.fankeel/sessions"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"task":"compact probe %s","project":"%s","route":["build"],"class":"bounded","floor":"bounded","stage":"build","active":true,"started":"%s","updated":"%s"}\n' "$ARM" "$PROJ" "$NOW" "$NOW" > "$PROJ/.fankeel/sessions/$ID.json"
echo "PROBE-VALUE-$ARM-$(node -e "console.log(Date.now())")" > "$PROJ/probe.txt"
echo "$ID" > "$OUT/session-id.txt"
cd "$PROJ"
if [ "$ARM" = test ]; then export FANKEEL_COMPACT_AT=1; else unset FANKEEL_COMPACT_AT; fi
claude -p --model sonnet --session-id "$ID" --setting-sources project \
  --plugin-dir F:/ymlab/fankeel --settings "$HERE/settings.json" \
  --debug-file "$OUT/debug.log" --output-format stream-json --verbose \
  < "$HERE/prompt.txt" > "$OUT/stream.jsonl"
echo "exit $?" > "$OUT/exit.txt"
