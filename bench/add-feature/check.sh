#!/usr/bin/env bash
# Passes when the hidden specs beside this script pass against the project's
# lib/slug.js, the project's own specs pass, spec/slug.spec.js is unchanged,
# and the plan's new spec file exists with at least two tests in it.
set -u
proj="$1"
here="$(cd "$(dirname "$0")" && pwd)"
cmp -s "$here/src/spec/slug.spec.js" "$proj/spec/slug.spec.js" || { echo "spec/slug.spec.js was changed"; exit 1; }
[ -f "$proj/spec/truncate.spec.js" ] || { echo "no spec/truncate.spec.js"; exit 1; }
[ "$(grep -c '^test(' "$proj/spec/truncate.spec.js")" -ge 2 ] || { echo "spec/truncate.spec.js holds fewer than two tests"; exit 1; }
(cd "$proj" && env -u NODE_TEST_CONTEXT node --test "spec/*.spec.js" > /dev/null 2>&1) || { echo "the project's own specs fail"; exit 1; }
BENCH_PROJ="$proj" env -u NODE_TEST_CONTEXT node --test "$here/hidden.spec.js" > /dev/null 2>&1 || { echo "the hidden specs fail"; exit 1; }
echo "pass"
