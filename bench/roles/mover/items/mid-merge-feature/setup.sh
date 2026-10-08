#!/usr/bin/env bash
# a docs index, and a feature branch with the retry notes waiting to be merged
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_start "$here"
git checkout -q -b feature
printf '# Retry\n\nSeven tries, 250 ms apart.\n' > docs/retry.md
git add docs/retry.md
git commit -q -m "docs: the retry notes"
git checkout -q -
