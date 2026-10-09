#!/usr/bin/env bash
# The one lib/ file that requires mailer.js, named by its path.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
mods=(signup invoice refund); m="${mods[$(( (s - 1) % 3 ))]}"; o="${mods[$(( s % 3 ))]}"
printf '1|lib/%s.js|mailer.js\n' "$m" | bash "$here/../answers.sh" "$1"
