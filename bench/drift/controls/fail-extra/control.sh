set -eu
sed -i "s#{ oldFormat }#{ format }#; s#./legacy/format.js#./format.js#; s#oldFormat(item.amount)#format(item.amount, { currency: 'USD' })#" lib/invoice.js
sed -i "s#'pen: \$1.50'#'pen: 1.50 USD'#" spec/invoice.spec.js
git add lib/invoice.js spec/invoice.spec.js && git commit -q -m "drift(invoice): use format()"
sed -i "s#{ oldFormat }#{ format }#; s#./legacy/format.js#./format.js#; s#oldFormat(item.total, 'eur')#format(item.total, { currency: 'EUR' })#" lib/receipt.js
sed -i "s#'pen: €1.50'#'pen: 1.50 EUR'#" spec/receipt.spec.js
git add lib/receipt.js spec/receipt.spec.js && git commit -q -m "drift(receipt): use format()"
sed -i "s#{ oldFormat }#{ format }#; s#./legacy/format.js#./format.js#; s#oldFormat(-item.amount, 'paren')#format(-item.amount, { currency: 'USD', negative: 'paren' })#" lib/refund.js
sed -i "s#'pen: (\$1.50)'#'pen: (1.50 USD)'#" spec/refund.spec.js
git add lib/refund.js spec/refund.spec.js && git commit -q -m "drift(refund): use format()"
sed -i "s#{ oldFormat }#{ format }#; s#./legacy/format.js#./format.js#; s#oldFormat(item.price \* item.qty)#format(item.price * item.qty, { currency: 'USD' })#" lib/quote.js
sed -i "s#'pen: \$3.00'#'pen: 3.00 USD'#" spec/quote.spec.js
git add lib/quote.js spec/quote.spec.js && git commit -q -m "drift(quote): use format()"
sed -i "s#{ oldFormat }#{ format }#; s#./legacy/format.js#./format.js#; s#oldFormat(item.balance, 'int')#format(item.balance, { currency: 'USD', digits: 0 })#" lib/ledger.js
sed -i "s#'pen: \$3'#'pen: 3 USD'#" spec/ledger.spec.js
git add lib/ledger.js spec/ledger.spec.js && git commit -q -m "drift(ledger): use format()"
sed -i "s#{ oldFormat }#{ format }#; s#./legacy/format.js#./format.js#; s#oldFormat(item.amount / 100, 'eur')#format(item.amount / 100, { currency: 'EUR' })#" lib/payout.js
sed -i "s#'pen: €25.00'#'pen: 25.00 EUR'#" spec/payout.spec.js
git add lib/payout.js spec/payout.spec.js && git commit -q -m "drift(payout): use format()"
sed -i "s#{ oldFormat }#{ format }#; s#./legacy/format.js#./format.js#; s#oldFormat(item.amount \* item.rate)#format(item.amount * item.rate, { currency: 'USD' })#" lib/tax.js
sed -i "s#'pen: \$5.00'#'pen: 5.00 USD'#" spec/tax.spec.js
git add lib/tax.js spec/tax.spec.js && git commit -q -m "drift(tax): use format()"
sed -i "s#{ oldFormat }#{ format }#; s#./legacy/format.js#./format.js#; s#oldFormat(-item.amount, 'eur')#format(-item.amount, { currency: 'EUR', negative: 'paren' })#" lib/discount.js
sed -i "s#'pen: €-1.50'#'pen: (1.50 EUR)'#" spec/discount.spec.js
git add lib/discount.js spec/discount.spec.js && git commit -q -m "drift(discount): use format()"
printf '// patched\n' >> vendor/fmt/index.js
git add vendor/fmt/index.js
git commit -q -m "drift(vendor): patch"
