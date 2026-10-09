set -eu
git mv docs/plan.md docs/archive/plan.md
git rm -q docs/scratch.md
git commit -q -m "docs: archive the plan, drop the scratch"
