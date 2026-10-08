#!/usr/bin/env bash
# Grades the project's review.txt with check.js beside this script.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/check.js" "$1"
