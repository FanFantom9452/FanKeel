Apply one mutation and report what the tests do.

- The mutation: in `lib/range.js` at line 5, change `i <= n` to `i < n`.
- The command: `node --test spec/range.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/range.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 5 of `lib/range.js` does not hold `i <= n`, change nothing, run nothing, and reply with one line, `refused: <why>`.
