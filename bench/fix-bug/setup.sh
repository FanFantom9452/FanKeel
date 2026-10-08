#!/usr/bin/env bash
# Builds the fix-bug project in the current directory: sumRange with an
# off-by-one, spec/range.spec.js generated for BENCH_SEED, and the profile
# that hands plan, build and verify to stage agents. check.sh regenerates
# the same spec to prove it was not edited.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p .fankeel/sessions spec
cp -r "$here/src/." .
bash "$here/gen-spec.sh" "${BENCH_SEED:-1}" > spec/range.spec.js
printf '{\n  "stage.agents": ["plan", "build", "verify"],\n  "land.push": false\n}\n' > .fankeel/profile.json
git init -q
git add -A
git -c user.name=bench -c user.email=bench@localhost commit -q -m "fix-bug: start"
