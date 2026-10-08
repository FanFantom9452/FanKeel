#!/usr/bin/env bash
# a plan, a scratch file to drop, and an archive directory
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/../repo.sh"
repo_start "$here"
