Apply one mutation and report what the tests do.

- The mutation: in `lib/empty.js` at line 4, change `=== 0` to `!== 0`.
- The command: `node --test spec/empty.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/empty.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 4 of `lib/empty.js` does not hold `=== 0`, change nothing, run nothing, and reply with one line, `refused: <why>`.
