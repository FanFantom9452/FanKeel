#!/usr/bin/env bash
# two notes files, the old one to be dropped
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_start "$here"
