#!/usr/bin/env bash
# Builds the mutator's fixed project in the current directory: clamp() and its
# three specs, committed, with the bench's own files ignored so a clean
# restore leaves `git status --porcelain` empty.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p .fankeel/sessions
cp -r "$here/src/." .
printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
git init -q
git add -A
git -c user.name=bench -c user.email=bench@localhost commit -q -m "mutator: start"
