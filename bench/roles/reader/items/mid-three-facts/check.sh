#!/usr/bin/env bash
# Three facts read past their decoys: a legacy limits file nothing requires and a stale port in the docs. Fixed, not seeded.
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../answers.sh" "$1" < "$here/answers.txt"
