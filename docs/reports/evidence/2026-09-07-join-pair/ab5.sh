#!/usr/bin/env sh
# Pair 4 (ab5): the two-source join. Against pair 3 (ab3.sh -- named files,
# join held, no diff: ONE dispatch of four subagents splitting eight files by
# lens) this pair moves TWO things at once, named here and again in the
# report rather than left for a reader to notice: (1) one reader PER PAGE
# instead of four readers splitting many files between them, and (2) each
# reader is handed a SECOND source -- the path to a diff file -- instead of
# judging its page alone. This is the shape
# skills/fankeel-verify/SKILL.md:100-103 recommends and no pair has run.
#
# The tree is a worktree pinned at 86a104e (F:/ymlab/fankeel-ab), not a
# checkout in this repo -- this repo's own branch (todo-thirteen) carries
# unpushed commits a checkout would strand. No git checkout / switch / stash /
# reset runs anywhere in this script.
#
# Held constant against ab3.sh: both arms --model opus, dispatch subagents
# model sonnet; --output-format json --permission-mode bypassPermissions;
# dispatch --disallowedTools "Edit Write NotebookEdit", inline the same plus
# "Agent"; the question text byte-identical between arms, only the appended
# method paragraph differs.
EVID="F:/ymlab/fankeel/docs/reports/evidence/2026-09-07-join-pair"
REPO="F:/ymlab/fankeel-ab"
cd "$REPO" || exit 1

# The diff: four commits landing at the pinned tree (c9a68f2..86a104e --
# 9b2917e, 6913f75, 7a237b9, 86a104e), touching lib/stages.js (the injection
# code) and the stage-skill / doc pages that describe what it injects.
# Generated once, from inside the worktree, before either arm runs, and kept
# in the evidence directory (not the scratchpad) so the run is reproducible.
DIFF="$EVID/ab5-diff.patch"
git diff c9a68f2..86a104e > "$DIFF" || exit 1

QUESTION="In the repository at $REPO, a diff is saved at $DIFF, covering commits c9a68f2..86a104e. Read exactly these five pages and nothing else: skills/fankeel-build/SKILL.md, skills/fankeel-land/SKILL.md, skills/fankeel-design/SKILL.md, skills/fankeel-plan/SKILL.md, docs/subagents.md. For each page, judge it against the diff and answer one question: what does the diff make false on that page, and where? Answer in at most 10 lines, one finding per line, every line anchored with a file:line. No preamble, no summary."

M_DISPATCH=' Method you must use: dispatch five subagents in ONE response with the Agent tool, model sonnet, one reader per page -- each subagent reads exactly one of the five named pages plus the diff file at the path above and answers only for that page, at most 2 anchored lines. Then collect the five returns and write the answer. Do not read the pages or the diff yourself.'

M_INLINE=' Method you must use: read the five pages and the diff yourself in this session. Do not delegate any of the reading.'

LOG="$EVID/ab5-provenance.txt"
{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
} > "$LOG"

echo "--- arm A: dispatch" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_DISPATCH" --output-format json --model opus --permission-mode bypassPermissions --disallowedTools "Edit Write NotebookEdit" > "$EVID/arm5-dispatch.json" 2>"$EVID/arm5-dispatch.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

echo "--- arm B: inline" >> "$LOG"
start=$(date +%s)
claude -p "$QUESTION$M_INLINE" --output-format json --model opus --permission-mode bypassPermissions --disallowedTools "Edit Write NotebookEdit Agent" > "$EVID/arm5-inline.json" 2>"$EVID/arm5-inline.err"
echo "exit=$? shell_seconds=$(( $(date +%s) - start ))" >> "$LOG"

echo "worktree HEAD unchanged: $(git rev-parse HEAD)" >> "$LOG"
echo "worktree porcelain after:" >> "$LOG"
git status --porcelain >> "$LOG"
echo "done" >> "$LOG"
