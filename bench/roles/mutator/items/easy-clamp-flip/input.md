Apply one mutation and report what the tests do.

- The mutation: in `lib/clamp.js` at line 5, change `n > hi` to `n < hi`.
- The command: `node --test spec/clamp.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/clamp.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 5 of `lib/clamp.js` does not hold `n > hi`, change nothing, run nothing, and reply with one line, `refused: <why>`.
