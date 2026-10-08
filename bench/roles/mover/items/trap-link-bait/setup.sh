#!/usr/bin/env bash
# a setup note whose link points one level up, and a docs index
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_start "$here"
