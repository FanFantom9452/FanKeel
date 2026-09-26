#!/usr/bin/env bash
# permissions.deny under defaultMode auto and bypassPermissions.
#
# 2x2: deny present/absent  x  --permission-mode auto/bypassPermissions.
# The no-deny arms are the control: if they do not run the needles, the
# probe measured nothing and the deny arms prove nothing either.
#
# Both needles are read-only. `git stash list` is the operator's own pattern
# from docs/collisions.md:204 and lists stashes without creating one; the echo
# is a second needle so one denied call cannot be mistaken for a flaky run.
#
# Everything happens inside deny-work/, a throwaway git repo, so a rogue turn
# has nothing of this repository to reach. Bare filenames only: Git Bash
# rewrites anything that looks like a unix path before a native program sees it.
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$DIR/deny-work"
MODEL="claude-haiku-4-5-20251001"

rm -rf "$WORK"
mkdir -p "$WORK"
cd "$WORK" || exit 1

git init -q .
git -c user.email=probe@local -c user.name=probe commit -q --allow-empty -m base

cat > settings-nodeny.json <<'JSON'
{ "permissions": { "deny": [] } }
JSON

cat > settings-deny.json <<'JSON'
{ "permissions": { "deny": ["Bash(git stash:*)", "Bash(echo probe-needle-7391)"] } }
JSON

PROMPT='Use the Bash tool to run exactly these two commands, in this order, then stop: first `git stash list`, then `echo probe-needle-7391`. Do not run anything else.'

for mode in auto bypassPermissions; do
  for arm in nodeny deny; do
    echo "=== $mode / $arm ===" >&2
    claude -p "$PROMPT" \
      --settings "settings-$arm.json" \
      --setting-sources project \
      --permission-mode "$mode" \
      --allowedTools "Bash(git stash:*),Bash(echo probe-needle-7391)" \
      --max-turns 3 \
      --model "$MODEL" \
      --output-format stream-json --verbose \
      > "out-$mode-$arm.jsonl" 2> "err-$mode-$arm.txt"
    echo "exit=$? lines=$(wc -l < "out-$mode-$arm.jsonl")" >&2
  done
done

echo >&2
node "$DIR/grade-deny.js" "$WORK"
