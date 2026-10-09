set -eu
git mv docs/drafts/setup.md docs/setup.md
sed -i 's#(../README.md)#(README.md)#' docs/setup.md
git add docs/setup.md
git commit -q -m "docs: setup out of drafts"
