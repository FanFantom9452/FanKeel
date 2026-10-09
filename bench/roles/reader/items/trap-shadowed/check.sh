#!/usr/bin/env bash
# The local PAGE_SIZE that render() slices with, not the module constant.
here="$(cd "$(dirname "$0")" && pwd)"
s="${BENCH_SEED:-1}"
printf '1|%s|PAGE_SIZE = %s;\n' "$((10 + s))" "$((10 + s))" | bash "$here/../answers.sh" "$1"
