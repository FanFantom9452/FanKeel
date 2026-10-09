# bench/roles/reader/items/repo.sh
# Sourced by every reader item's setup.sh, which runs in the empty run
# directory. repo_filler writes twenty-six filler modules so the files that
# hold the answers are not the only ones; repo_commit ignores the bench's own
# files and commits the start with line endings as written.
repo_filler() {
    mkdir -p .fankeel/sessions lib/parts
    for i in $(seq -w 1 26); do
        printf "'use strict';\n// Part %s of the order pipeline.\nfunction part%s(x) {\n    return x + %d;\n}\n\nexports.part%s = part%s;\n" "$i" "$i" "$((10#$i))" "$i" "$i" > "lib/parts/part$i.js"
    done
}

repo_commit() {
    printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
    git init -q
    git config core.autocrlf false
    git add -A
    git -c user.name=bench -c user.email=bench@localhost commit -q -m "reader: start"
}
