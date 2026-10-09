Apply one mutation and report what the tests do.

- The mutation: in `lib/total.js` at line 4, change `total + tax` to `total - tax`.
- The command: `node --test spec/total.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/total.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 4 of `lib/total.js` does not hold `total + tax`, change nothing, run nothing, and reply with one line, `refused: <why>`.
