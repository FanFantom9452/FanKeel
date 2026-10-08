#!/usr/bin/env bash
# a retry note with a typo in it, which the move must not touch
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_start "$here"
