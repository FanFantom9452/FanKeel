#!/usr/bin/env bash
# Builds the reader's fixed repository in the current directory: twenty-six
# filler modules, the three files that hold the answers, and decoys that name
# the same things with other values.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p .fankeel/sessions lib/parts
cp -r "$here/src/." .
for i in $(seq -w 1 26); do
    printf "'use strict';\n// Part %s of the order pipeline.\nfunction part%s(x) {\n    return x + %d;\n}\n\nexports.part%s = part%s;\n" "$i" "$i" "$((10#$i))" "$i" "$i" > "lib/parts/part$i.js"
done
printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
git init -q
git add -A
git -c user.name=bench -c user.email=bench@localhost commit -q -m "reader: start"
