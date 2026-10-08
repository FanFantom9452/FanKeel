# bench/roles/implementer/items/repo.sh (the mover's and the mutator's differ only in the message)
# Sourced by every item's setup.sh: repo_start <item dir> copies the item's
# src/ into the run directory and commits it under a local identity, so the
# agent's own commits need no global one, with the bench's own files ignored
# and the start tagged bench-start for the judge to diff against.
repo_start() {
    mkdir -p .fankeel/sessions
    cp -r "$1/src/." .
    printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
    git init -q
    git config core.autocrlf false
    git config user.name bench
    git config user.email bench@localhost
    git add -A
    git commit -q -m "implementer: start"
    git tag bench-start
}
