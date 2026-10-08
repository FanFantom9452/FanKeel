set -eu
for m in invoice receipt refund quote ledger payout tax; do
    sed -i "s#const { oldFormat } = require('./legacy/format.js');#const { format } = require('./format.js');#; s#oldFormat(item.amount)#format(item.amount, { currency: 'TWD' })#" "lib/$m.js"
    sed -i "s#'pen: \$1.50'#'pen: 1.50 TWD'#" "spec/$m.spec.js"
    git add "lib/$m.js" "spec/$m.spec.js"
    git commit -q -m "drift($m): use format()"
done
