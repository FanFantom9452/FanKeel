#!/usr/bin/env bash
# Passes when the reader's reply, in .bench/result.txt, answers every question
# in answers.txt, and each cited path:line exists in the project and holds
# that answer's needle. One made-up citation fails the whole reply.
set -u
proj="$1"
here="$(cd "$(dirname "$0")" && pwd)"
result="$proj/.bench/result.txt"
[ -f "$result" ] || { echo "no .bench/result.txt"; exit 1; }
while IFS='|' read -r n answer needle; do
    line="$(grep -E "^[[:space:]]*${n}\. " "$result" | head -n 1)"
    [ -n "$line" ] || { echo "question $n: no answer line"; exit 1; }
    printf '%s\n' "$line" | grep -qw -- "$answer" || { echo "question $n: wrong answer"; exit 1; }
    cite="$(printf '%s\n' "$line" | grep -oE '[A-Za-z0-9_./-]+:[0-9]+' | tail -n 1)"
    [ -n "$cite" ] || { echo "question $n: no path:line"; exit 1; }
    file="${cite%:*}"
    file="${file#./}"
    at="${cite##*:}"
    [ -f "$proj/$file" ] || { echo "question $n: $file does not exist"; exit 1; }
    sed -n "${at}p" "$proj/$file" | grep -qF -- "$needle" || { echo "question $n: $cite does not hold the answer"; exit 1; }
done < "$here/answers.txt"
echo "pass"
