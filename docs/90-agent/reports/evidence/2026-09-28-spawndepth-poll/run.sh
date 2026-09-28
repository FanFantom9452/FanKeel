#!/usr/bin/env sh
# Runs the spawnDepth probe again with a hook that waits (20 ms steps, 500 ms max). See ../../2026-09-28-spawndepth-timing.md.
# Copies the shape of ../2026-09-28-subagent-hook-probe/run.sh; adds --agents so a
# subagent can dispatch one of its own (depth 2), which is the case nestedBrain() reads.
REPO="F:/ymlab/fankeel"
OUT="$REPO/docs/90-agent/reports/evidence/2026-09-28-spawndepth-poll"
cd "$REPO" || exit 1

rm -f "$OUT/hook-log.jsonl"

cat > "$OUT/settings.json" <<JSON
{
  "hooks": {
    "SubagentStart": [ { "hooks": [ { "type": "command", "command": "node \"$OUT/record.js\"", "timeout": 5 } ] } ]
  }
}
JSON

cat > "$OUT/agents.json" <<'JSON'
{
  "nester": {
    "description": "Dispatches exactly one leaf agent and relays its answer.",
    "prompt": "Use the Agent tool exactly once, subagent_type \"leaf\", prompt \"reply with the single word leaf\". Then reply with exactly what it returned.",
    "tools": ["Agent"],
    "model": "haiku"
  },
  "leaf": {
    "description": "Replies with one word.",
    "prompt": "Reply with the single word leaf. Use no tools.",
    "tools": ["Read"],
    "model": "haiku"
  }
}
JSON

PROMPT='Use the Agent tool exactly once, subagent_type "nester", prompt "go". Then reply with exactly what it returned.'

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
  echo "record.js md5: $(md5sum "$OUT/record.js" | cut -d' ' -f1)"
  echo "run.sh md5: $(md5sum "$OUT/run.sh" | cut -d' ' -f1)"
} > "$OUT/provenance.txt"

claude -p "$PROMPT" \
  --output-format json \
  --model haiku \
  --settings "$OUT/settings.json" \
  --agents "$OUT/agents.json" \
  --setting-sources project \
  --permission-mode bypassPermissions \
  --disallowedTools "Edit Write NotebookEdit Bash" \
  < /dev/null > "$OUT/claude-out.json" 2> "$OUT/claude-err.txt"

echo "claude exit $?" >> "$OUT/provenance.txt"
node "$OUT/record.js" after > "$OUT/summary.json"
cat "$OUT/summary.json" >> "$OUT/provenance.txt"
