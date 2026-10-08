#!/usr/bin/env bash
# Three modules; exactly one of them requires the mailer.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
mods=(signup invoice refund); m="${mods[$(( (s - 1) % 3 ))]}"; o="${mods[$(( s % 3 ))]}"
. "$here/../repo.sh"
repo_filler
printf "'use strict';\nfunction sendMail(to, body) {\n    return { to, body };\n}\n\nexports.sendMail = sendMail;\n" > lib/mailer.js
printf "'use strict';\nfunction log(line) {\n    return line;\n}\n\nexports.log = log;\n" > lib/log.js
for x in "${mods[@]}"; do
    if [ "$x" = "$m" ]; then req="const { sendMail } = require('./mailer.js');"; call="sendMail(user, 'hi')"; else req="const { log } = require('./log.js');"; call="log(user)"; fi
    printf "'use strict';\n%s\n\nfunction %s(user) {\n    return %s;\n}\n\nexports.%s = %s;\n" "$req" "$x" "$call" "$x" "$x" > "lib/$x.js"
done
repo_commit
