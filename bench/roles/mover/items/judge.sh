# bench/roles/mover/items/judge.sh
# Sourced by every mover item's check.sh after it sets proj. Each want_*
# function checks one clause against the bench-start tag repo_start made, and
# on a miss prints `fail <class>: <why>` and exits 1.
g() { git -C "$proj" "$@"; }

want_commits() {
    n="$(g rev-list --count bench-start..HEAD)"
    [ "$n" = "$1" ] || { echo "fail wrong: $n commit(s) on top of the start, not $1"; exit 1; }
}

want_message() {
    [ "$(g log -1 --format=%B)" = "$1" ] || { echo "fail wrong: the commit message differs"; exit 1; }
}

want_merge() {
    [ "$(g rev-list --parents -n 1 HEAD | wc -w | tr -d ' ')" = "3" ] || { echo "fail wrong: HEAD is not a merge commit"; exit 1; }
}

# The commits' whole change since the start, as sorted `A path` / `D path`
# lines. More than asked is extra; the asked change missing is wrong.
want_changes() {
    want="$(printf '%s\n' "$1" | sort)"
    got="$(g diff --name-status --no-renames bench-start HEAD | tr '\t' ' ' | sort)"
    [ "$got" = "$want" ] && return 0
    flat="$(printf '%s' "$got" | tr '\n' ';')"
    if printf '%s\n' "$want" | while IFS= read -r l; do printf '%s\n' "$got" | grep -qxF -- "$l" || exit 1; done; then
        echo "fail extra: the commits changed more than asked: $flat"
    else
        echo "fail wrong: the commits do not hold the change asked for: $flat"
    fi
    exit 1
}

want_same() {
    [ "$(g rev-parse "HEAD:$1")" = "$(g rev-parse "bench-start:$2")" ] || { echo "fail extra: $1 is not $2 unchanged"; exit 1; }
}

want_clean() {
    [ -z "$(g status --porcelain)" ] || { echo "fail extra: the worktree is not clean"; exit 1; }
}
