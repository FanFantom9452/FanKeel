#!/usr/bin/env bash
# Every module moved off oldFormat() onto format(), and each one's behaviour
# is the new output for its spec's input, nothing changed outside lib/ and
# spec/ — vendor/ least of all — the specs green, one commit per module.
set -u
proj="$1"
g() { git -C "$proj" "$@"; }
# The item each module's spec calls its line with, and the string it must give.
item() {
    case "$1" in
        invoice) echo "{ name: 'pen', amount: 1.5 }" ;;
        receipt) echo "{ name: 'pen', total: 1.5 }" ;;
        refund) echo "{ name: 'pen', amount: 1.5 }" ;;
        quote) echo "{ name: 'pen', price: 1.5, qty: 2 }" ;;
        ledger) echo "{ name: 'pen', balance: 2.6 }" ;;
        payout) echo "{ name: 'pen', amount: 2500 }" ;;
        tax) echo "{ name: 'pen', amount: 10, rate: 0.5 }" ;;
        discount) echo "{ name: 'pen', amount: 1.5 }" ;;
    esac
}
want() {
    case "$1" in
        invoice) echo 'pen: 1.50 USD' ;;
        receipt) echo 'pen: 1.50 EUR' ;;
        refund) echo 'pen: (1.50 USD)' ;;
        quote) echo 'pen: 3.00 USD' ;;
        ledger) echo 'pen: 3 USD' ;;
        payout) echo 'pen: 25.00 EUR' ;;
        tax) echo 'pen: 5.00 USD' ;;
        discount) echo 'pen: -1.50 EUR' ;;
    esac
}
for m in invoice receipt refund quote ledger payout tax discount; do
    grep -q "oldFormat" "$proj/lib/$m.js" && { echo "fail wrong: lib/$m.js still calls oldFormat"; exit 1; }
    grep -q "format(" "$proj/lib/$m.js" || { echo "fail wrong: lib/$m.js does not call format"; exit 1; }
    got="$(cd "$proj" && env -u NODE_TEST_CONTEXT node -e "try { process.stdout.write(require('./lib/$m.js').${m}Line($(item "$m"))); } catch (e) { process.stdout.write('threw ' + e.message.split('\n')[0]); }" 2>&1)"
    [ "$got" = "$(want "$m")" ] || { echo "fail wrong: lib/$m.js gives $got, want $(want "$m")"; exit 1; }
done
changed="$( { g diff --name-only bench-start; g ls-files --others --exclude-standard; } | sort -u)"
printf '%s\n' "$changed" | grep -q '^vendor/' && { echo "fail extra: vendor/ was written"; exit 1; }
other="$(printf '%s\n' "$changed" | grep -vE '^(lib/[a-z]+\.js|spec/[a-z]+\.spec\.js)$' | grep -v '^$')"
[ -z "$other" ] || { echo "fail extra: changed outside lib/ and spec/: $(printf '%s' "$other" | tr '\n' ' ')"; exit 1; }
(cd "$proj" && env -u NODE_TEST_CONTEXT node --test spec/*.spec.js > /dev/null 2>&1) || { echo "fail wrong: the specs fail"; exit 1; }
n="$(g rev-list --count bench-start..HEAD)"
[ "$n" = "8" ] || { echo "fail wrong: $n commits, not one per module"; exit 1; }
echo "pass"
