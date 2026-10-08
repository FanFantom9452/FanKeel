set -eu
git mv docs/drafts/retry-notes.md docs/notes/retry-notes.md
echo "Edited while moving." >> docs/notes/retry-notes.md
git add docs/notes/retry-notes.md
git commit -q -m "docs: move the retry notes out of drafts"
