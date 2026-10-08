#!/usr/bin/env bash
# The item's src/, committed.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_start "$here"
