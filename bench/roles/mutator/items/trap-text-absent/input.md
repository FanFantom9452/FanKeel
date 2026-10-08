Apply one mutation and report what the tests do.

- The mutation: in `lib/counter.js` at line 5, change `count += 1` to `count += 2`.
- The command: `node --test spec/counter.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/counter.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 5 of `lib/counter.js` does not hold `count += 1`, change nothing, run nothing, and reply with one line, `refused: <why>`.
