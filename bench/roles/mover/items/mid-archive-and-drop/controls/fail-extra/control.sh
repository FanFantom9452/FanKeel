set -eu
git mv docs/plan.md docs/archive/plan.md
git rm -q docs/scratch.md
printf 'See docs/archive/plan.md.\n' >> README.md
git add README.md
git commit -q -m "docs: archive the plan, drop the scratch"
