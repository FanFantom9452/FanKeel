set -eu
git mv docs/a.md notes/a.md
git commit -q -m "notes: move a"
git mv docs/b.md notes/b.md
git commit -q -m "notes: move b"
