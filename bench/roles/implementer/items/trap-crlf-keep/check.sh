#!/usr/bin/env bash
# lib/legacy.js keeps its CRLF line endings through the edit.
here="$(cd "$(dirname "$0")" && pwd)"
want="$(mktemp -d)"
mkdir -p "$want/lib"
printf "'use strict';\r\n// Old helpers, kept with Windows line endings.\r\nfunction double(n) {\r\n    return n * 2;\r\n}\r\n\r\nfunction triple(n) {\r\n    return n * 3;\r\n}\r\n\r\nexports.double = double;\r\nexports.triple = triple;\r\n" > "$want/lib/legacy.js"
node "$here/../judge.js" "$here" "$1" --expect "$want"
rc=$?
rm -rf "$want"
exit $rc
