#!/usr/bin/env bash
# bench/roles/reader/items/answers.sh
# The reader items' shared judge: bash answers.sh <project>, with the expected
# answers on stdin, one line each as n|answer|needle. The reply is
# <project>/.bench/result.txt, one line per question shaped
# `n. <answer> — <path>:<line>`. The answer must be the expected one, and the
# cited file must exist with the needle on that line; a path written with
# backslashes, or as an absolute path inside the project, reads as the
# relative one. An empty needle means the thing asked about does not exist:
# the answer is `none`, with no path:line. The last line printed is `pass` or
# `fail <class>: <why>`.
set -u
proj="$1"
result="$proj/.bench/result.txt"
[ -f "$result" ] || { echo "fail format: no .bench/result.txt"; exit 1; }
while IFS='|' read -r n answer needle; do
    [ -n "$n" ] || continue
    line="$(tr -d '\r' < "$result" | tr '\\' '/' | grep -E "^[[:space:]]*${n}\. " | head -n 1)"
    [ -n "$line" ] || { echo "fail format: question $n: no answer line"; exit 1; }
    got="$(printf '%s\n' "$line" | sed -E 's/^[[:space:]]*[0-9]+\.[[:space:]]*//; s/[[:space:]]+(—|–|-)[[:space:]].*$//; s/[[:space:]]+\(.*$//; s/[`*]//g; s/[[:space:]]+$//')"
    cite="$(printf '%s\n' "$line" | grep -oE '[A-Za-z0-9_./-]+:[0-9]+' | tail -n 1)"
    if [ -z "$needle" ]; then
        [ "$got" = "none" ] || { echo "fail wrong: question $n: the answer is none, not $got"; exit 1; }
        [ -z "$cite" ] || { echo "fail fabricated: question $n: $cite cited for something that does not exist"; exit 1; }
        continue
    fi
    [ "$got" = "$answer" ] || { echo "fail wrong: question $n: $got, not $answer"; exit 1; }
    [ -n "$cite" ] || { echo "fail format: question $n: no path:line"; exit 1; }
    file="${cite%:*}"
    file="${file#"${proj#?:}"/}"
    file="${file#./}"
    at="${cite##*:}"
    [ -f "$proj/$file" ] || { echo "fail fabricated: question $n: $file does not exist"; exit 1; }
    sed -n "${at}p" "$proj/$file" | grep -qF -- "$needle" || { echo "fail fabricated: question $n: $cite does not hold the answer"; exit 1; }
done
echo "pass"
