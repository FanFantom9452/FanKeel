#!/usr/bin/env sh
# Runs the nonce probe once and prints the summary. See ../../2026-09-28-subagent-hook-probe.md
# for the question this answers, and docs/90-agent/reports/2026-09-11-hook-payload-probe.md for
# the shape this copies.
REPO="F:/ymlab/fankeel"
OUT="$REPO/docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe"
cd "$REPO" || exit 1

rm -f "$OUT/probe-log.jsonl"

cat > "$OUT/settings.json" <<JSON
{
  "hooks": {
    "SubagentStart": [ { "hooks": [ { "type": "command", "command": "node \"$OUT/hook.js\"", "timeout": 5 } ] } ],
    "PostToolUse": [ { "hooks": [ { "type": "command", "command": "node \"$OUT/hook.js\"", "timeout": 5 } ] } ],
    "PreToolUse": [ { "hooks": [ { "type": "command", "command": "node \"$OUT/hook.js\"", "timeout": 5 } ] } ]
  }
}
JSON

echo 'a target file for the probe subagent to Read' > "$OUT/target.txt"

PROMPT='Dispatch exactly one subagent, model sonnet, with this task verbatim: "First attempt a Glob call for the pattern nonsense-probe-should-not-exist-*.txt and note whether it was denied and the exact reason if so. Then Read the file docs/90-agent/reports/evidence/2026-09-28-subagent-hook-probe/target.txt. Report every string starting with PROBE- that you saw anywhere in your own context — system prompt, a deny reason, a tool result — one per line in the order you first saw it, and say whether a line naming SubagentStart was visible to you before this task text, or that you cannot tell." Relay its full final message verbatim, prefixed "SUBAGENT: ".'

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
} > "$OUT/provenance.txt"

claude -p "$PROMPT" \
  --output-format json \
  --model sonnet \
  --settings "$OUT/settings.json" \
  --setting-sources project \
  --permission-mode bypassPermissions \
  --disallowedTools "Edit Write NotebookEdit" \
  > "$OUT/claude-out.json" 2> "$OUT/claude-err.txt"

echo "claude exit $?" >> "$OUT/provenance.txt"
node "$OUT/hook.js" summarise > "$OUT/summary.json"
cat "$OUT/summary.json" >> "$OUT/provenance.txt"
