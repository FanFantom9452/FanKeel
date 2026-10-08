#!/usr/bin/env bash
# Builds the add-feature project in the current directory: slugify without a
# length cap, its design and a written plan whose Dispatch line names
# BENCH_IMPL, and the profile that hands build and verify to stage agents.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p .fankeel/sessions
cp -r "$here/src/." .
sed -i "s/@IMPL@/${BENCH_IMPL:-sonnet}/" docs/plans/2026-01-01-truncate.md
printf '{\n  "stage.agents": ["build", "verify"],\n  "land.push": false\n}\n' > .fankeel/profile.json
git init -q
git add -A
git -c user.name=bench -c user.email=bench@localhost commit -q -m "add-feature: start"
