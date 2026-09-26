#!/usr/bin/env bash
# Which flag and which spelling actually gates a dispatch?
#
# The TODO entry asks which spelling --allowedTools eats, `Task` or `Agent`.
# The first three arms answer that by showing the question is wrong:
# --allowedTools does not gate this tool under any spelling, so the arm that
# allows neither still dispatches. Rounds 1 and 2 of this probe both landed
# there — round 1 under bypassPermissions, where the flag is a no-op by
# definition, and round 2 under manual + --permission-prompts none, where it
# is not, and the dispatch happened anyway.
#
# So two more arms move the question to --disallowedTools, the flag that does
# remove a tool. dis-agent is the control: if it dispatches, this harness
# cannot remove the tool at all and no arm here proves anything.
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$DIR/dispatch-work"
MODEL="claude-haiku-4-5-20251001"

rm -rf "$WORK"
mkdir -p "$WORK/notes"
cd "$WORK" || exit 1

for i in 1 2 3 4 5; do
  printf 'note %s\nthe word tuesday appears here\n' "$i" > "notes/n$i.md"
done

git init -q .
git -c user.email=probe@local -c user.name=probe add -A
git -c user.email=probe@local -c user.name=probe commit -q -m base

PROMPT='Dispatch one subagent to count how many files under notes/ contain the word tuesday, and report the number it returns. Delegate it — do not open the files in this session. If you have no tool for dispatching a subagent, say exactly: NO DISPATCH TOOL.'

run () {
  local arm="$1"; shift
  echo "=== $arm  ($*) ===" >&2
  claude -p "$PROMPT" \
    --setting-sources project \
    --permission-mode manual --permission-prompts none \
    --max-turns 4 \
    --model "$MODEL" \
    --output-format stream-json --verbose \
    "$@" \
    > "out-$arm.jsonl" 2> "err-$arm.txt"
  echo "exit=$? lines=$(wc -l < "out-$arm.jsonl")" >&2
}

run agent     --allowedTools "Read,Grep,Glob,Agent"
run task      --allowedTools "Read,Grep,Glob,Task"
run none      --allowedTools "Read,Grep,Glob"
run dis-agent --disallowedTools "Agent"
run dis-task  --disallowedTools "Task"

echo >&2
node "$DIR/grade-dispatch.js" "$WORK"
