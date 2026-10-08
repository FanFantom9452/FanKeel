#!/usr/bin/env bash
# one how-to doc on the start commit
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_start "$here"
