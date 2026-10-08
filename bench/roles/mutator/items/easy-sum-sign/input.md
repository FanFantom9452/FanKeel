Apply one mutation and report what the tests do.

- The mutation: in `lib/sum.js` at line 4, change `a + b` to `a - b`.
- The command: `node --test spec/sum.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/sum.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 4 of `lib/sum.js` does not hold `a + b`, change nothing, run nothing, and reply with one line, `refused: <why>`.
