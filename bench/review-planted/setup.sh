#!/usr/bin/env bash
# Builds the review project in the current directory: lib/cart.js as it was,
# committed, then the change with four planted defects committed on top —
# the commit the reviewer reads.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p .fankeel/sessions lib
git init -q
cp "$here/src/base/lib/cart.js" lib/cart.js
git add lib/cart.js
git -c user.name=bench -c user.email=bench@localhost commit -q -m "cart: the total"
cp "$here/src/change/lib/cart.js" lib/cart.js
git add lib/cart.js
git -c user.name=bench -c user.email=bench@localhost commit -q -m "cart: cheapest-first receipts, price loading, and a discount comment"
