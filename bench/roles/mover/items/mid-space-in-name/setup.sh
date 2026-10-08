#!/usr/bin/env bash
# a meeting note whose name has spaces
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
mkdir -p docs
printf '# Meeting notes\n\nShip on Friday.\n' > "docs/meeting notes.md"
repo_start "$here"
