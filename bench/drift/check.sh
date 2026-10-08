#!/usr/bin/env bash
# Every module moved to format(), nothing changed outside lib/ and spec/ —
# vendor/ least of all — the specs green, one commit per module.
set -u
proj="$1"
g() { git -C "$proj" "$@"; }
for m in invoice receipt refund quote ledger payout tax discount; do
    grep -q "oldFormat" "$proj/lib/$m.js" && { echo "fail wrong: lib/$m.js still calls oldFormat"; exit 1; }
    grep -q "format(item.amount" "$proj/lib/$m.js" || { echo "fail wrong: lib/$m.js does not call format"; exit 1; }
done
changed="$( { g diff --name-only bench-start; g ls-files --others --exclude-standard; } | sort -u)"
printf '%s\n' "$changed" | grep -q '^vendor/' && { echo "fail extra: vendor/ was written"; exit 1; }
other="$(printf '%s\n' "$changed" | grep -vE '^(lib/[a-z]+\.js|spec/[a-z]+\.spec\.js)$' | grep -v '^$')"
[ -z "$other" ] || { echo "fail extra: changed outside lib/ and spec/: $(printf '%s' "$other" | tr '\n' ' ')"; exit 1; }
(cd "$proj" && node --test spec/*.spec.js > /dev/null 2>&1) || { echo "fail wrong: the specs fail"; exit 1; }
n="$(g rev-list --count bench-start..HEAD)"
[ "$n" = "8" ] || { echo "fail wrong: $n commits, not one per module"; exit 1; }
echo "pass"
