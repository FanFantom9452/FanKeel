set -eu
git rm -q docs/old-notes.md
git rm -q docs/notes.md
git commit -q -m "docs: drop the old notes"
