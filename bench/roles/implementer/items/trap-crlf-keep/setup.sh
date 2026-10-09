#!/usr/bin/env bash
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
mkdir -p lib
printf "'use strict';\r\n// Old helpers, kept with Windows line endings.\r\nfunction double(n) {\r\n    return n * 2;\r\n}\r\n\r\nexports.double = double;\r\n" > lib/legacy.js
repo_start "$here"
