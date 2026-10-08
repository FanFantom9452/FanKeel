#!/usr/bin/env bash
# The order service's repository, copied from src/: three facts, each with a decoy.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_filler
cp -r "$here/src/." .
repo_commit
