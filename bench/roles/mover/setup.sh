#!/usr/bin/env bash
# Builds the mover's fixed repository in the current directory: a draft to
# move into docs/notes, which already exists, committed under a local
# identity so the mover's own commit needs no global one.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p .fankeel/sessions
cp -r "$here/src/." .
printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
git init -q
git config user.name bench
git config user.email bench@localhost
git add -A
git commit -q -m "mover: start"
