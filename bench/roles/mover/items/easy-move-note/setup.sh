#!/usr/bin/env bash
# the old orders service's draft and notes, before the move
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_start "$here"
