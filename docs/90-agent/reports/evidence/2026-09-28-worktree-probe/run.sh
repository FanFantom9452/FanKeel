#!/usr/bin/env sh
# Does a subagent that calls Agent with isolation "worktree" get the worktree's
# path and branch back in the text it reads? See ../../2026-09-28-worktree-probe.md.
# Runs in a throwaway repository so no worktree is opened inside fankeel.
REPO="F:/ymlab/fankeel"
OUT="$REPO/docs/90-agent/reports/evidence/2026-09-28-worktree-probe"
SID="5e1f0c2a-9d3b-4c6e-8a71-2b4f6d8e0a13"
PROBE="$(mktemp -d)"

cd "$PROBE" || exit 1
git init -q
git config user.email probe@example.invalid
git config user.name probe
echo probe > README.md
git add README.md
git commit -qm base

cat > "$OUT/agents.json" <<'JSON'
{
  "outer": {
    "description": "Dispatches one inner agent in a worktree and relays the tool result verbatim.",
    "prompt": "Use the Agent tool exactly once: subagent_type \"inner\", isolation \"worktree\", prompt \"go\". Then reply with the full text of that tool result, verbatim, and nothing else.",
    "tools": ["Agent"],
    "model": "haiku"
  },
  "inner": {
    "description": "Writes one file in its working directory and replies done.",
    "prompt": "Run exactly this one Bash command and nothing else: echo probe > probe.txt. Then reply with the single word done.",
    "tools": ["Bash"],
    "model": "haiku"
  }
}
JSON

PROMPT='Use the Agent tool exactly once, subagent_type "outer", prompt "go". Then reply with exactly what it returned.'

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git -C "$REPO" rev-parse HEAD)"
  echo "porcelain:"; git -C "$REPO" status --porcelain
  echo "claude: $(claude --version)"
  echo "run.sh md5: $(md5sum "$OUT/run.sh" | cut -d' ' -f1)"
  echo "extract.js md5: $(md5sum "$OUT/extract.js" | cut -d' ' -f1)"
  echo "session: $SID"
  echo "probe repo: $PROBE"
} > "$OUT/provenance.txt"

claude -p "$PROMPT" \
  --session-id "$SID" \
  --output-format json \
  --model haiku \
  --agents "$OUT/agents.json" \
  --setting-sources project \
  --permission-mode bypassPermissions \
  --disallowedTools "Edit Write NotebookEdit" \
  < /dev/null > "$OUT/claude-out.json" 2> "$OUT/claude-err.txt"

echo "claude exit $?" >> "$OUT/provenance.txt"
git -C "$PROBE" worktree list --porcelain > "$OUT/worktree-list.txt"
node "$OUT/extract.js" "$SID" "$OUT/worktree-list.txt" > "$OUT/summary.json"
cat "$OUT/summary.json" >> "$OUT/provenance.txt"
cd "$REPO" && rm -rf "$PROBE"
