Apply one mutation and report what the tests do.

- The mutation: in `lib/discount.js` at line 4, change `total > 100` to `total >= 100`.
- The command: `node --test spec/discount.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/discount.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 4 of `lib/discount.js` does not hold `total > 100`, change nothing, run nothing, and reply with one line, `refused: <why>`.
